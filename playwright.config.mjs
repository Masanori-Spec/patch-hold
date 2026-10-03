import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  fullyParallel: false,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4173", acceptDownloads: true },
  webServer: {
    command: "npm run build && npm run serve",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
