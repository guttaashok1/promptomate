#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ override: true });
import { Command } from "commander";
import { generateTest } from "./agent.js";
import { exploreAndGenerate } from "./explore.js";
import { runTest } from "./runner.js";
import { listTests, readSpec, readMetadata } from "./storage.js";
import { healTest } from "./heal.js";
import { refineTest } from "./refine.js";
import { runInit } from "./init.js";
import { runCi } from "./ci.js";
import { startServer } from "./server.js";
import { triage, triageAndApply } from "./triage.js";
import { formatSummaryLine, resetUsage, summarize } from "./usage.js";
import fs from "fs/promises";

function printUsage(): void {
  const s = summarize();
  if (s.calls === 0) return;
  console.log(`\n  ${formatSummaryLine(s)}`);
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value];
}

const program = new Command();

program
  .name("promptomate")
  .description("Prompt-driven Playwright test generation")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .env, tests/, .promptomate/, and playwright.config.ts in the current directory")
  .option("--force", "Overwrite existing files")
  .action(async (opts: { force?: boolean }) => {
    const result = await runInit({ force: opts.force });
    console.log("\npromptomate init:");
    for (const c of result.created) console.log(`  ✓ created ${c}`);
    for (const s of result.skipped) console.log(`  · skipped ${s}`);
    console.log("\nNext: open .env and set ANTHROPIC_API_KEY, then try:");
    console.log("  promptomate explore \"log in and see dashboard\" --url https://example.com\n");
  });

program
  .command("gen")
  .description("Generate a Playwright test from a natural-language prompt and run it")
  .argument("<prompt>", "What to test, e.g. 'login with valid creds redirects to dashboard'")
  .requiredOption("-u, --url <url>", "Target URL")
  .option("-n, --name <slug>", "Test name slug (defaults to derived from prompt)")
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .option("-t, --tag <tag>", "Tag to apply (repeatable)", collect, [])
  .option("--no-run", "Only generate, don't execute")
  .action(async (prompt: string, opts: { url: string; name?: string; model?: string; tag: string[]; run: boolean }) => {
    resetUsage();
    const result = await generateTest({ prompt, url: opts.url, name: opts.name, model: opts.model, tags: opts.tag });
    console.log(`\n✓ Generated ${result.path}`);
    console.log(`  Summary: ${result.summary}`);
    printUsage();
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
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .option("-t, --tag <tag>", "Tag to apply (repeatable)", collect, [])
  .option("--headed", "Show the browser during exploration (useful for debugging)")
  .option("--no-run", "Only generate, don't execute the final spec")
  .action(async (prompt: string, opts: { url: string; name?: string; model?: string; tag: string[]; headed: boolean; run: boolean }) => {
    resetUsage();
    console.log(`Exploring ${opts.url} ...`);
    const result = await exploreAndGenerate({
      prompt,
      url: opts.url,
      name: opts.name,
      headless: !opts.headed,
      model: opts.model,
      tags: opts.tag,
    });
    console.log(`\n✓ Generated ${result.path}`);
    console.log(`  Summary: ${result.summary}`);
    printUsage();
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
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .action(async (name: string, opts: { model?: string }) => {
    resetUsage();
    const metadata = await readMetadata(name);
    if (!metadata) {
      console.error(`No saved test "${name}". Run \`promptomate list\` to see saved tests.`);
      process.exit(1);
    }
    const oldCode = await readSpec(name);
    const result = await healTest({ name, metadata, oldCode, model: opts.model });
    console.log(`\n✓ Healed ${result.path}`);
    console.log(`  Changes: ${result.summary}`);
    printUsage();
    const run = await runTest(result.path);
    process.exit(run.exitCode);
  });

program
  .command("refine")
  .description("Tweak an existing test with a natural-language instruction")
  .argument("<name>", "Test name")
  .argument("<instruction>", "What to change, e.g. 'also check the cart badge shows 1'")
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .option("--no-run", "Only refine, don't execute the updated spec")
  .action(async (name: string, instruction: string, opts: { model?: string; run: boolean }) => {
    resetUsage();
    const result = await refineTest({ name, instruction, model: opts.model });
    console.log(`\n✓ Refined ${result.path}`);
    console.log(`  Changes: ${result.summary}`);
    printUsage();
    if (opts.run !== false) {
      const run = await runTest(result.path);
      process.exit(run.exitCode);
    }
  });

program
  .command("triage")
  .description("Re-run a test, classify any failure (real bug / flake / dom drift), and suggest a fix")
  .argument("<name>", "Test name")
  .option("--apply", "Auto-apply the suggestion (heal on drift, retry on flake, stop on real bug)")
  .option("--max-attempts <n>", "Max attempts when --apply is set (default 3)", "3")
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .action(async (name: string, opts: { apply?: boolean; maxAttempts: string; model?: string }) => {
    resetUsage();
    if (opts.apply) {
      const max = Math.max(1, parseInt(opts.maxAttempts, 10) || 3);
      const result = await triageAndApply(name, max, opts.model);
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
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      printUsage();
      console.log("");
      if (result.finalStatus === "passed") {
        process.exit(0);
      }
      process.exit(result.finalVerdict === "real_bug" ? 2 : 1);
    }
    const result = await triage(name, opts.model);
    if (result.passed) {
      console.log("\n✓ Test passed. Nothing to triage.");
      return;
    }
    console.log("\n━━━━━━━━━━━ Triage ━━━━━━━━━━━");
    console.log(`  Verdict:    ${result.verdict ?? "(parse failed)"}`);
    console.log(`  Confidence: ${result.confidence ?? "(parse failed)"}`);
    console.log(`  Reason:     ${result.reason ?? "(parse failed)"}`);
    console.log(`  Suggestion: ${result.suggestion ?? "(parse failed)"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    printUsage();
    process.exit(1);
  });

program
  .command("ci")
  .description("Run every saved test with auto-triage and emit a markdown report (for CI)")
  .option("-o, --out <path>", "Write the markdown report to this path", "triage-report.md")
  .option("--max-attempts <n>", "Max recovery attempts per failing test", "3")
  .option("-m, --model <model>", "Model to use (opus | sonnet | haiku | full id)")
  .option("-t, --tag <tag>", "Only run tests with this tag (repeatable)", collect, [])
  .option("--changed", "Only run tests whose spec or metadata has changed since <base>")
  .option("--base <ref>", "Base ref for --changed (default: origin/<PR base> or HEAD^)")
  .option("-c, --concurrency <n>", "Run this many tests in parallel (default 1)", "1")
  .action(async (opts: { out: string; maxAttempts: string; model?: string; tag: string[]; changed?: boolean; base?: string; concurrency: string }) => {
    resetUsage();
    const max = Math.max(1, parseInt(opts.maxAttempts, 10) || 3);
    const concurrency = Math.max(1, parseInt(opts.concurrency, 10) || 1);
    let onlyNames: string[] | undefined;
    if (opts.changed) {
      const { changedFiles, defaultBaseRef, testsAffectedByDiff } = await import("./git-diff.js");
      const all = await listTests();
      const base = opts.base ?? defaultBaseRef();
      const files = await changedFiles(base);
      onlyNames = testsAffectedByDiff(all, files);
      console.log(`--changed: base=${base}, ${files.length} files changed, ${onlyNames.length} tests affected`);
    }
    const { report, exitCode } = await runCi(
      max,
      opts.model,
      {
        tags: opts.tag.length ? opts.tag : undefined,
        onlyNames,
      },
      concurrency,
    );
    await fs.writeFile(opts.out, report);
    console.log(`\nReport written to ${opts.out}`);
    console.log(report);
    printUsage();
    process.exit(exitCode);
  });

program
  .command("serve")
  .description("Start the Promptomate web UI")
  .option("-p, --port <port>", "Port to listen on", "3535")
  .action((opts: { port: string }) => {
    const port = parseInt(opts.port, 10) || 3535;
    startServer(port);
  });

program
  .command("list")
  .description("List all saved tests")
  .option("-t, --tag <tag>", "Only list tests with this tag (repeatable)", collect, [])
  .action(async (opts: { tag: string[] }) => {
    let tests = await listTests();
    if (opts.tag.length) {
      tests = tests.filter((t) => (t.tags ?? []).some((tag) => opts.tag.includes(tag)));
    }
    if (tests.length === 0) {
      console.log("No tests match. Run `promptomate gen` to create one.");
      return;
    }
    for (const t of tests) {
      console.log(`  ${t.name}`);
      console.log(`    prompt:  ${t.prompt}`);
      console.log(`    url:     ${t.url}`);
      if (t.tags?.length) console.log(`    tags:    ${t.tags.join(", ")}`);
      console.log(`    summary: ${t.summary}\n`);
    }
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
