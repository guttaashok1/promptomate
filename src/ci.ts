import { listTests } from "./storage.js";
import { triageAndApply, type ApplyResult } from "./triage.js";

type TestStatus = "passed" | "healed" | "flake_recovered" | "real_bug" | "failed";

interface TestRunResult {
  name: string;
  status: TestStatus;
  apply: ApplyResult;
}

export interface CiResult {
  report: string;
  exitCode: 0 | 1 | 2;
  results: TestRunResult[];
}

export async function runCi(maxAttempts = 3, model?: string): Promise<CiResult> {
  const tests = await listTests();
  if (tests.length === 0) {
    return {
      report: "## 🤖 Promptomate\n\n_No tests found in `.promptomate/`. Generate one with `promptomate gen` or `promptomate explore`._\n",
      exitCode: 0,
      results: [],
    };
  }

  const results: TestRunResult[] = [];
  for (const t of tests) {
    console.log(`\n========== ${t.name} ==========`);
    const apply = await triageAndApply(t.name, maxAttempts, model);
    const status = computeStatus(apply);
    results.push({ name: t.name, status, apply });
  }

  return formatReport(results);
}

function computeStatus(apply: ApplyResult): TestStatus {
  if (apply.finalStatus === "passed") {
    if (apply.attempts.length === 0) return "passed";
    const firstVerdict = apply.attempts[0].triage.verdict;
    if (firstVerdict === "dom_drift") return "healed";
    if (firstVerdict === "flake") return "flake_recovered";
    return "passed";
  }
  if (apply.finalVerdict === "real_bug") return "real_bug";
  return "failed";
}

const STATUS_LABEL: Record<TestStatus, string> = {
  passed: "✅ passed",
  healed: "🩹 auto-healed",
  flake_recovered: "🔁 flake recovered",
  real_bug: "🐛 real bug",
  failed: "❌ failed",
};

function formatReport(results: TestRunResult[]): CiResult {
  const counts: Record<TestStatus, number> = {
    passed: 0,
    healed: 0,
    flake_recovered: 0,
    real_bug: 0,
    failed: 0,
  };
  for (const r of results) counts[r.status]++;

  const summaryParts: string[] = [];
  if (counts.passed) summaryParts.push(`✅ ${counts.passed} passed`);
  if (counts.healed) summaryParts.push(`🩹 ${counts.healed} auto-healed`);
  if (counts.flake_recovered) summaryParts.push(`🔁 ${counts.flake_recovered} flake recovered`);
  if (counts.real_bug) summaryParts.push(`🐛 ${counts.real_bug} real bug${counts.real_bug > 1 ? "s" : ""}`);
  if (counts.failed) summaryParts.push(`❌ ${counts.failed} failed`);

  const lines: string[] = [];
  lines.push("## 🤖 Promptomate Test Report");
  lines.push("");
  lines.push(summaryParts.join(" · ") || "No tests ran.");
  lines.push("");
  lines.push("| Test | Status | Details |");
  lines.push("|------|--------|---------|");
  for (const r of results) {
    const details = detailsFor(r);
    lines.push(`| \`${r.name}\` | ${STATUS_LABEL[r.status]} | ${escapeCell(details)} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("_Powered by Claude Opus 4.7 · [Promptomate](https://github.com/guttaashok1/promptomate)_");

  const exitCode: 0 | 1 | 2 =
    counts.real_bug > 0 ? 2 : counts.failed > 0 ? 1 : 0;

  return { report: lines.join("\n") + "\n", exitCode, results };
}

function detailsFor(r: TestRunResult): string {
  const lastAttempt = r.apply.attempts.at(-1);
  switch (r.status) {
    case "passed":
      return "";
    case "healed": {
      const heal = r.apply.attempts.find((a) => a.action === "heal");
      return heal?.healSummary ?? "locator drift repaired";
    }
    case "flake_recovered":
      return "passed after retry";
    case "real_bug":
    case "failed": {
      const reason = lastAttempt?.triage.reason ?? "(no reason)";
      const suggestion = lastAttempt?.triage.suggestion;
      return suggestion ? `${reason} — ${suggestion}` : reason;
    }
  }
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
