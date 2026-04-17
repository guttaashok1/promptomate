#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ override: true });
import { Command } from "commander";
import { generateTest } from "./agent.js";
import { exploreAndGenerate } from "./explore.js";
import { runTest } from "./runner.js";
import { listTests, readSpec, readMetadata } from "./storage.js";
import { healTest } from "./heal.js";
import { runCi } from "./ci.js";
import { triage, triageAndApply } from "./triage.js";
import fs from "fs/promises";

const program = new Command();

program
  .name("promptomate")
  .description("Prompt-driven Playwright test generation")
  .version("0.1.0");

program
  .command("gen")
  .description("Generate a Playwright test from a natural-language prompt and run it")
  .argument("<prompt>", "What to test, e.g. 'login with valid creds redirects to dashboard'")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-n, --name <slug>", "Test name slug (defaults to derived from prompt)")
  .option("--no-run", "Only generate, don't execute")
  .action(async (prompt: string, opts: { url: string; name?: string; run: boolean }) => {
    const result = await generateTest({ prompt, url: opts.url, name: opts.name });
    console.log(`\n✓ Generated ${result.path}`);
    console.log(`  Summary: ${result.summary}\n`);
    if (opts.run !== false) {
      const run = await runTest(result.path);
      process.exit(run.exitCode);
    }
  });

program
  .command("explore")
  .description("Agent-driven: Claude clicks through the site to discover the flow, then emits a spec")
  .argument("<prompt>", "What to test, e.g. 'sign up with new email and land on the dashboard'")
  .requiredOption("-u, --url <url>", "Starting URL")
  .option("-n, --name <slug>", "Test name slug")
  .option("--headed", "Show the browser during exploration (useful for debugging)")
  .option("--no-run", "Only generate, don't execute the final spec")
  .action(async (prompt: string, opts: { url: string; name?: string; headed: boolean; run: boolean }) => {
    console.log(`Exploring ${opts.url} ...`);
    const result = await exploreAndGenerate({
      prompt,
      url: opts.url,
      name: opts.name,
      headless: !opts.headed,
    });
    console.log(`\n✓ Generated ${result.path}`);
    console.log(`  Summary: ${result.summary}\n`);
    if (opts.run !== false) {
      const run = await runTest(result.path);
      process.exit(run.exitCode);
    }
  });

program
  .command("run")
  .description("Run a saved test")
  .argument("<name>", "Test name")
  .action(async (name: string) => {
    const run = await runTest(`tests/${name}.spec.ts`);
    process.exit(run.exitCode);
  });

program
  .command("heal")
  .description("Re-generate a failing test against the current DOM")
  .argument("<name>", "Test name")
  .action(async (name: string) => {
    const metadata = await readMetadata(name);
    if (!metadata) {
      console.error(`No saved test "${name}". Run \`promptomate list\` to see saved tests.`);
      process.exit(1);
    }
    const oldCode = await readSpec(name);
    const result = await healTest({ name, metadata, oldCode });
    console.log(`\n✓ Healed ${result.path}`);
    console.log(`  Changes: ${result.summary}\n`);
    const run = await runTest(result.path);
    process.exit(run.exitCode);
  });

program
  .command("triage")
  .description("Re-run a test, classify any failure (real bug / flake / dom drift), and suggest a fix")
  .argument("<name>", "Test name")
  .option("--apply", "Auto-apply the suggestion (heal on drift, retry on flake, stop on real bug)")
  .option("--max-attempts <n>", "Max attempts when --apply is set (default 3)", "3")
  .action(async (name: string, opts: { apply?: boolean; maxAttempts: string }) => {
    if (opts.apply) {
      const max = Math.max(1, parseInt(opts.maxAttempts, 10) || 3);
      const result = await triageAndApply(name, max);
      console.log("\n━━━━━━━━━━━━ Summary ━━━━━━━━━━━━");
      console.log(`  Status:  ${result.finalStatus}`);
      if (result.finalVerdict) {
        console.log(`  Verdict: ${result.finalVerdict}`);
      }
      console.log(`  Attempts: ${result.attempts.length}`);
      for (const [i, a] of result.attempts.entries()) {
        const verdict = a.triage.verdict ?? "(parse failed)";
        const detail = a.action === "heal" ? ` → heal: ${a.healSummary}` : ` → ${a.action}`;
        console.log(`    ${i + 1}. ${verdict}${detail}`);
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      if (result.finalStatus === "passed") {
        process.exit(0);
      }
      process.exit(result.finalVerdict === "real_bug" ? 2 : 1);
    }
    const result = await triage(name);
    if (result.passed) {
      console.log("\n✓ Test passed. Nothing to triage.");
      return;
    }
    console.log("\n━━━━━━━━━━━ Triage ━━━━━━━━━━━");
    console.log(`  Verdict:    ${result.verdict ?? "(parse failed)"}`);
    console.log(`  Confidence: ${result.confidence ?? "(parse failed)"}`);
    console.log(`  Reason:     ${result.reason ?? "(parse failed)"}`);
    console.log(`  Suggestion: ${result.suggestion ?? "(parse failed)"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(1);
  });

program
  .command("ci")
  .description("Run every saved test with auto-triage and emit a markdown report (for CI)")
  .option("-o, --out <path>", "Write the markdown report to this path", "triage-report.md")
  .option("--max-attempts <n>", "Max recovery attempts per failing test", "3")
  .action(async (opts: { out: string; maxAttempts: string }) => {
    const max = Math.max(1, parseInt(opts.maxAttempts, 10) || 3);
    const { report, exitCode } = await runCi(max);
    await fs.writeFile(opts.out, report);
    console.log(`\nReport written to ${opts.out}`);
    console.log(report);
    process.exit(exitCode);
  });

program
  .command("list")
  .description("List all saved tests")
  .action(async () => {
    const tests = await listTests();
    if (tests.length === 0) {
      console.log("No tests yet. Run `promptomate gen` to create one.");
      return;
    }
    for (const t of tests) {
      console.log(`  ${t.name}`);
      console.log(`    prompt:  ${t.prompt}`);
      console.log(`    url:     ${t.url}`);
      console.log(`    summary: ${t.summary}\n`);
    }
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
