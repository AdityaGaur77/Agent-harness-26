import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { READ_ONLY } from "../annotations.js";
import {
  countRowsPerTable,
  getPool,
  getRetentionPolicies,
  listForeignKeys,
  listTables,
  primaryKeysByTable,
  quoteIdent,
  snapshotToShadow,
} from "../db.js";
import { fail, ok } from "./shared.js";

export function registerDiscoverTools(server: McpServer): void {
  server.registerTool(
    "inspect_schema",
    {
      title: "Inspect schema",
      description:
        "List every user table in the subject-data store with its columns, data types and current row counts. Call this first to ground any deletion plan in the real schema.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const db = getPool("main");
        const tables = await listTables(db);
        const columns = await db.query(
          `SELECT table_name, column_name, data_type, is_nullable
             FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position`,
        );
        const counts = await countRowsPerTable(db, tables);
        const grouped = new Map<string, Array<Record<string, unknown>>>();
        for (const row of columns.rows as unknown as Array<Record<string, unknown>>) {
          const name = row.table_name as string;
          if (!grouped.has(name)) grouped.set(name, []);
          grouped.get(name)!.push({
            column: row.column_name,
            data_type: row.data_type,
            nullable: row.is_nullable === "YES",
          });
        }
        return ok({
          tables: tables.map((name) => ({
            name,
            row_count: counts.get(name) ?? 0,
            columns: grouped.get(name) ?? [],
          })),
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "list_foreign_keys",
    {
      title: "List foreign keys",
      description:
        "Return every foreign-key edge in the store as child_table.child_column -> parent_table.parent_column, including the ON DELETE rule. Deletes cascade along these edges; walk the graph outward from the subject before planning anything.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const edges = await listForeignKeys(getPool("main"));
        return ok({ foreign_keys: edges });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_retention_policies",
    {
      title: "Get retention policies",
      description:
        "Read the retention_policies table verbatim: for each table it states whether rows are held under a legal basis (basis), for how long (retain_years), which columns hold personal data (pii_columns) and which columns to overwrite when a row must survive an erasure (anonymise_columns). Check the entry for EVERY table a plan would touch before deleting anything.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const policies = await getRetentionPolicies(getPool("main"));
        return ok({ retention_policies: policies });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "find_subject_data",
    {
      title: "Find subject data",
      description:
        "Walk the foreign-key graph outward from one subject row and count every row that references it directly or transitively. Returns per-table counts plus the discovery path, so nothing that mentions the subject is missed. Read-only; never deletes.",
      inputSchema: {
        subject_id: z.number().int().describe("Primary key of the subject row (e.g. customers.id)."),
        root_table: z
          .string()
          .optional()
          .describe("Table the subject id lives in. Defaults to 'customers'."),
      },
      annotations: READ_ONLY,
    },
    async ({ subject_id, root_table }) => {
      try {
        const db = getPool("main");
        const tables = await listTables(db);
        const root = root_table?.trim() || "customers";
        if (!tables.includes(root)) {
          return fail(new Error(`Unknown root_table "${root}". Known tables: ${tables.join(", ")}`));
        }
        const pks = await primaryKeysByTable(db);
        const edges = await listForeignKeys(db);
        const rootPk = pks.get(root);
        if (!rootPk) {
          return fail(new Error(`Table "${root}" has no single-column primary key.`));
        }

        const reachable = new Map<string, { path: string[]; values: unknown[] }>();
        reachable.set(root, { path: [root], values: [subject_id] });
        let frontier = [root];
        while (frontier.length > 0) {
          const next: string[] = [];
          for (const edge of edges) {
            if (!frontier.includes(edge.parent_table)) continue;
            if (reachable.has(edge.child_table)) continue;
            const parent = reachable.get(edge.parent_table)!;
            const childPk = pks.get(edge.child_table);
            if (!childPk) continue;
            const sql =
              `SELECT DISTINCT ${quoteIdent(childPk)} AS value ` +
              `FROM ${quoteIdent(edge.child_table)} ` +
              `WHERE ${quoteIdent(edge.child_column)} = ANY($1)`;
            const { rows } = await db.query<{ value: unknown }>(sql, [parent.values]);
            if (rows.length === 0) continue;
            reachable.set(edge.child_table, {
              path: [...parent.path, `${edge.child_table} (${edge.child_column} -> ${edge.parent_table})`],
              values: rows.map((r) => r.value),
            });
            next.push(edge.child_table);
          }
          frontier = next;
        }

        const found = [...reachable.entries()].map(([table, info]) => ({
          table,
          rows: info.values.length,
          discovered_via: info.path.join(" -> "),
        }));
        const total = found.reduce((sum, f) => sum + f.rows, 0);
        return ok({
          subject_id,
          root_table: root,
          tables_with_subject_data: found.sort((a, b) => b.rows - a.rows),
          total_rows_referencing_subject: total,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "snapshot_to_shadow",
    {
      title: "Snapshot to shadow",
      description:
        "Clone the production database into a disposable shadow copy using CREATE DATABASE ... TEMPLATE. Production is never written; other clients of the production database are briefly disconnected during the clone. Rehearsals run against this copy; take a fresh snapshot whenever production may have changed or after any execution.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const result = await snapshotToShadow();
        return ok({ ...result, note: "Rehearse against the shadow; production untouched." });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
