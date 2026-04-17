import Anthropic from "@anthropic-ai/sdk";
import type { Page, Locator } from "@playwright/test";
import { resolveModel } from "./models.js";
import { recordUsage } from "./usage.js";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env to use visual assertions.",
      );
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a visual QA assistant. Given a screenshot and a description of what should be visible, judge whether the screenshot matches the description.

Be strict but not pedantic — match the spirit of the description, not pixel-perfect wording. Minor styling variance is fine; a completely wrong page state is not.

Respond with exactly two XML blocks, nothing else:
<verdict>pass</verdict> or <verdict>fail</verdict>
<reason>One sentence explaining what you observed.</reason>`;

/**
 * Visual assertion powered by Claude vision.
 *
 * Takes a screenshot of the page or locator and asks Claude whether it
 * matches the description. Throws if Claude judges it a fail.
 *
 * Use this for semantic/visual checks that are awkward in the DOM:
 *   - "an error banner showing the credentials are wrong"
 *   - "a loading spinner in the center of the page"
 *   - "the chart shows a downward trend"
 *
 * Do NOT use for things the DOM already tells you cleanly — a
 * `toHaveText` / `toBeVisible` assertion is faster, cheaper, and
 * deterministic.
 */
export async function expectVisual(
  target: Page | Locator,
  description: string,
): Promise<void> {
  const buffer = await target.screenshot({ type: "png" });
  const base64 = buffer.toString("base64");

  const model = resolveModel();
  const response = await getClient().messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          { type: "text", text: `Does this screenshot show: ${description}?` },
        ],
      },
    ],
  });

  recordUsage(model, response.usage);

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const verdict = text.match(/<verdict>(pass|fail)<\/verdict>/i)?.[1].toLowerCase();
  const reason =
    text.match(/<reason>([\s\S]*?)<\/reason>/)?.[1].trim() ?? "(no reason given)";

  if (verdict !== "pass") {
    throw new Error(
      `expectVisual failed: "${description}"\n  Claude: ${reason}`,
    );
  }
}
