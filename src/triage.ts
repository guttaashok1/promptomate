import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import { healTest } from "./heal.js";
import { resolveModel } from "./models.js";
import { readMetadata, readSpec, type TestMetadata } from "./storage.js";
import { recordUsage } from "./usage.js";

export type Verdict = "real_bug" | "flake" | "dom_drift";
export type Confidence = "low" | "medium" | "high";

export interface TriageResult {
  passed: boolean;
  verdict?: Verdict;
  confidence?: Confidence;
  reason?: string;
  suggestion?: string;
  rawOutput: string;
}

export type ActionTaken = "heal" | "retry" | "none";

export interface Attempt {
  triage: TriageResult;
  action: ActionTaken;
  healSummary?: string;
}

export interface ApplyResult {
  finalStatus: "passed" | "failed";
  finalVerdict?: Verdict;
  attempts: Attempt[];
}

const SYSTEM_PROMPT = `You are a senior QA engineer triaging a Playwright test failure.

Classify the failure as exactly ONE of:
- real_bug — the app is genuinely broken (feature doesn't work, wrong data, crash, regression)
- flake — intermittent or environmental (timeout, network blip, race condition, CI resource contention). Re-running would likely pass.
- dom_drift — the app's UI changed (locator renamed, element moved, form restructured, new accessibility labels). Locators need updating; functionality is probably fine.

Signals to weigh:
- "Element not found" + the current snapshot shows a renamed/moved equivalent → dom_drift
- "Element not found" + current snapshot shows NO sign of the expected element on the expected page → real_bug (feature regressed or was removed)
- Timeout, but current state shows the expected result DID actually load → flake
- Assertion on content/state where current state contradicts what the test asserted → real_bug
- Network errors, navigation timeouts without UI-level cause → flake

Be decisive. If evidence is thin, say so in confidence. Give a specific, actionable suggestion — not generic advice.

Respond with exactly four XML blocks, nothing else:
<verdict>real_bug|flake|dom_drift</verdict>
<confidence>low|medium|high</confidence>
<reason>One sentence citing specific evidence from the failure output and/or current snapshot.</reason>
<suggestion>One concrete next step. Use the exact "Test name (slug)" from the input when referencing commands. For dom_drift: say to run 'promptomate heal <slug>' and name the locator change. For flake: say to re-run, naming the likely cause. For real_bug: describe the bug concretely and what to file.</suggestion>`;

export async function triage(name: string, model?: string): Promise<TriageResult> {
  const metadata = await readMetadata(name);
  if (!metadata) {
    throw new Error(`No saved test "${name}". Run 'promptomate list' to see saved tests.`);
  }
  const code = await readSpec(name);

  console.log(`Running tests/${name}.spec.ts ...`);
  const run = await runTestCapture(`tests/${name}.spec.ts`);

  if (run.passed) {
    return { passed: true, rawOutput: run.output };
  }

  console.log("Test failed. Capturing current page state ...");
  const { snapshot, screenshot } = await captureCurrentState(metadata.url);

  console.log("Classifying with Claude ...\n");
  const classification = await classify({
    name,
    metadata,
    code,
    failureOutput: run.output,
    snapshot,
    screenshot,
    model,
  });

  return { passed: false, rawOutput: run.output, ...classification };
}

export async function triageAndApply(
  name: string,
  maxAttempts = 3,
  model?: string,
): Promise<ApplyResult> {
  const attempts: Attempt[] = [];

  for (let i = 0; i < maxAttempts; i++) {
    console.log(`\n━━━━━━━━━━━ Attempt ${i + 1}/${maxAttempts} ━━━━━━━━━━━`);
    const result = await triage(name, model);

    if (result.passed) {
      return { finalStatus: "passed", attempts };
    }

    console.log(`  Verdict:    ${result.verdict ?? "(parse failed)"}`);
    console.log(`  Confidence: ${result.confidence ?? "(parse failed)"}`);
    console.log(`  Reason:     ${result.reason ?? "(parse failed)"}`);

    if (result.verdict === "real_bug") {
      console.log(`  Action:     none — real bug, manual attention needed`);
      attempts.push({ triage: result, action: "none" });
      return { finalStatus: "failed", finalVerdict: "real_bug", attempts };
    }

    if (result.verdict === "dom_drift") {
      console.log(`  Action:     healing locators ...`);
      const metadata = await readMetadata(name);
      const oldCode = await readSpec(name);
      if (!metadata) {
        console.log(`  (no metadata for ${name}, can't heal)`);
        attempts.push({ triage: result, action: "none" });
        return { finalStatus: "failed", finalVerdict: result.verdict, attempts };
      }
      const healed = await healTest({ name, metadata, oldCode, model });
      console.log(`  Healed:     ${healed.summary}`);
      attempts.push({ triage: result, action: "heal", healSummary: healed.summary });
      continue;
    }

    if (result.verdict === "flake") {
      console.log(`  Action:     retry (brief pause)`);
      await new Promise((r) => setTimeout(r, 2000));
      attempts.push({ triage: result, action: "retry" });
      continue;
    }

    // verdict couldn't be parsed
    console.log(`  Action:     stopping — could not classify`);
    attempts.push({ triage: result, action: "none" });
    return { finalStatus: "failed", attempts };
  }

  return {
    finalStatus: "failed",
    finalVerdict: attempts.at(-1)?.triage.verdict,
    attempts,
  };
}

function runTestCapture(specPath: string): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";
    const proc = spawn("npx", ["playwright", "test", specPath, "--reporter=list"], {
      env: process.env,
    });
    proc.stdout.on("data", (d: Buffer) => {
      const chunk = d.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    proc.stderr.on("data", (d: Buffer) => {
      const chunk = d.toString();
      output += chunk;
      process.stderr.write(chunk);
    });
    proc.on("close", (code) => resolve({ passed: code === 0, output }));
  });
}

async function captureCurrentState(url: string): Promise<{
  snapshot: string;
  screenshot: Buffer;
}> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    const snapshot = await page
      .locator("body")
      .ariaSnapshot()
      .catch((e: unknown) => `<snapshot failed: ${(e as Error).message}>`);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: false });
    return { snapshot, screenshot };
  } finally {
    await browser.close();
  }
}

async function classify(input: {
  name: string;
  metadata: TestMetadata;
  code: string;
  failureOutput: string;
  snapshot: string;
  screenshot: Buffer;
  model?: string;
}): Promise<{
  verdict?: Verdict;
  confidence?: Confidence;
  reason?: string;
  suggestion?: string;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userText = `## Test name (slug)
${input.name}

## Scenario
${input.metadata.prompt}

## Starting URL
${input.metadata.url}

## Test code
\`\`\`ts
${input.code}
\`\`\`

## Failure output (from 'playwright test')
${truncate(input.failureOutput, 6000)}

## Current ARIA snapshot (captured just now from the starting URL)
${truncate(input.snapshot, 6000)}`;

  const model = resolveModel(input.model);
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: input.screenshot.toString("base64"),
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  recordUsage(model, response.usage);

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const verdictMatch = text.match(/<verdict>\s*(real_bug|flake|dom_drift)\s*<\/verdict>/i);
  const confidenceMatch = text.match(/<confidence>\s*(low|medium|high)\s*<\/confidence>/i);
  const reasonMatch = text.match(/<reason>([\s\S]*?)<\/reason>/);
  const suggestionMatch = text.match(/<suggestion>([\s\S]*?)<\/suggestion>/);

  return {
    verdict: verdictMatch?.[1].toLowerCase() as Verdict | undefined,
    confidence: confidenceMatch?.[1].toLowerCase() as Confidence | undefined,
    reason: reasonMatch?.[1].trim(),
    suggestion: suggestionMatch?.[1].trim(),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated]";
}
