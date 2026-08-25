import { type Client, ident, qualify } from './db.js';
import type { ForeignKey } from './types.js';

/**
 * The foreign-key graph, and how any table reaches the subject.
 *
 * This is the part that makes the blast radius measurable rather than
 * guessed: the cascade paths are read out of pg_catalog, so a schema change
 * changes the answer without anyone editing a prompt.
 */

/** pg_constraint.confdeltype -> the SQL clause it stands for. */
const ON_DELETE: Record<string, string> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

export async function loadForeignKeys(
  client: Client,
  schema: string,
): Promise<ForeignKey[]> {
  const { rows } = await client.query<{
    constraint_name: string;
    child_table: string;
    parent_table: string;
    on_delete_code: string;
    child_columns: string[];
    parent_columns: string[];
  }>(
    `SELECT con.conname                AS constraint_name,
            child.relname              AS child_table,
            parent.relname             AS parent_table,
            con.confdeltype::text      AS on_delete_code,
            (SELECT array_agg(att.attname ORDER BY u.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = con.conrelid AND att.attnum = u.attnum
            )                          AS child_columns,
            (SELECT array_agg(att.attname ORDER BY u.ord)
               FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, ord)
               JOIN pg_attribute att
                 ON att.attrelid = con.confrelid AND att.attnum = u.attnum
            )                          AS parent_columns
       FROM pg_constraint con
       JOIN pg_class child   ON child.oid  = con.conrelid
       JOIN pg_class parent  ON parent.oid = con.confrelid
       JOIN pg_namespace ns  ON ns.oid     = child.relnamespace
      WHERE con.contype = 'f'
        AND ns.nspname = $1
      ORDER BY child.relname, con.conname`,
    [schema],
  );

  return rows.map((r) => ({
    constraint_name: r.constraint_name,
    child_table: r.child_table,
    child_columns: r.child_columns ?? [],
    parent_table: r.parent_table,
    parent_columns: r.parent_columns ?? [],
    on_delete: ON_DELETE[r.on_delete_code] ?? r.on_delete_code,
  }));
}

/** One hop from a parent table to a table that references it. */
export interface Hop {
  fk: ForeignKey;
}

/** How a table is reached from the subject's root table. */
export interface Linkage {
  table: string;
  /** Tables walked from the root, inclusive: ["customers","orders","order_items"]. */
  via: string[];
  /** Hops taken, one per edge in `via`. Empty for the root table itself. */
  hops: Hop[];
  kind: 'root' | 'direct' | 'transitive';
  /** True when every hop on the path is ON DELETE CASCADE. */
  cascades_from_root: boolean;
}

/**
 * Walk outward from `rootTable` along incoming foreign keys, breadth-first,
 * recording the shortest path to every table that can reach the subject.
 *
 * Shortest path is the right choice here: it is the route a cascade takes
 * first, and it keeps the generated predicates as shallow as possible.
 */
export function resolveLinkage(
  fks: ForeignKey[],
  rootTable: string,
): Map<string, Linkage> {
  const byParent = new Map<string, ForeignKey[]>();
  for (const fk of fks) {
    const list = byParent.get(fk.parent_table) ?? [];
    list.push(fk);
    byParent.set(fk.parent_table, list);
  }

  const found = new Map<string, Linkage>();
  found.set(rootTable, {
    table: rootTable,
    via: [rootTable],
    hops: [],
    kind: 'root',
    cascades_from_root: true,
  });

  const queue: string[] = [rootTable];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const parentLink = found.get(current)!;

    for (const fk of byParent.get(current) ?? []) {
      // Self-references and revisits keep their first (shortest) path.
      if (found.has(fk.child_table)) continue;

      found.set(fk.child_table, {
        table: fk.child_table,
        via: [...parentLink.via, fk.child_table],
        hops: [...parentLink.hops, { fk }],
        kind: parentLink.kind === 'root' ? 'direct' : 'transitive',
        cascades_from_root:
          parentLink.cascades_from_root && fk.on_delete === 'CASCADE',
      });
      queue.push(fk.child_table);
    }
  }

  return found;
}

/**
 * SQL predicate selecting a subject's rows in `linkage.table`, with the
 * subject id bound as $1.
 *
 * The root table matches on its own primary key; every other table matches
 * through an IN-subquery chain back along its path, so the caller never has
 * to know the shape of the schema.
 */
export function subjectPredicate(
  schema: string,
  linkage: Linkage,
  rootPrimaryKey: string,
): string {
  if (linkage.hops.length === 0) {
    return `${ident(rootPrimaryKey)} = $1`;
  }

  // Innermost: the root table's own match.
  let predicate = `${ident(rootPrimaryKey)} = $1`;

  // Walk hops root-ward -> leaf-ward, wrapping each time.
  for (const hop of linkage.hops) {
    const { fk } = hop;
    const childCols = fk.child_columns.map(ident).join(', ');
    const parentCols = fk.parent_columns.map(ident).join(', ');
    const lhs =
      fk.child_columns.length === 1 ? childCols : `(${childCols})`;

    predicate =
      `${lhs} IN (SELECT ${parentCols} ` +
      `FROM ${qualify(schema, fk.parent_table)} WHERE ${predicate})`;
  }

  return predicate;
}

/** Primary key columns for a table, in order. */
export async function primaryKeyColumns(
  client: Client,
  schema: string,
  table: string,
): Promise<string[]> {
  const { rows } = await client.query<{ attname: string }>(
    `SELECT att.attname
       FROM pg_index idx
       JOIN pg_class rel ON rel.oid = idx.indrelid
       JOIN pg_namespace ns ON ns.oid = rel.relnamespace
       JOIN unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
       JOIN pg_attribute att
         ON att.attrelid = rel.oid AND att.attnum = k.attnum
      WHERE idx.indisprimary
        AND ns.nspname = $1
        AND rel.relname = $2
      ORDER BY k.ord`,
    [schema, table],
  );
  return rows.map((r) => r.attname);
}
