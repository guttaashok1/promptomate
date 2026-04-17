export const MODEL_ALIASES: Record<string, string> = {
  opus: "claude-opus-4-7",
  "opus-4.7": "claude-opus-4-7",
  "opus-4.6": "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
  "haiku-4.5": "claude-haiku-4-5",
};

export const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-opus-4-7": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-opus-4-6": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 1.0, outputPer1M: 5.0 },
};

export const DEFAULT_MODEL = "claude-opus-4-7";

export function resolveModel(input?: string): string {
  const raw = input ?? process.env.PROMPTOMATE_MODEL ?? DEFAULT_MODEL;
  return MODEL_ALIASES[raw] ?? raw;
}
