import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { READ_ONLY } from '../annotations.js';
import { config } from '../config.js';
import { type Client, listTables, qualify, withClient } from '../db.js';
import {
  loadForeignKeys,
  primaryKeyColumns,
  resolveLinkage,
  subjectPredicate,
} from '../graph.js';
import { ROOT_TABLE } from '../plan.js';
import type {
  ColumnInfo,
  RetentionPolicy,
  SubjectDataLocation,
  TableInfo,
} from '../types.js';

/**
 * The read-only half of the server: everything the agent needs to work out
 * what a deletion would touch, before it proposes one.
 *
 * Nothing here is parameterised by knowledge the agent was told. The schema,
 * the foreign-key actions and the retention rules are all read out of the
 * database at call time, so the agent's reasoning stays anchored to the
 * database that will actually be written to.
 */

/** The policy table is metadata about erasure, never a target of one. */
const POLICY_TABLE = 'retention_policies';

function ok(result: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** True when `table` exists as a base table in `schema`. */
async function tableExists(
  client: Client,
  schema: string,
  table: string,
): Promise<boolean> {
  const { rows } = await client.query<{ one: number }>(
    `SELECT 1 AS one
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
        AND table_type = 'BASE TABLE'`,
    [schema, table],
  );
  return rows.length > 0;
}

export function registerDiscoveryTools(server: McpServer): void {
  server.registerTool(
    'inspect_schema',
    {
      title: 'Inspect schema',
      description:
        'List the live schema: every base table with its columns, data types, ' +
        'nullability and primary key. Pass `table` to narrow to one table. ' +
        'Read this before writing any plan — column names and types are what ' +
        'decide whether a row can be anonymised in place or must be deleted.',
      inputSchema: { table: z.string().optional() },
      annotations: READ_ONLY,
    },
    async ({ table }) => {
      try {
        const schema = config.liveSchema;
        const result = await withClient(async (client) => {
          const all = await listTables(client, schema);
          const wanted = table ? all.filter((t) => t === table) : all;
          if (table && wanted.length === 0) {
            throw new Error(
              `No base table "${table}" in schema "${schema}". ` +
                `Tables here: ${all.join(', ') || '(none)'}`,
            );
          }

          const { rows } = await client.query<{
            table_name: string;
            column_name: string;
            data_type: string;
            is_nullable: string;
          }>(
            `SELECT table_name, column_name, data_type, is_nullable
               FROM information_schema.columns
              WHERE table_schema = $1
                AND table_name = ANY($2::text[])
              ORDER BY table_name, ordinal_position`,
            [schema, wanted],
          );

          const columnsByTable = new Map<string, ColumnInfo[]>();
          for (const r of rows) {
            const list = columnsByTable.get(r.table_name) ?? [];
            list.push({
              column_name: r.column_name,
              data_type: r.data_type,
              is_nullable: r.is_nullable === 'YES',
            });
            columnsByTable.set(r.table_name, list);
          }

          const infos: TableInfo[] = [];
          for (const name of wanted) {
            infos.push({
              table_name: name,
              columns: columnsByTable.get(name) ?? [],
              primary_key: await primaryKeyColumns(client, schema, name),
            });
          }
          return infos;
        });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'list_foreign_keys',
    {
      title: 'List foreign keys',
      description:
        'Every foreign key in the live schema, including its declared ON DELETE ' +
        'behaviour (CASCADE, SET NULL, RESTRICT, NO ACTION, SET DEFAULT). ' +
        'This is where the blast radius comes from: a CASCADE edge means ' +
        'deleting a parent row silently destroys child rows you never named, ' +
        'a SET NULL edge orphans them, and a RESTRICT edge will refuse the ' +
        'delete outright. Read this before assuming a plan only touches the ' +
        'tables it lists.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const fks = await withClient((client) =>
          loadForeignKeys(client, config.liveSchema),
        );
        return ok(fks);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_retention_policies',
    {
      title: 'Get retention policies',
      description:
        'Read the retention policy table: the legal rules this database ' +
        'records about which rows must be kept, for how long, on what basis, ' +
        'which of their columns hold personal data, and which columns to ' +
        'overwrite when a row must be kept but de-identified. ' +
        'These rules live in the database, not in this description — you MUST ' +
        'call this tool and read the rows before proposing to delete from any ' +
        'table, and you must not assume a table is unconstrained because no ' +
        'policy came to mind. A table under a live retention obligation cannot ' +
        'simply be deleted: the erasure request has to be satisfied some other ' +
        'way. Policies can change without this server changing, so treat the ' +
        'rows returned here as the only authority.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const schema = config.liveSchema;
        const policies = await withClient(async (client) => {
          if (!(await tableExists(client, schema, POLICY_TABLE))) {
            throw new Error(
              `Table "${schema}"."${POLICY_TABLE}" does not exist, so the ` +
                `retention rules cannot be read. Refuse to plan any deletion ` +
                `until it is present — absence of the table is not evidence ` +
                `that nothing must be retained.`,
            );
          }

          const { rows } = await client.query<{
            table_name: string;
            basis: string;
            retain_years: number;
            pii_columns: string[] | null;
            anonymise_columns: string[] | null;
          }>(
            `SELECT table_name, basis, retain_years, pii_columns, anonymise_columns
               FROM ${qualify(schema, POLICY_TABLE)}
              ORDER BY table_name`,
          );

          return rows.map(
            (r): RetentionPolicy => ({
              table_name: r.table_name,
              basis: r.basis,
              retain_years: r.retain_years,
              pii_columns: r.pii_columns ?? [],
              anonymise_columns: r.anonymise_columns ?? [],
            }),
          );
        });
        return ok(policies);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'find_subject_data',
    {
      title: 'Find subject data',
      description:
        "Locate every row belonging to one data subject. Walks the live " +
        'schema\'s foreign-key graph outward from the subject\'s root table and ' +
        'counts the matching rows in each table it can reach, reporting whether ' +
        'the link is direct or transitive and the chain of tables walked to get ' +
        'there. Tables holding no rows for this subject are omitted; the root ' +
        'table is always reported, so a count of 0 there means the subject does ' +
        'not exist. Use this to scope an erasure request before planning it.',
      inputSchema: { subject_id: z.number().int() },
      annotations: READ_ONLY,
    },
    async ({ subject_id }) => {
      try {
        const schema = config.liveSchema;
        const locations = await withClient(async (client) => {
          const rootPk = await primaryKeyColumns(client, schema, ROOT_TABLE);
          const rootKey = rootPk[0];
          if (rootPk.length !== 1 || !rootKey) {
            throw new Error(
              `${ROOT_TABLE} must have a single-column primary key, found ${rootPk.length}`,
            );
          }

          const fks = await loadForeignKeys(client, schema);
          const linkage = resolveLinkage(fks, ROOT_TABLE);

          const found: SubjectDataLocation[] = [];
          for (const link of linkage.values()) {
            if (link.table === POLICY_TABLE) continue;

            const where = subjectPredicate(schema, link, rootKey);
            const { rows } = await client.query<{ n: number }>(
              `SELECT COUNT(*)::int8 AS n
                 FROM ${qualify(schema, link.table)}
                WHERE ${where}`,
              [subject_id],
            );
            const rowCount = rows[0]?.n ?? 0;

            const isRoot = link.kind === 'root';
            // Report the root even when empty: "subject not found" has to be
            // distinguishable from "subject exists but has no other rows".
            if (rowCount === 0 && !isRoot) continue;

            // The column that ties a row here to the subject: for the root
            // that is its own key, otherwise the FK column of the last hop.
            const lastHop = link.hops[link.hops.length - 1];
            found.push({
              table_name: link.table,
              linked_by: isRoot
                ? rootKey
                : (lastHop?.fk.child_columns.join(', ') ?? rootKey),
              link_kind: link.kind === 'root' ? 'direct' : link.kind,
              via: link.via,
              row_count: rowCount,
            });
          }

          return found.sort((a, b) => a.table_name.localeCompare(b.table_name));
        });
        return ok(locations);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
