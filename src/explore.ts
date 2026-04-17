import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Page } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { parseResponse } from "./agent.js";
import { saveMetadata, slugify } from "./storage.js";

const MODEL = process.env.PROMPTOMATE_MODEL ?? "claude-opus-4-7";
const MAX_ITERATIONS = 25;

const SYSTEM_PROMPT = `You are a QA automation agent. Given a scenario and a starting URL, explore the live page with your browser tools to confirm the flow works, then emit a Playwright test that reproduces it.

Exploration rules:
- Start with navigate(url). Read the ARIA snapshot carefully before acting.
- Prefer semantic locators: role + accessible name as shown in the snapshot.
- After every action you get a fresh snapshot — verify the page changed as expected before proceeding.
- If an action fails, adapt: try a different role, different name, or an alternative path.
- Keep exploration minimal: usually 4-10 tool calls is enough. Stop once you've proven the scenario end-to-end.

When done, STOP calling tools and respond with exactly two XML blocks:
<summary>One-sentence summary of what the test verifies.</summary>
<code>
// complete TypeScript Playwright .spec.ts file.
// Import { test, expect } from "@playwright/test".
// Use the exact locators that worked during your exploration.
// Prefer getByRole / getByText / getByLabel. Never use CSS selectors.
// Include meaningful assertions (toHaveURL, toBeVisible, toHaveText, etc.).
</code>

Do not wrap the code in markdown fences. Do not add commentary outside these two blocks.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "navigate",
    description: "Navigate to a URL. Returns the ARIA snapshot of the loaded page.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click an element by ARIA role and accessible name. Returns the snapshot after.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", description: "ARIA role, e.g. 'button', 'link', 'combobox', 'checkbox'" },
        name: { type: "string", description: "Accessible name (visible text or aria-label)" },
        exact: { type: "boolean", description: "Exact name match. Default false (substring)." },
      },
      required: ["role", "name"],
    },
  },
  {
    name: "fill",
    description: "Type a value into a form field selected by role and accessible name.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", description: "'textbox', 'combobox', 'searchbox', etc." },
        name: { type: "string", description: "Accessible name of the field" },
        value: { type: "string", description: "The value to type" },
      },
      required: ["role", "name", "value"],
    },
  },
  {
    name: "press",
    description: "Press a keyboard key on the currently focused element.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name, e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown'" },
      },
      required: ["key"],
    },
  },
  {
    name: "snapshot",
    description: "Get a fresh ARIA snapshot of the current page without acting.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export async function exploreAndGenerate(opts: {
  prompt: string;
  url: string;
  name?: string;
  headless?: boolean;
}): Promise<{ name: string; path: string; summary: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const page = await browser.newPage();

  try {
    const userPrompt = `Scenario: "${opts.prompt}"
Starting URL: ${opts.url}

Begin by calling navigate("${opts.url}"). Then explore until the scenario is confirmed.`;

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    let finalText = "";
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text",
      );
      finalText = textBlocks.map((b) => b.text).join("\n");

      if (response.stop_reason === "end_turn" || toolUses.length === 0) {
        break;
      }

      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const result = await executeTool(call.name, call.input, page);
        console.log(`  → ${call.name}(${previewInput(call.input)}) ${result.ok ? "✓" : "✗"}`);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: result.content,
          is_error: !result.ok,
        });
      }
      messages.push({ role: "user", content: results });
    }

    const { summary, code } = parseResponse(finalText);
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
  } finally {
    await browser.close();
  }
}

async function executeTool(
  name: string,
  input: unknown,
  page: Page,
): Promise<{ ok: boolean; content: string }> {
  const args = input as Record<string, unknown>;
  try {
    switch (name) {
      case "navigate": {
        await page.goto(args.url as string, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        return { ok: true, content: await formatPageState(page) };
      }
      case "click": {
        const locator = page.getByRole(args.role as Parameters<Page["getByRole"]>[0], {
          name: args.name as string,
          exact: (args.exact as boolean | undefined) ?? false,
        });
        await locator.click({ timeout: 5_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
        return { ok: true, content: await formatPageState(page) };
      }
      case "fill": {
        const locator = page.getByRole(args.role as Parameters<Page["getByRole"]>[0], {
          name: args.name as string,
        });
        await locator.fill(args.value as string, { timeout: 5_000 });
        return { ok: true, content: await formatPageState(page) };
      }
      case "press": {
        await page.keyboard.press(args.key as string);
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        return { ok: true, content: await formatPageState(page) };
      }
      case "snapshot": {
        return { ok: true, content: await formatPageState(page) };
      }
      default:
        return { ok: false, content: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, content: `Error: ${(e as Error).message}` };
  }
}

async function formatPageState(page: Page): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  let snapshot: string;
  try {
    snapshot = await page.locator("body").ariaSnapshot();
  } catch (e) {
    snapshot = `<snapshot failed: ${(e as Error).message}>`;
  }
  const trimmed = snapshot.length > 6000 ? snapshot.slice(0, 6000) + "\n... [truncated]" : snapshot;
  return `URL: ${url}\nTitle: ${title}\n\n${trimmed}`;
}

function previewInput(input: unknown): string {
  const s = JSON.stringify(input);
  return s.length > 80 ? s.slice(0, 80) + "..." : s;
}
