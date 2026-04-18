import { MODEL_PRICING } from "./models.js";

export interface CallUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
}

let calls: CallUsage[] = [];
let budgetUsd: number | undefined;

export class BudgetExceededError extends Error {
  constructor(public costSoFar: number, public limit: number) {
    super(`Budget exceeded: $${costSoFar.toFixed(4)} >= $${limit.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

export function setBudget(maxUsd: number | undefined): void {
  budgetUsd = maxUsd && maxUsd > 0 ? maxUsd : undefined;
}

export function recordUsage(
  model: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | undefined,
): void {
  if (!usage) return;
  calls.push({
    model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreateTokens: usage.cache_creation_input_tokens ?? 0,
  });
  if (budgetUsd !== undefined) {
    const costSoFar = summarize().costUsd;
    if (costSoFar >= budgetUsd) {
      throw new BudgetExceededError(costSoFar, budgetUsd);
    }
  }
}

export function resetUsage(): void {
  calls = [];
  budgetUsd = undefined;
}

export function getUsage(): CallUsage[] {
  return [...calls];
}

export interface UsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  costUsd: number;
  byModel: Record<
    string,
    { calls: number; input: number; output: number; costUsd: number }
  >;
}

export function summarize(): UsageSummary {
  const out: UsageSummary = {
    calls: calls.length,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreateTokens: 0,
    costUsd: 0,
    byModel: {},
  };
  for (const c of calls) {
    out.inputTokens += c.inputTokens;
    out.outputTokens += c.outputTokens;
    out.cacheReadTokens += c.cacheReadTokens;
    out.cacheCreateTokens += c.cacheCreateTokens;

    const pricing = MODEL_PRICING[c.model];
    let costUsd = 0;
    if (pricing) {
      const billableInput =
        c.inputTokens + c.cacheCreateTokens * 1.25 + c.cacheReadTokens * 0.1;
      costUsd =
        (billableInput * pricing.inputPer1M) / 1_000_000 +
        (c.outputTokens * pricing.outputPer1M) / 1_000_000;
    }
    out.costUsd += costUsd;

    const m = out.byModel[c.model] ?? { calls: 0, input: 0, output: 0, costUsd: 0 };
    m.calls += 1;
    m.input += c.inputTokens;
    m.output += c.outputTokens;
    m.costUsd += costUsd;
    out.byModel[c.model] = m;
  }
  return out;
}

export function formatSummaryLine(s: UsageSummary): string {
  if (s.calls === 0) return "";
  const models = Object.entries(s.byModel)
    .map(([m, v]) => `${m} ×${v.calls}`)
    .join(", ");
  return `${s.calls} API call${s.calls === 1 ? "" : "s"} · ${s.inputTokens.toLocaleString()} in + ${s.outputTokens.toLocaleString()} out · $${s.costUsd.toFixed(4)} · ${models}`;
}
