import fs from "fs/promises";
import path from "path";
import { capturePage, parseResponse } from "./agent.js";
import { callModel } from "./llm.js";
import { saveMetadata, type TestMetadata } from "./storage.js";

const SYSTEM_PROMPT = `You repair Playwright tests whose locators have drifted.

Rules:
- Re-resolve locators to match the current page, preserving test intent
- Prefer semantic locators (getByRole, getByText, getByLabel) over CSS selectors
- Keep the test structure (same scenario, same assertions) — only update what must change
- Output one complete .spec.ts file

Response format — respond with exactly two XML blocks, nothing else:
<summary>One-sentence summary of what changed.</summary>
<code>
// complete TypeScript spec file contents here, no markdown fences
</code>`;

export async function healTest(opts: {
  name: string;
  metadata: TestMetadata;
  oldCode: string;
}): Promise<{ path: string; summary: string }> {
  const { snapshot, title } = await capturePage(opts.metadata.url);

  const userPrompt = `Repair this Playwright test.

Original prompt: "${opts.metadata.prompt}"
Target URL: ${opts.metadata.url}
Page title: ${title}

--- Existing test code ---
${opts.oldCode}

--- Current ARIA snapshot ---
${truncate(snapshot, 12000)}`;

  const raw = await callModel({ system: SYSTEM_PROMPT, user: userPrompt });
  const { summary, code } = parseResponse(raw);

  const filePath = path.join("tests", `${opts.name}.spec.ts`);
  await fs.writeFile(filePath, code);
  await saveMetadata(opts.name, {
    ...opts.metadata,
    summary: `${opts.metadata.summary} (healed: ${summary})`,
  });

  return { path: filePath, summary };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated]";
}
