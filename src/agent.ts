import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { saveMetadata, slugify } from "./storage.js";
import { callModel } from "./llm.js";

const SYSTEM_PROMPT = `You generate Playwright tests in TypeScript.

Rules:
- Import from "@playwright/test": test, expect
- Use semantic locators: getByRole, getByText, getByLabel, getByPlaceholder, getByTestId
- Avoid CSS selectors and XPath — they are brittle
- Always start with page.goto(<url>)
- Include meaningful assertions (expect(...).toBeVisible(), toHaveURL, toHaveText, etc.)
- Wait on user-observable state, not arbitrary timeouts
- Output exactly one test() block in a complete .spec.ts file

Secret handling:
- If the user's scenario references secrets as \${VARNAME} (e.g. \${SAUCE_PASSWORD}), use process.env.VARNAME ?? "" in the generated code — NEVER hard-code the value.
- The test harness loads .env at runtime, so process.env will be populated.

Response format — respond with exactly two XML blocks, nothing else:
<summary>One-sentence summary of what the test verifies.</summary>
<code>
// complete TypeScript spec file contents here, no markdown fences
</code>`;

export async function generateTest(opts: {
  prompt: string;
  url: string;
  name?: string;
  model?: string;
}): Promise<{ name: string; path: string; summary: string }> {
  const { snapshot, title } = await capturePage(opts.url);

  const userPrompt = `Generate a Playwright test for this scenario:

"${opts.prompt}"

Target URL: ${opts.url}
Page title: ${title}

ARIA snapshot of the landing page (use this to choose locators):
${truncate(snapshot, 12000)}`;

  const raw = await callModel({ system: SYSTEM_PROMPT, user: userPrompt, model: opts.model });
  const { summary, code } = parseResponse(raw);

  const slug = opts.name ?? slugify(opts.prompt);
  const filePath = path.join("tests", `${slug}.spec.ts`);
  await fs.mkdir("tests", { recursive: true });
  await fs.writeFile(filePath, code);
  await saveMetadata(slug, {
    prompt: opts.prompt,
    url: opts.url,
    summary,
    createdAt: new Date().toISOString(),
  });

  return { name: slug, path: filePath, summary };
}

export async function capturePage(url: string): Promise<{ snapshot: string; title: string }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const snapshot = await page.locator("body").ariaSnapshot();
    const title = await page.title();
    return { snapshot, title };
  } finally {
    await browser.close();
  }
}

export function parseResponse(raw: string): { summary: string; code: string } {
  const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/);
  const codeMatch = raw.match(/<code>([\s\S]*?)<\/code>/);
  if (!summaryMatch || !codeMatch) {
    throw new Error(`Model response missing <summary> or <code> blocks. Got:\n${raw}`);
  }
  return {
    summary: summaryMatch[1].trim(),
    code: stripFences(codeMatch[1]).trim() + "\n",
  };
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:typescript|ts|js)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated]";
}
