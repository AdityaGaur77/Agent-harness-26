/**
 * Shared contracts for the subject-data MCP server.
 *
 * Wire shapes are snake_case: they are read by the model and by the Code Mode
 * rehearsal script in the sandbox, so they match the tool docs verbatim.
 */

/** A row of `retention_policies`, read from the database — never hardcoded. */
export interface RetentionPolicy {
  table_name: string;
  /** Legal basis for keeping the row. Whatever the policy row says. */
  basis: string;
  retain_years: number;
  /** Columns holding personal data on this table. */
  pii_columns: string[];
  /** Columns to overwrite when the row must be kept but de-identified. */
  anonymise_columns: string[];
}

export interface ForeignKey {
  constraint_name: string;
  /** Table carrying the FK column. */
  child_table: string;
  child_columns: string[];
  /** Table the FK points at. */
  parent_table: string;
  parent_columns: string[];
  /** ON DELETE behaviour: CASCADE | SET NULL | RESTRICT | NO ACTION | SET DEFAULT */
  on_delete: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
}

export interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
  primary_key: string[];
}

/** Where a subject's rows live, and how many there are. */
export interface SubjectDataLocation {
  table_name: string;
  /** Column tying the row to the subject, direct or via a parent table. */
  linked_by: string;
  /** "direct" when the FK names the subject; "transitive" when reached via a parent. */
  link_kind: 'direct' | 'transitive';
  /** For transitive links, the chain walked to get here, e.g. ["customers","orders"]. */
  via: string[];
  row_count: number;
}

export type PlanMode = 'naive' | 'revised';

export type StepAction = 'delete' | 'anonymise';

/**
 * One table's treatment under a plan.
 *
 * `delete` removes the matching rows outright (and lets declared FK actions
 * fire). `anonymise` keeps the row and overwrites `columns` in place — the
 * shape used when an erasure request collides with a retention obligation.
 */
export interface PlanStep {
  table: string;
  action: StepAction;
  /** Required for `anonymise`: the columns to overwrite. Ignored for `delete`. */
  columns?: string[];
}

export interface DeletionPlan {
  subject_id: number;
  mode: PlanMode;
  steps: PlanStep[];
}

/** A table that a plan would destroy despite a live retention obligation. */
export interface RetentionViolation {
  table_name: string;
  /** Rows the rehearsal actually destroyed on the shadow copy. */
  rows_destroyed: number;
  basis: string;
  retain_years: number;
  /** What the policy says to overwrite instead of deleting. */
  anonymise_columns: string[];
  /** True when the rows died via a cascade rather than an explicit step. */
  via_cascade: boolean;
}

/**
 * The measured blast radius. Every number here is counted before and after a
 * real execution against the shadow schema — none of it is predicted.
 */
export interface RehearsalResult {
  subject_id: number;
  mode: PlanMode;
  shadow_schema: string;
  measured_at: string;
  /** Table -> rows that disappeared. */
  rows_deleted_per_table: Record<string, number>;
  /** Table -> rows overwritten in place. */
  rows_anonymised_per_table: Record<string, number>;
  /** Tables that lost rows without an explicit step targeting them. */
  cascades_fired: string[];
  /** Rows whose FK was nulled by ON DELETE SET NULL. */
  rows_orphaned: number;
  /** Constraint names that rejected the plan, if any. */
  constraints_blocked: string[];
  /** Cross-referenced against `retention_policies` read from the database. */
  retention_violations: RetentionViolation[];
  /**
   * True only when this plan is safe to execute: nothing blocked it AND it
   * destroyed nothing the retention policies protect. A plan can run
   * flawlessly and still be illegal, so completion alone is not enough.
   */
  ok: boolean;
}

/** Result of the one gated tool. */
export interface ExecutionResult {
  subject_id: number;
  mode: PlanMode;
  executed_at: string;
  rows_deleted_per_table: Record<string, number>;
  rows_anonymised_per_table: Record<string, number>;
  /** Echoed back so the audit trail records what was approved. */
  plan: DeletionPlan;
  committed: boolean;
}
