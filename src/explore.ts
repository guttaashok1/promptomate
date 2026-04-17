import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { parseResponse } from "./agent.js";
import { PlaywrightMcpClient, type McpContentBlock } from "./mcp-client.js";
import {
  extractSecretNames,
  resolveSecrets,
  scrubSecrets,
  substituteSecretsDeep,
} from "./secrets.js";
import { AUTH_DIR, authStateFile, saveMetadata, slugify } from "./storage.js";
import { resolveModel } from "./models.js";
import { formatSummaryLine, recordUsage, resetUsage, summarize } from "./usage.js";

const MAX_ITERATIONS = 30;

const TOOL_DENYLIST = new Set([
  "browser_install",
  "browser_close",
  "browser_evaluate",
  "browser_resize",
  "browser_pdf_save",
]);

type ToolContent = string | Array<
  Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
>;

function buildSystemPrompt(ctx: { authFixture?: string; usesAuth?: string }): string {
  const authBlock = ctx.authFixture
    ? `\nAuth fixture (producing):
- This test's job is to log in and SAVE the authenticated session so other tests can reuse it without logging in.
- After the login flow succeeds, the final generated spec MUST end by calling:
    await page.context().storageState({ path: "${authStateFile(ctx.authFixture)}" });
- The harness has already ensured the parent directory exists.
- Add a leading comment in the spec explaining this is an auth setup fixture for "${ctx.authFixture}".`
    : ctx.usesAuth
    ? `\nAuth fixture (consuming):
- The browser session is ALREADY authenticated via the "${ctx.usesAuth}" fixture. DO NOT perform any login steps — skip navigating to a login page, skip filling credentials, skip clicking Sign in.
- Start the test at the target URL and verify the authenticated state directly.
- The generated spec MUST include this line right after the imports:
    test.use({ storageState: "${authStateFile(ctx.usesAuth)}" });
- This loads the saved cookies/localStorage automatically; Playwright applies it before every test.`
    : "";

  return `You are a QA automation agent driving a real browser via the Playwright MCP server. Given a scenario and a starting URL, explore the live page until the scenario is proven end-to-end, then emit a standalone Playwright test.

Exploration rules:
- Start with browser_navigate. Read the snapshot carefully before acting.
- The MCP snapshot uses refs (e.g. [ref=e12]) — use them for click/hover/drag tool calls during exploration.
- After each action you get a fresh snapshot. Verify the page changed as expected before proceeding.
- If an action fails, adapt: try a different element, different approach, or an alternative path.
- Use browser_take_screenshot when visual-only content matters or the snapshot is ambiguous.
- Use browser_console_messages and browser_network_requests when you need to assert on JS errors, API calls, or status codes.
- Keep exploration minimal. Usually 5–12 tool calls is enough. Stop once the scenario is confirmed.

Secret handling:
- The user's scenario may reference secrets as \${VARNAME} (e.g. \${SAUCE_PASSWORD}).
- When you emit tool calls that fill fields with \${VARNAME}, keep the \${VARNAME} literal in your tool input — the harness substitutes the real value before dispatching to the browser.
- In the final generated .spec.ts: NEVER hard-code secret values. For any \${VARNAME} the user referenced, use process.env.VARNAME ?? "" — the test harness loads .env, so process.env will be populated at runtime.
${authBlock}
Assertion guidance for the generated test:
- The generated spec is standalone Playwright code — it does NOT use MCP. Refs are ephemeral; the final test uses regular Playwright locators.
- Translate exploration locators into getByRole / getByText / getByLabel / getByPlaceholder using the role + accessible name from the snapshot.
- Never use CSS selectors or XPath. Use data-test attributes only as a last resort when an element has no accessible name.
- Use expectVisual(target, description) — imported from "../src/assertions.js" — for semantic/visual checks that DOM assertions can't express cleanly ("a red error banner", "a rendered chart with a downward trend"). Do NOT use it for checks a toHaveText / toBeVisible already covers.
- Include meaningful assertions (toHaveURL, toHaveText, toBeVisible, per-page URL checks).

When done, STOP calling tools and respond with exactly two XML blocks:
<summary>One-sentence summary of what the test verifies.</summary>
<code>
// complete TypeScript Playwright .spec.ts file.
// Import { test, expect } from "@playwright/test".
// Import { expectVisual } from "../src/assertions.js" only if you use it.
// Use regular Playwright locators — NOT MCP refs.
</code>

Do not wrap the code in markdown fences. Do not add commentary outside these two blocks.`;
}

export interface UsageSnapshot {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  line: string;
}

export type ProgressEvent =
  | { type: "started"; url: string; prompt: string }
  | { type: "tool_call"; name: string; input: unknown; ok: boolean; error?: string }
  | { type: "assistant_text"; text: string }
  | { type: "done"; name: string; path: string; summary: string; code: string; usage: UsageSnapshot }
  | { type: "error"; message: string };

export async function exploreAndGenerate(opts: {
  prompt: string;
  url: string;
  name?: string;
  headless?: boolean;
  model?: string;
  tags?: string[];
  authFixture?: string;
  usesAuth?: string;
  onProgress?: (event: ProgressEvent) => void;
}): Promise<{ name: string; path: string; summary: string }> {
  const model = resolveModel(opts.model);
  let storageState: string | undefined;
  if (opts.usesAuth) {
    storageState = authStateFile(opts.usesAuth);
    try {
      await fs.access(storageState);
    } catch {
      throw new Error(
        `Auth fixture "${opts.usesAuth}" not found at ${storageState}. ` +
        `Run the auth fixture test first to produce it (e.g. 'promptomate run <auth-fixture-name>').`,
      );
    }
  }
  if (opts.authFixture) {
    await fs.mkdir(AUTH_DIR, { recursive: true });
  }
  const emit = (e: ProgressEvent) => opts.onProgress?.(e);
  resetUsage();
  emit({ type: "started", url: opts.url, prompt: opts.prompt });

  const secretNames = extractSecretNames(opts.prompt);
  const secrets = secretNames.length ? resolveSecrets(secretNames) : {};
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.");
  }

  const mcp = new PlaywrightMcpClient();
  await mcp.connect({ headless: opts.headless ?? true, storageState });

  try {
    const mcpTools = await mcp.listTools();
    const tools: Anthropic.Tool[] = mcpTools
      .filter((t) => !TOOL_DENYLIST.has(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
      }));

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = `Scenario: "${opts.prompt}"
Starting URL: ${opts.url}

Begin by calling browser_navigate with the starting URL. Then explore until the scenario is confirmed.`;

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    let finalText = "";
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: buildSystemPrompt({ authFixture: opts.authFixture, usesAuth: opts.usesAuth }),
        tools,
        messages,
      });

      recordUsage(model, response.usage);
      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text",
      );
      finalText = textBlocks.map((b) => b.text).join("\n");

      if (response.stop_reason === "end_turn" || toolUses.length === 0) break;

      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const preview = previewInput(call.input);
        const resolvedInput = substituteSecretsDeep(
          call.input as Record<string, unknown>,
          secrets,
        );
        try {
          const mcpResult = await mcp.callTool(call.name, resolvedInput);
          console.log(`  → ${call.name}(${preview}) ${mcpResult.isError ? "✗" : "✓"}`);
          emit({ type: "tool_call", name: call.name, input: call.input, ok: !mcpResult.isError });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: translateMcpContent(mcpResult.content, secrets),
            is_error: mcpResult.isError,
          });
        } catch (e) {
          const msg = (e as Error).message;
          console.log(`  → ${call.name}(${preview}) ✗ (${msg})`);
          emit({ type: "tool_call", name: call.name, input: call.input, ok: false, error: msg });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `Error: ${msg}`,
            is_error: true,
          });
        }
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
      tags: opts.tags,
      authFixture: opts.authFixture,
      usesAuth: opts.usesAuth,
    });

    const u = summarize();
    const usage: UsageSnapshot = {
      calls: u.calls,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      costUsd: u.costUsd,
      line: formatSummaryLine(u),
    };
    emit({ type: "done", name: slug, path: filePath, summary, code, usage });
    return { name: slug, path: filePath, summary };
  } catch (e) {
    emit({ type: "error", message: (e as Error).message });
    throw e;
  } finally {
    await mcp.close();
  }
}

function translateMcpContent(
  content: McpContentBlock[],
  secrets: Record<string, string> = {},
): ToolContent {
  const blocks: Array<
    Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
  > = [];
  const hasSecrets = Object.keys(secrets).length > 0;
  for (const item of content) {
    if (item.type === "text" && typeof item.text === "string") {
      const clean = hasSecrets ? scrubSecrets(item.text, secrets) : item.text;
      blocks.push({ type: "text", text: truncate(clean, 8000) });
    } else if (item.type === "image" && typeof item.data === "string") {
      const mediaType = (item.mimeType ?? "image/png") as
        | "image/png"
        | "image/jpeg"
        | "image/gif"
        | "image/webp";
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: item.data },
      });
    }
  }
  if (blocks.length === 0) return "(empty tool result)";
  if (blocks.length === 1 && blocks[0].type === "text") return blocks[0].text;
  return blocks;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated]";
}

function previewInput(input: unknown): string {
  const s = JSON.stringify(input);
  return s.length > 80 ? s.slice(0, 80) + "..." : s;
}
