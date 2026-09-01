import { defineConfig, devices } from "@playwright/test"

import { PUBLISHABLE_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./e2e/env"

// `localhost`, NOT `127.0.0.1`. Next's dev server treats a request whose Host is
// not localhost as cross-origin and refuses to serve `/_next/*` to it unless
// `allowedDevOrigins` names it. The page still renders and Server Actions still
// work — forms are progressively enhanced — so the symptom is not an error but a
// site that never hydrates: dialogs, menus and selects silently do nothing.
// Using the origin Next already trusts keeps `next.config.ts` free of
// test-only configuration.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100"

export default defineConfig({
  testDir: "./e2e",
  // The specs share one database and mutate it — balances, stock, is_active — so
  // they are serial by construction. Parallelism would need a dedicated member
  // per spec file, which is not worth it for a suite this size.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Creates the two identities and the reward the specs drive, before any
  // browser starts. Also the place that refuses to run against a non-local
  // database.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "vi-VN",
    // The check-in and spin RPCs book against Vietnam's calendar day. A runner
    // in another zone would disagree with the server about what "today" is.
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "guest",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /(guest-guards|login)\.spec\.ts/,
    },
    {
      name: "member",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/member.json",
      },
      dependencies: ["setup"],
      testMatch: /(role-separation|redeem)\.spec\.ts/,
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
      testMatch: /adjust-points\.spec\.ts/,
    },
  ],
  webServer: {
    // `next dev`, not a production build: this suite is a local pre-push gate,
    // and a full build per run costs more than the specs do. Port 3100 so it
    // cannot collide with a dev server the developer already has open.
    //
    // The Supabase env is overridden here rather than read from .env.local,
    // which points at the HOSTED project — see e2e/env.ts for why that matters.
    command: "npm run dev -- --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    },
  },
})
