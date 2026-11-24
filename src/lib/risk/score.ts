import type { AiRisk } from "~/lib/ai/schemas";
import { FALLBACK_ADVICE_BN } from "./advice";
import { maxStatus, type Reason, type RuleResult, type Status } from "./who-rules";

export interface FinalAssessment {
  status: Status;
  ruleStatus: Status;
  aiStatus: Status | null;
  reasons: Reason[];
  adviceBn: string;
}

/**
 * Combine the rule engine with the AI's review.
 * Safety invariant: final status = max(rule, ai). The AI can raise, never lower.
 * If the AI failed (null), the rule result and static advice are used.
 */
export function combine(rule: RuleResult, ai: AiRisk | null): FinalAssessment {
  const status = maxStatus(rule.status, ai?.status);
  const aiRaised = ai != null && status !== rule.status;

  const reasons: Reason[] = [...rule.reasons];
  if (ai && aiRaised) {
    for (const textBn of ai.reasonsBn)
      reasons.push({ source: "ai", code: "AI_TREND", textBn, level: ai.status });
  }

  // Use AI wording only if it agrees with the final status; otherwise the static text.
  const adviceBn =
    ai?.status === status && ai.adviceBn.trim() ? ai.adviceBn : FALLBACK_ADVICE_BN[status];

  return { status, ruleStatus: rule.status, aiStatus: ai?.status ?? null, reasons, adviceBn };
}
