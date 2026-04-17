import { spawn } from "child_process";
import { EventEmitter } from "events";
import express, { type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exploreAndGenerate, type ProgressEvent } from "./explore.js";
import { refineTest } from "./refine.js";
import { listTests, readMetadata, readSpec } from "./storage.js";
import { triage, triageAndApply } from "./triage.js";
import { formatSummaryLine, resetUsage, summarize } from "./usage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Session {
  events: ProgressEvent[];
  emitter: EventEmitter;
  done: boolean;
}

const sessions = new Map<string, Session>();

function makeSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function startServer(port: number): void {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.get("/api/tests", async (_req: Request, res: Response) => {
    const tests = await listTests();
    res.json(tests);
  });

  app.get("/api/test/:name", async (req: Request, res: Response) => {
    const metadata = await readMetadata(String(req.params.name));
    if (!metadata) return res.status(404).json({ error: "not found" });
    const code = await readSpec(String(req.params.name)).catch(() => "");
    res.json({ metadata, code });
  });

  app.post("/api/explore", async (req: Request, res: Response) => {
    const { prompt, url, name } = req.body as {
      prompt?: string;
      url?: string;
      name?: string;
    };
    if (!prompt || !url) {
      return res.status(400).json({ error: "prompt and url required" });
    }

    const id = makeSessionId();
    const emitter = new EventEmitter();
    const session: Session = { events: [], emitter, done: false };
    sessions.set(id, session);

    exploreAndGenerate({
      prompt,
      url,
      name,
      onProgress: (event) => {
        session.events.push(event);
        emitter.emit("event", event);
      },
    })
      .catch((err) => {
        const ev: ProgressEvent = {
          type: "error",
          message: (err as Error).message,
        };
        session.events.push(ev);
        emitter.emit("event", ev);
      })
      .finally(() => {
        session.done = true;
      });

    res.json({ id });
  });

  app.get("/api/explore/:id/stream", (req: Request, res: Response) => {
    const session = sessions.get(String(req.params.id));
    if (!session) return res.status(404).end();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    for (const past of session.events) {
      res.write(`data: ${JSON.stringify(past)}\n\n`);
    }

    if (session.done) {
      res.end();
      return;
    }

    const handler = (event: ProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done" || event.type === "error") {
        session.emitter.off("event", handler);
        res.end();
      }
    };
    session.emitter.on("event", handler);
    req.on("close", () => session.emitter.off("event", handler));
  });

  app.post("/api/run/:name", async (req: Request, res: Response) => {
    const specPath = path.join("tests", `${String(req.params.name)}.spec.ts`);
    try {
      await fs.access(specPath);
    } catch {
      return res.status(404).json({ error: "test not found" });
    }
    const result = await runPlaywright(specPath);
    res.json(result);
  });

  app.post("/api/refine/:name", async (req: Request, res: Response) => {
    const { instruction } = req.body as { instruction?: string };
    if (!instruction) {
      return res.status(400).json({ error: "instruction required" });
    }
    try {
      resetUsage();
      const result = await refineTest({
        name: String(req.params.name),
        instruction,
      });
      const code = await readSpec(String(req.params.name));
      const usage = summarize();
      res.json({ ...result, code, usage: { ...usage, line: formatSummaryLine(usage) } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/triage/:name", async (req: Request, res: Response) => {
    const apply = (req.query.apply as string | undefined) === "true";
    try {
      resetUsage();
      const body = apply
        ? await triageAndApply(String(req.params.name), 3)
        : await triage(String(req.params.name));
      const usage = summarize();
      res.json({ ...body, usage: { ...usage, line: formatSummaryLine(usage) } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.listen(port, () => {
    console.log(`Promptomate UI running at http://localhost:${port}`);
  });
}

function runPlaywright(specPath: string): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";
    const proc = spawn("npx", ["playwright", "test", specPath, "--reporter=list"], {
      env: process.env,
    });
    proc.stdout.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("close", (code) => resolve({ passed: code === 0, output }));
  });
}
