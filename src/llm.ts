import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "./models.js";
import { recordUsage } from "./usage.js";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env or export it in your shell.",
      );
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function callModel(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const model = resolveModel(opts.model);
  const response = await getClient().messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  recordUsage(model, response.usage);

  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n");
}
