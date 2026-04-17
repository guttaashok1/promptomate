import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function changedFiles(base: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-only", `${base}...HEAD`],
      { env: process.env },
    );
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    try {
      const { stdout } = await execFileAsync("git", ["diff", "--name-only", base], {
        env: process.env,
      });
      return stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

export function defaultBaseRef(): string {
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return "HEAD^";
}

export function testsAffectedByDiff(
  allTests: Array<{ name: string }>,
  changed: string[],
): string[] {
  const touched = new Set<string>();
  for (const f of changed) {
    const mSpec = f.match(/^tests\/([^/]+)\.spec\.ts$/);
    if (mSpec) {
      touched.add(mSpec[1]);
      continue;
    }
    const mMeta = f.match(/^\.promptomate\/([^/]+)\.json$/);
    if (mMeta) {
      touched.add(mMeta[1]);
    }
  }
  const allow = new Set(allTests.map((t) => t.name));
  return [...touched].filter((n) => allow.has(n));
}
