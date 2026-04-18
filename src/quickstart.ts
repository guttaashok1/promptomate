import fs from "fs/promises";
import prompts from "prompts";
import { exploreAndGenerate } from "./explore.js";
import { runInit } from "./init.js";
import { runTest } from "./runner.js";

const BANNER = `
┌──────────────────────────────────────────────────────────┐
│  🤖  promptomate quickstart                               │
│  Scaffold + API key + first demo test in under 2 minutes. │
└──────────────────────────────────────────────────────────┘
`;

export async function runQuickstart(): Promise<number> {
  console.log(BANNER);

  // 1. init (idempotent)
  console.log("Scaffolding project files...");
  const init = await runInit({ force: false });
  for (const c of init.created) console.log(`  ✓ created ${c}`);
  for (const s of init.skipped) console.log(`  · already there: ${s}`);
  console.log("");

  // 2. API key
  const existing = process.env.ANTHROPIC_API_KEY;
  const existingLooksValid = existing && existing.startsWith("sk-ant-") && existing.length > 20;

  let apiKey: string | undefined;
  if (existingLooksValid) {
    console.log(`Found ANTHROPIC_API_KEY (sk-ant-…${existing.slice(-4)}).`);
    const { reuse } = await prompts({
      type: "confirm",
      name: "reuse",
      message: "Use this key?",
      initial: true,
    });
    if (!reuse) {
      const { key } = await prompts({
        type: "password",
        name: "key",
        message: "Paste your Anthropic API key (sk-ant-...)",
      });
      apiKey = key;
    }
  } else {
    console.log("Anthropic API key missing (or placeholder).");
    console.log("Get one at https://console.anthropic.com/settings/keys\n");
    const { key } = await prompts({
      type: "password",
      name: "key",
      message: "Paste your Anthropic API key (sk-ant-...)",
    });
    apiKey = key;
  }

  if (apiKey) {
    if (!apiKey.startsWith("sk-ant-")) {
      console.log("\n⚠️  That doesn't look like an Anthropic key (expected sk-ant-...). Saving anyway — fix it in .env if wrong.\n");
    }
    await writeEnvKey("ANTHROPIC_API_KEY", apiKey);
    process.env.ANTHROPIC_API_KEY = apiKey;
    console.log("✓ Saved to .env\n");
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-...")) {
    console.log("No API key set. Exiting quickstart — re-run when you have one.\n");
    return 1;
  }

  // 3. Demo
  const { demo } = await prompts({
    type: "confirm",
    name: "demo",
    message: "Run a demo now? (saucedemo login, ~45 sec, ~$0.25 in API costs)",
    initial: true,
  });

  if (!demo) {
    printNextSteps();
    return 0;
  }

  console.log("\nRunning the demo — watch the agent click through saucedemo.com:\n");
  try {
    const result = await exploreAndGenerate({
      prompt: "log in as standard_user with password 'secret_sauce' and verify the Products inventory page appears",
      url: "https://www.saucedemo.com",
      name: "quickstart-demo",
    });
    console.log(`\n✓ Generated ${result.path}`);
    console.log(`  ${result.summary}\n`);

    const { runIt } = await prompts({
      type: "confirm",
      name: "runIt",
      message: "Run the generated test?",
      initial: true,
    });
    if (runIt) {
      const run = await runTest(result.path);
      if (run.exitCode === 0) {
        console.log("\n🎉 Your first test passed. Welcome to promptomate.\n");
      }
    }
  } catch (e) {
    console.error(`\nDemo failed: ${(e as Error).message}`);
    console.error("This might be an API key issue or a transient problem.\n");
    return 1;
  }

  printNextSteps();
  return 0;
}

function printNextSteps(): void {
  console.log("Next steps:");
  console.log("  promptomate explore \"<scenario>\" --url <url>   # generate from a prompt");
  console.log("  promptomate serve                                # web UI at localhost:3535");
  console.log("  promptomate list                                 # see saved tests");
  console.log("  promptomate --help                               # all commands\n");
}

async function writeEnvKey(name: string, value: string): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(".env", "utf8");
  } catch {
    // file doesn't exist
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (idx >= 0) {
    lines[idx] = `${name}=${value}`;
  } else {
    // remove trailing empty lines, then append
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push(`${name}=${value}`);
  }
  await fs.writeFile(".env", lines.join("\n") + "\n");
}
