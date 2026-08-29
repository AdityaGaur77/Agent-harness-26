import { quoteIdent, type ForeignKeyEdge } from "./db.js";

/**
 * Deriving the subject scope of a table from the foreign-key graph.
 *
 * A deletion step carries a `where` fragment written by the model. That
 * fragment is required to mention `:subject_id`, but mentioning it is not the
 * same as being bounded by it: `customer_id = :subject_id OR true` satisfies
 * the check and matches every row in the table.
 *
 * So the fragment is no longer trusted to do the scoping. Every step is also
 * clamped with the predicate derived here, which is computed from the schema's
 * own foreign keys rather than from anything the model wrote. The widest a
 * step can reach is then the subject's own rows, whatever the fragment says.
 */

/** The table a subject is rooted at; every other table is reached from it. */
export const SUBJECT_ROOT_TABLE = process.env.SUBJECT_ROOT_TABLE?.trim() || "customers";

/** Primary key of the root table, used for the innermost match. */
export const SUBJECT_ROOT_KEY = process.env.SUBJECT_ROOT_KEY?.trim() || "id";

export interface SubjectScope {
  /** Tables reachable from the root, mapped to the path taken to reach them. */
  paths: Map<string, ForeignKeyEdge[]>;
  rootTable: string;
}

/**
 * Walk outward from the root along incoming foreign keys, breadth-first,
 * keeping the shortest path to each table. Shortest is the right choice: it is
 * the route a cascade takes first and keeps the generated predicate shallow.
 */
export function buildSubjectScope(
  edges: ForeignKeyEdge[],
  rootTable: string = SUBJECT_ROOT_TABLE,
): SubjectScope {
  const byParent = new Map<string, ForeignKeyEdge[]>();
  for (const edge of edges) {
    const list = byParent.get(edge.parent_table) ?? [];
    list.push(edge);
    byParent.set(edge.parent_table, list);
  }

  const paths = new Map<string, ForeignKeyEdge[]>();
  paths.set(rootTable, []);

  const queue = [rootTable];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const soFar = paths.get(current)!;
    for (const edge of byParent.get(current) ?? []) {
      if (paths.has(edge.child_table)) continue; // keep the first, shortest path
      paths.set(edge.child_table, [...soFar, edge]);
      queue.push(edge.child_table);
    }
  }

  return { paths, rootTable };
}

/**
 * SQL predicate selecting only `table`'s rows belonging to the subject bound
 * as `$1`. Returns null when the table has no path to the root, which the
 * caller must treat as a refusal rather than as "no restriction".
 */
export function subjectScopePredicate(table: string, scope: SubjectScope): string | null {
  const path = scope.paths.get(table);
  if (!path) return null;

  // Innermost match is always the root row itself.
  let predicate = `${quoteIdent(SUBJECT_ROOT_KEY)} = $1`;

  // Wrap outward, one hop at a time, until the predicate is expressed in
  // columns that exist on `table`.
  for (const edge of path) {
    predicate =
      `${quoteIdent(edge.child_column)} IN (` +
      `SELECT ${quoteIdent(edge.parent_column)} FROM ${quoteIdent(edge.parent_table)} ` +
      `WHERE ${predicate})`;
  }

  return predicate;
}
