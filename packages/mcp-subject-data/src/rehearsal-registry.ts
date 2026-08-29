import { createHash, randomUUID } from "node:crypto";

/**
 * Binding an execution to the rehearsal that justified it.
 *
 * The approval gate shows a human one plan and asks them to approve it. Until
 * this existed, execute_deletion would accept any well-formed plan afterwards:
 * the description asked for "the exact plan that was rehearsed", but nothing
 * enforced it. In a real run the compliant plan was rejected by a validation
 * error, the agent substituted a smaller unrehearsed one, and that executed —
 * destroying the very rows the rehearsal had just proven must survive. The
 * human approved one plan and a different one ran.
 *
 * So a clean shadow rehearsal now mints a single-use token bound to a
 * fingerprint of the exact plan it measured. execute_deletion requires that
 * token and re-derives the fingerprint from the plan it was handed: if the
 * plan changed by so much as a predicate, the fingerprints disagree and the
 * write is refused. What was approved is what runs, or nothing runs.
 */

export interface FingerprintablePlan {
  subject_id: number;
  steps: Array<{
    table: string;
    action: string;
    where?: string | undefined;
    set?: Record<string, string | number | null> | undefined;
  }>;
}

/**
 * Stable fingerprint of a plan's meaning. Step order is preserved because it
 * changes the outcome; keys within a step are sorted because they do not.
 */
export function planFingerprint(plan: FingerprintablePlan): string {
  const canonical = JSON.stringify({
    subject_id: plan.subject_id,
    steps: plan.steps.map((step) => ({
      table: step.table,
      action: step.action,
      where: step.where ?? null,
      set:
        step.set === undefined || step.set === null
          ? null
          : Object.fromEntries(
              Object.keys(step.set)
                .sort()
                .map((key) => [key, step.set![key] ?? null]),
            ),
    })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

interface Grant {
  fingerprint: string;
  issuedAt: number;
}

/**
 * Module-level, so it survives the per-request McpServer instances. Single
 * process only: running more than one replica needs shared storage, or a
 * token minted on one replica will not be honoured on another.
 */
const grants = new Map<string, Grant>();

/** A stale approval is not an approval. */
const TOKEN_TTL_MS = 30 * 60 * 1000;

function sweep(now: number): void {
  for (const [token, grant] of grants) {
    if (now - grant.issuedAt > TOKEN_TTL_MS) grants.delete(token);
  }
}

/**
 * Called only when a shadow rehearsal came back clean — nothing blocked and no
 * retention violation. Returns the token that unlocks execution of this exact
 * plan, once.
 */
export function grantExecutionToken(plan: FingerprintablePlan): string {
  const now = Date.now();
  sweep(now);
  const token = `rehearsed_${randomUUID()}`;
  grants.set(token, { fingerprint: planFingerprint(plan), issuedAt: now });
  return token;
}

export type TokenCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Redeem a token for one execution. Consumed on success so an approval cannot
 * be replayed against a second write.
 */
export function redeemExecutionToken(
  token: string,
  plan: FingerprintablePlan,
): TokenCheck {
  const now = Date.now();
  sweep(now);

  const grant = grants.get(token);
  if (!grant) {
    return {
      ok: false,
      reason:
        "no clean rehearsal is on record for this token. A token is issued only " +
        "by rehearse_deletion when it reports would_be_illegal=false with nothing " +
        "blocked, it is valid for 30 minutes, and it can be redeemed once. " +
        "Rehearse the plan you intend to execute and use the token it returns.",
    };
  }

  if (grant.fingerprint !== planFingerprint(plan)) {
    grants.delete(token);
    return {
      ok: false,
      reason:
        "this plan is not the plan that was rehearsed under this token. The " +
        "human approved what the rehearsal measured; executing anything else " +
        "would put a different change into production than the one approved. " +
        "Rehearse this exact plan and execute the result of that rehearsal.",
    };
  }

  grants.delete(token);
  return { ok: true };
}

/** Test seam. */
export function _resetGrants(): void {
  grants.clear();
}
