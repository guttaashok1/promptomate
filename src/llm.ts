import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.PROMPTOMATE_MODEL ?? "claude-opus-4-7";

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

export async function callModel(opts: { system: string; user: string }): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n");
}
