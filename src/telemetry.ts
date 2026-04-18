import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { PostHog } from "posthog-node";

const ID_FILE = path.join(os.homedir(), ".promptomate-telemetry-id");
const DEFAULT_HOST = "https://us.posthog.com";

let client: PostHog | null = null;
let distinctId: string | null = null;
let enabled = false;

/**
 * Telemetry is OFF by default. It turns ON only if:
 *   - PROMPTOMATE_POSTHOG_KEY is set (project public key)
 *   - AND PROMPTOMATE_NO_TELEMETRY !== "1"
 *
 * Users who want to opt out when a distributor has configured a key
 * can set PROMPTOMATE_NO_TELEMETRY=1.
 *
 * Events are captured anonymously with a stable UUID stored at
 *   ~/.promptomate-telemetry-id
 *
 * Zero network calls happen when telemetry is disabled — no overhead.
 */
export async function initTelemetry(version: string): Promise<void> {
  if (process.env.PROMPTOMATE_NO_TELEMETRY === "1") return;
  const key = process.env.PROMPTOMATE_POSTHOG_KEY;
  if (!key) return;

  const host = process.env.PROMPTOMATE_POSTHOG_HOST || DEFAULT_HOST;
  distinctId = await getOrCreateId();
  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  enabled = true;

  track("cli.session_start", { version, node: process.version, platform: process.platform });
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!enabled || !client || !distinctId) return;
  try {
    client.capture({ distinctId, event, properties });
  } catch {
    // swallow — telemetry must never break a user's command
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // swallow
  }
}

async function getOrCreateId(): Promise<string> {
  try {
    const existing = (await fs.readFile(ID_FILE, "utf8")).trim();
    if (existing && existing.length >= 8) return existing;
  } catch {
    // not there yet
  }
  const id = crypto.randomUUID();
  try {
    await fs.writeFile(ID_FILE, id);
  } catch {
    // read-only fs (CI etc.) — use an ephemeral id
  }
  return id;
}
