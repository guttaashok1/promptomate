import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = process.env.PROMPTOMATE_MODEL ?? "claude-opus-4-7";

export async function callModel(opts: { system: string; user: string }): Promise<string> {
  const response = await client.messages.create({
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
