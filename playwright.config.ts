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
        "--disable-dev-shm-usage", // use /tmp instead of /dev/shm (critical in containers)
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    },
    screenshot: "only-on-failure",
    trace: onRender ? "off" : "retain-on-failure",
    video: onRender ? "off" : "retain-on-failure",
  },
});
