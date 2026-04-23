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
        "--disable-dev-shm-usage",    // use /tmp instead of /dev/shm (critical in containers)
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
      ],
    },
    screenshot: "only-on-failure",
    trace: onRender ? "off" : "retain-on-failure",
    video: onRender ? "off" : "retain-on-failure",
  },
});
