import { spawn } from "child_process";

export function runTest(specPath: string): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["playwright", "test", specPath], {
      stdio: "inherit",
      env: process.env,
    });
    proc.on("close", (code) => resolve({ exitCode: code ?? 1 }));
  });
}
