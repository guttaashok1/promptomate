import fs from "fs/promises";
import path from "path";
import { capturePage, parseResponse } from "./agent.js";
import { callModel } from "./llm.js";
import { readMetadata, readSpec, saveMetadata } from "./storage.js";

const SYSTEM_PROMPT = `You refine an existing Playwright test according to a user's modification instruction.

Inputs you'll receive:
- The original scenario the test was built for
- The current test code
- A fresh ARIA snapshot of the page at the starting URL
- The user's instruction for what to change

Rules:
- Keep the existing structure and passing assertions unless the instruction explicitly says to remove them
- Add, modify, or remove only what the instruction asks for
- Verify any new locators you add against the ARIA snapshot — use the real role + accessible name
- Prefer semantic locators (getByRole, getByText, getByLabel) — never CSS selectors
- If the instruction can't be satisfied from the given page state (e.g. it references an element that doesn't exist), note that in the summary and make the smallest reasonable change
- Preserve all existing imports; add new imports only when necessary
- Secrets: if the instruction or the original scenario references \${VARNAME}, use process.env.VARNAME ?? "" in the code — NEVER hard-code the value. The harness loads .env at runtime.

Response format — respond with exactly two XML blocks, nothing else:
<summary>One-sentence summary of what changed (and any caveats).</summary>
<code>
// the complete updated TypeScript Playwright .spec.ts file, no markdown fences
</code>`;

export async function refineTest(opts: {
  name: string;
  instruction: string;
  model?: string;
}): Promise<{ path: string; summary: string }> {
  const metadata = await readMetadata(opts.name);
  if (!metadata) {
    throw new Error(`No saved test "${opts.name}". Run 'promptomate list' to see saved tests.`);
  }
  const oldCode = await readSpec(opts.name);

  const { snapshot, title } = await capturePage(metadata.url);

  const user = `## Original scenario
${metadata.prompt}

## Starting URL
${metadata.url}
(page title: ${title})

## Current test code
${oldCode}

## Current ARIA snapshot
${truncate(snapshot, 10000)}

## Modification instruction
${opts.instruction}`;

  const raw = await callModel({ system: SYSTEM_PROMPT, user, model: opts.model });
  const { summary, code } = parseResponse(raw);

  const filePath = path.join("tests", `${opts.name}.spec.ts`);
  await fs.writeFile(filePath, code);
  await saveMetadata(opts.name, {
    ...metadata,
    summary: `${metadata.summary} (refined: ${summary})`,
  });

  return { path: filePath, summary };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated]";
}
