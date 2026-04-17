import { beforeEach, describe, expect, test } from "vitest";
import { formatSummaryLine, recordUsage, resetUsage, summarize } from "../src/usage.js";

describe("usage tracking", () => {
  beforeEach(() => {
    resetUsage();
  });

  test("returns empty summary when nothing recorded", () => {
    const s = summarize();
    expect(s.calls).toBe(0);
    expect(s.costUsd).toBe(0);
    expect(s.inputTokens).toBe(0);
    expect(s.outputTokens).toBe(0);
    expect(formatSummaryLine(s)).toBe("");
  });

  test("records a single call and computes cost for opus 4.7", () => {
    recordUsage("claude-opus-4-7", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    const s = summarize();
    expect(s.calls).toBe(1);
    expect(s.inputTokens).toBe(1_000_000);
    expect(s.outputTokens).toBe(1_000_000);
    // opus 4.7: $5 in + $25 out per 1M
    expect(s.costUsd).toBeCloseTo(30, 5);
  });

  test("aggregates multiple calls of the same model", () => {
    recordUsage("claude-sonnet-4-6", { input_tokens: 100, output_tokens: 50 });
    recordUsage("claude-sonnet-4-6", { input_tokens: 200, output_tokens: 100 });
    const s = summarize();
    expect(s.calls).toBe(2);
    expect(s.inputTokens).toBe(300);
    expect(s.outputTokens).toBe(150);
    expect(s.byModel["claude-sonnet-4-6"].calls).toBe(2);
  });

  test("splits per-model breakdown when multiple models used", () => {
    recordUsage("claude-opus-4-7", { input_tokens: 1000, output_tokens: 500 });
    recordUsage("claude-haiku-4-5", { input_tokens: 2000, output_tokens: 1000 });
    const s = summarize();
    expect(s.calls).toBe(2);
    expect(Object.keys(s.byModel).sort()).toEqual([
      "claude-haiku-4-5",
      "claude-opus-4-7",
    ]);
    expect(s.byModel["claude-opus-4-7"].input).toBe(1000);
    expect(s.byModel["claude-haiku-4-5"].output).toBe(1000);
  });

  test("factors cache read at 0.1× and cache create at 1.25×", () => {
    recordUsage("claude-opus-4-7", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    const s1 = summarize();
    // 1M cache-read tokens × 0.1 × $5/1M = $0.50
    expect(s1.costUsd).toBeCloseTo(0.5, 5);

    resetUsage();
    recordUsage("claude-opus-4-7", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    });
    const s2 = summarize();
    // 1M cache-create tokens × 1.25 × $5/1M = $6.25
    expect(s2.costUsd).toBeCloseTo(6.25, 5);
  });

  test("zero cost for unknown model id", () => {
    recordUsage("unknown-model", { input_tokens: 1000, output_tokens: 500 });
    const s = summarize();
    expect(s.costUsd).toBe(0);
    expect(s.calls).toBe(1);
  });

  test("formatSummaryLine produces a readable one-liner", () => {
    recordUsage("claude-opus-4-7", { input_tokens: 1234, output_tokens: 567 });
    const line = formatSummaryLine(summarize());
    expect(line).toContain("1 API call");
    expect(line).toContain("1,234 in");
    expect(line).toContain("567 out");
    expect(line).toContain("claude-opus-4-7");
    expect(line).toContain("$");
  });

  test("resetUsage clears all state", () => {
    recordUsage("claude-opus-4-7", { input_tokens: 100, output_tokens: 50 });
    resetUsage();
    expect(summarize().calls).toBe(0);
  });

  test("undefined usage is a noop", () => {
    recordUsage("claude-opus-4-7", undefined);
    expect(summarize().calls).toBe(0);
  });
});
