import fs from "fs/promises";
import path from "path";

const ENV_TEMPLATE = `ANTHROPIC_API_KEY=sk-ant-...
`;

const PLAYWRIGHT_CONFIG_TEMPLATE = `import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ override: true });

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
`;

const GITIGNORE_ADDITIONS = [
  "node_modules/",
  "dist/",
  ".env",
  "test-results/",
  "playwright-report/",
  "blob-report/",
  "playwright/.cache/",
  ".playwright-mcp/",
  ".promptomate/auth/",
  ".promptomate/runs/",
  "triage-report.md",
];

export interface InitResult {
  created: string[];
  skipped: string[];
}

export async function runInit(opts: { force?: boolean } = {}): Promise<InitResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  const files: { path: string; content: string; label: string }[] = [
    { path: ".env", content: ENV_TEMPLATE, label: ".env" },
    {
      path: "playwright.config.ts",
      content: PLAYWRIGHT_CONFIG_TEMPLATE,
      label: "playwright.config.ts",
    },
  ];

  for (const f of files) {
    if (await exists(f.path) && !opts.force) {
      skipped.push(f.label);
      continue;
    }
    await fs.writeFile(f.path, f.content);
    created.push(f.label);
  }

  for (const dir of ["tests", ".promptomate", ".promptomate/auth"]) {
    if (await exists(dir)) {
      skipped.push(`${dir}/`);
    } else {
      await fs.mkdir(dir, { recursive: true });
      created.push(`${dir}/`);
    }
  }

  await updateGitignore(created, skipped);

  return { created, skipped };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function updateGitignore(created: string[], skipped: string[]): Promise<void> {
  const existing = (await fs.readFile(".gitignore", "utf8").catch(() => ""));
  const have = new Set(
    existing.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  );
  const missing = GITIGNORE_ADDITIONS.filter((l) => !have.has(l));
  if (missing.length === 0) {
    skipped.push(".gitignore (already complete)");
    return;
  }
  const block = (existing.endsWith("\n") || existing === "" ? "" : "\n") +
    `# Added by promptomate init\n${missing.join("\n")}\n`;
  await fs.writeFile(".gitignore", existing + block);
  created.push(`.gitignore (+${missing.length} entries)`);
}
