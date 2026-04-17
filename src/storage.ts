import fs from "fs/promises";
import path from "path";

const METADATA_DIR = ".promptomate";
const TESTS_DIR = "tests";

export interface TestMetadata {
  prompt: string;
  url: string;
  summary: string;
  createdAt: string;
  tags?: string[];
  authFixture?: string;
  usesAuth?: string;
}

export const AUTH_DIR = ".promptomate/auth";

export function authStateFile(name: string): string {
  return path.join(AUTH_DIR, `${name}.json`);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "test";
}

export async function saveMetadata(name: string, data: TestMetadata): Promise<void> {
  await fs.mkdir(METADATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(METADATA_DIR, `${name}.json`),
    JSON.stringify(data, null, 2),
  );
}

export async function readMetadata(name: string): Promise<TestMetadata | null> {
  try {
    const raw = await fs.readFile(path.join(METADATA_DIR, `${name}.json`), "utf8");
    return JSON.parse(raw) as TestMetadata;
  } catch {
    return null;
  }
}

export async function readSpec(name: string): Promise<string> {
  return fs.readFile(path.join(TESTS_DIR, `${name}.spec.ts`), "utf8");
}

export async function listTests(): Promise<Array<TestMetadata & { name: string }>> {
  try {
    const files = await fs.readdir(METADATA_DIR);
    return Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await fs.readFile(path.join(METADATA_DIR, f), "utf8");
          return { name: f.replace(".json", ""), ...(JSON.parse(raw) as TestMetadata) };
        }),
    );
  } catch {
    return [];
  }
}
