import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ override: true });

const onRender = !!process.env.RENDER;

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    headless: true,
    launchOptions: {
      args: [
        "--disable-dev-shm-usage",       // use /tmp instead of /dev/shm (critical in containers)
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--no-first-run",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--disable-client-side-phishing-detection",
        "--password-store=basic",
        "--use-mock-keychain",
        "--mute-audio",
        "--hide-scrollbars",
        "--disk-cache-size=1",           // disable Chrome's on-disk page cache (saves /tmp space)
        "--media-cache-size=1",          // disable Chrome's media cache
        "--disable-back-forward-cache",  // don't keep pages in memory after navigation
        "--disable-application-cache",   // disable HTML5 appcache
        "--disable-gpu",                 // no GPU process needed in headless containers (~50MB saved)
        "--disable-gpu-sandbox",         // skip GPU sandbox (no GPU anyway)
        "--renderer-process-limit=1",    // cap to 1 renderer process across all tabs
        "--disable-features=IsolateOrigins,site-per-process", // prevent per-origin renderer spawning
        "--js-flags=--max-old-space-size=150", // cap V8 heap in every renderer to 150MB
      ],
    },
    screenshot: "only-on-failure",
    trace: onRender ? "off" : "retain-on-failure",
    video: onRender ? "off" : "retain-on-failure",
  },
});
