import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type Status = "ok" | "warn" | "fail";

interface Check {
  label: string;
  status: Status;
  detail?: string;
  fix?: string;
}

async function checkNode(): Promise<Check> {
  const v = process.versions.node;
  const major = parseInt(v.split(".")[0], 10);
  if (major >= 20) return { label: "Node >= 20", status: "ok", detail: `v${v}` };
  return {
    label: "Node >= 20",
    status: "fail",
    detail: `v${v}`,
    fix: "Install Node 20+ from https://nodejs.org",
  };
}

async function checkApiKey(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      label: "ANTHROPIC_API_KEY",
      status: "fail",
      detail: "not set",
      fix: "Add ANTHROPIC_API_KEY to .env (run 'promptomate init' for a template)",
    };
  }
  if (!key.startsWith("sk-ant-")) {
    return {
      label: "ANTHROPIC_API_KEY",
      status: "warn",
      detail: "present but doesn't look like an Anthropic key (expected sk-ant-…)",
      fix: "Double-check the key — get one at https://console.anthropic.com/settings/keys",
    };
  }
  return { label: "ANTHROPIC_API_KEY", status: "ok", detail: `sk-ant-…${key.slice(-4)}` };
}

async function checkChromium(): Promise<Check> {
  try {
    const { stdout } = await execFileAsync("npx", ["playwright", "--version"]);
    const line = stdout.trim();
    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(process.env.HOME ?? "", "Library/Caches/ms-playwright");
    try {
      const entries = await fs.readdir(cache);
      const chromium = entries.find((e) => e.startsWith("chromium"));
      if (!chromium) {
        return {
          label: "Chromium browser",
          status: "fail",
          detail: `${line} installed, but no chromium binary in cache`,
          fix: "npx playwright install chromium",
        };
      }
      return { label: "Chromium browser", status: "ok", detail: `${line} · ${chromium}` };
    } catch {
      return {
        label: "Chromium browser",
        status: "warn",
        detail: `${line} — cache not found at ${cache}`,
        fix: "npx playwright install chromium",
      };
    }
  } catch {
    return {
      label: "Chromium browser",
      status: "fail",
      detail: "playwright CLI not available",
      fix: "npm install && npx playwright install chromium",
    };
  }
}

async function checkMcp(): Promise<Check> {
  const bin = path.join(process.cwd(), "node_modules/.bin/playwright-mcp");
  try {
    await fs.access(bin);
    return { label: "Playwright MCP binary", status: "ok", detail: bin };
  } catch {
    return {
      label: "Playwright MCP binary",
      status: "warn",
      detail: "not installed (only needed for 'explore')",
      fix: "npm install (will install @playwright/mcp)",
    };
  }
}

async function checkDirs(): Promise<Check[]> {
  const results: Check[] = [];
  for (const dir of [".promptomate", "tests", ".promptomate/auth"]) {
    try {
      await fs.access(dir);
      results.push({ label: `${dir}/`, status: "ok" });
    } catch {
      results.push({
        label: `${dir}/`,
        status: "warn",
        detail: "missing",
        fix: "promptomate init",
      });
    }
  }
  return results;
}

async function checkSavedTests(): Promise<Check> {
  try {
    const files = await fs.readdir(".promptomate");
    const count = files.filter((f) => f.endsWith(".json") && !f.startsWith("auth")).length;
    if (count === 0) {
      return {
        label: "Saved tests",
        status: "warn",
        detail: "none yet",
        fix: "promptomate gen \"<scenario>\" --url <url>",
      };
    }
    return { label: "Saved tests", status: "ok", detail: `${count} saved` };
  } catch {
    return { label: "Saved tests", status: "warn", detail: ".promptomate/ missing", fix: "promptomate init" };
  }
}

function colorize(s: Status): string {
  if (s === "ok") return "\x1b[32m✓\x1b[0m";
  if (s === "warn") return "\x1b[33m!\x1b[0m";
  return "\x1b[31m✗\x1b[0m";
}

export async function runDoctor(): Promise<{ checks: Check[]; exitCode: 0 | 1 }> {
  const checks: Check[] = [];
  checks.push(await checkNode());
  checks.push(await checkApiKey());
  checks.push(await checkChromium());
  checks.push(await checkMcp());
  checks.push(...(await checkDirs()));
  checks.push(await checkSavedTests());

  console.log("\npromptomate doctor:\n");
  for (const c of checks) {
    const detail = c.detail ? ` — ${c.detail}` : "";
    console.log(`  ${colorize(c.status)} ${c.label}${detail}`);
    if (c.fix && c.status !== "ok") console.log(`      fix: ${c.fix}`);
  }
  const anyFail = checks.some((c) => c.status === "fail");
  const anyWarn = checks.some((c) => c.status === "warn");
  console.log("");
  if (anyFail) console.log("One or more checks failed. Fix the red items above before running other commands.\n");
  else if (anyWarn) console.log("All required checks passed. A few warnings above (probably benign).\n");
  else console.log("All checks passed.\n");

  return { checks, exitCode: anyFail ? 1 : 0 };
}
