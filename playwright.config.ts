import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1200, height: 900 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl"],
    },
  },
  webServer: { command: "pnpm dev", url: baseURL, reuseExistingServer: !process.env.CI },
});
