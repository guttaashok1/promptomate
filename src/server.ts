import { spawn } from "child_process";
import { EventEmitter } from "events";
import express, { type Request, type Response } from "express";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exploreAndGenerate, type ProgressEvent } from "./explore.js";
import { refineTest } from "./refine.js";
import { listTests, readLastRun, readMetadata, readSpec, saveLastRun } from "./storage.js";
import { triage, triageAndApply } from "./triage.js";
import { formatSummaryLine, resetUsage, summarize } from "./usage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Session {
  events: ProgressEvent[];
  emitter: EventEmitter;
  done: boolean;
}

interface AsyncSession<T> {
  emitter: EventEmitter;
  done: boolean;
  result?: T;
  error?: string;
}

const sessions = new Map<string, Session>();
const asyncSessions = new Map<string, AsyncSession<unknown>>();

function makeSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function startAsyncSession<T>(
  key: string,
  work: () => Promise<T>,
): AsyncSession<T> {
  const emitter = new EventEmitter();
  const session: AsyncSession<T> = { emitter, done: false };
  asyncSessions.set(key, session as AsyncSession<unknown>);
  work()
    .then((result) => {
      session.result = result;
      emitter.emit("done", result);
    })
    .catch((err) => {
      session.error = (err as Error).message;
      emitter.emit("error", session.error);
    })
    .finally(() => {
      session.done = true;
    });
  return session;
}

function sseStream<T>(
  req: Request,
  res: Response,
  session: AsyncSession<T>,
  serialize: (result: T) => object,
): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering
  res.flushHeaders?.();

  if (session.done) {
    if (session.result !== undefined) {
      res.write(`data: ${JSON.stringify({ type: "result", ...serialize(session.result as T) })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: session.error ?? "unknown error" })}\n\n`);
    }
    res.end();
    return;
  }

  // Keep the connection alive through Render's / nginx idle-connection timeout
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": heartbeat\n\n");
  }, 15_000);

  const cleanup = () => clearInterval(heartbeat);

  const onDone = (result: T) => {
    cleanup();
    res.write(`data: ${JSON.stringify({ type: "result", ...serialize(result) })}\n\n`);
    res.end();
  };
  const onError = (message: string) => {
    cleanup();
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  };
  session.emitter.once("done", onDone);
  session.emitter.once("error", onError);
  req.on("close", () => {
    cleanup();
    session.emitter.off("done", onDone);
    session.emitter.off("error", onError);
  });
}

export function startServer(port: number): void {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", async (_req, res) => {
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "(not set)";
    const binaryPath = browsersPath !== "(not set)"
      ? path.join(browsersPath, "chromium_headless_shell-1217", "chrome-headless-shell-linux64", "chrome-headless-shell")
      : null;
    const binaryExists = binaryPath ? fsSync.existsSync(binaryPath) : false;

    // Try to actually launch the browser to catch missing system library errors
    let browserLaunch: "ok" | string = "skipped";
    if (binaryExists) {
      try {
        const { chromium } = await import("playwright-core");
        const browser = await chromium.launch({ executablePath: binaryPath! });
        await browser.close();
        browserLaunch = "ok";
      } catch (e) {
        browserLaunch = (e as Error).message.split("\n")[0];
      }
    }

    res.json({
      ok: true,
      node: process.version,
      cwd: process.cwd(),
      PLAYWRIGHT_BROWSERS_PATH: browsersPath,
      browserBinaryExists: binaryExists,
      browserLaunch,
    });
  });

  const authToken = process.env.PROMPTOMATE_AUTH_TOKEN;
  if (authToken) {
    app.use((req, res, next) => {
      const auth = req.headers.authorization ?? "";
      const bearer = auth.match(/^Bearer (.+)$/);
      if (bearer && bearer[1] === authToken) return next();
      const basic = auth.match(/^Basic (.+)$/);
      if (basic) {
        const [, password] = Buffer.from(basic[1], "base64").toString().split(":");
        if (password === authToken) return next();
      }
      res.setHeader("WWW-Authenticate", 'Basic realm="Promptomate"');
      res.status(401).send("Authentication required");
    });
    console.log("Auth: PROMPTOMATE_AUTH_TOKEN set — requests require Basic auth (any username, password = the token)");
  } else {
    console.log("Auth: OPEN (no PROMPTOMATE_AUTH_TOKEN set). Do NOT expose publicly.");
  }

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.get("/api/tests", async (_req: Request, res: Response) => {
    const tests = await listTests();
    res.json(tests);
  });

  app.get("/api/test/:name", async (req: Request, res: Response) => {
    const name = String(req.params.name);
    const metadata = await readMetadata(name);
    if (!metadata) return res.status(404).json({ error: "not found" });
    const code = await readSpec(name).catch(() => "");
    const lastRun = await readLastRun(name);
    res.json({ metadata, code, lastRun });
  });

  app.post("/api/explore", async (req: Request, res: Response) => {
    const { prompt, url, name, model, lowMemory } = req.body as {
      prompt?: string;
      url?: string;
      name?: string;
      model?: string;
      lowMemory?: boolean;
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
      model,
      lowMemory,
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
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering
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

  // ── Run ──────────────────────────────────────────────────────────
  app.post("/api/run/:name", async (req: Request, res: Response) => {
    const name = String(req.params.name);
    const specPath = path.join("tests", `${name}.spec.ts`);
    try {
      await fs.access(specPath);
    } catch {
      return res.status(404).json({ error: "test not found" });
    }
    const id = makeSessionId();
    const startedAt = Date.now();
    startAsyncSession(id, async () => {
      const result = await runPlaywright(specPath);
      const durationMs = Date.now() - startedAt;
      await saveLastRun(name, {
        passed: result.passed,
        output: result.output,
        ranAt: new Date().toISOString(),
        durationMs,
      });
      return { ...result, durationMs };
    });
    res.json({ id });
  });

  app.get("/api/run/:id/stream", (req: Request, res: Response) => {
    const session = asyncSessions.get(String(req.params.id));
    if (!session) return res.status(404).end();
    sseStream(req, res, session as AsyncSession<{ passed: boolean; output: string; durationMs: number }>, (r) => r as object);
  });

  // ── Refine ───────────────────────────────────────────────────────
  app.post("/api/refine/:name", async (req: Request, res: Response) => {
    const { instruction } = req.body as { instruction?: string };
    if (!instruction) {
      return res.status(400).json({ error: "instruction required" });
    }
    const name = String(req.params.name);
    const id = makeSessionId();
    resetUsage();
    startAsyncSession(id, async () => {
      const result = await refineTest({ name, instruction });
      const code = await readSpec(name);
      const usage = summarize();
      return { ...result, code, usage: { ...usage, line: formatSummaryLine(usage) } };
    });
    res.json({ id });
  });

  app.get("/api/refine/:id/stream", (req: Request, res: Response) => {
    const session = asyncSessions.get(String(req.params.id));
    if (!session) return res.status(404).end();
    sseStream(req, res, session as AsyncSession<object>, (r) => r as object);
  });

  // ── Triage ───────────────────────────────────────────────────────
  app.post("/api/triage/:name", async (req: Request, res: Response) => {
    const apply = (req.query.apply as string | undefined) === "true";
    const name = String(req.params.name);
    const id = makeSessionId();
    resetUsage();
    startAsyncSession(id, async () => {
      const body = apply
        ? await triageAndApply(name, 3)
        : await triage(name);
      const usage = summarize();
      return { ...body, usage: { ...usage, line: formatSummaryLine(usage) } };
    });
    res.json({ id });
  });

  app.get("/api/triage/:id/stream", (req: Request, res: Response) => {
    const session = asyncSessions.get(String(req.params.id));
    if (!session) return res.status(404).end();
    sseStream(req, res, session as AsyncSession<object>, (r) => r as object);
  });

  app.listen(port, () => {
    if (process.env.RENDER_EXTERNAL_URL) {
      console.log(`Promptomate UI listening on port ${port} — public URL: ${process.env.RENDER_EXTERNAL_URL}`);
    } else {
      console.log(`Promptomate UI running at http://localhost:${port}`);
    }
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
