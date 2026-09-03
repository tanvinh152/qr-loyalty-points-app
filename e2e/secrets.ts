/**
 * The secrets and endpoints the suite injects into the app under test.
 *
 * These are values `playwright.config.ts` writes into `webServer.env`, so they
 * are what the running app believes. They are NOT secret: they exist so the
 * specs and the app agree, and so `.env.local` — which points at the hosted
 * project and carries the real Pancake key — can never take part in a test run.
 *
 * Kept in their own module because `playwright.config.ts` needs them at config
 * time, and importing `pancake-stub.ts` there would pull a `node:http` server
 * into the config's module graph for two string constants.
 */

const DEFAULT_STUB_PORT = 54329

export function stubPort(): number {
  return Number(process.env.E2E_PANCAKE_PORT ?? DEFAULT_STUB_PORT)
}

export function stubBaseUrl(): string {
  return `http://127.0.0.1:${stubPort()}`
}

/** What `PANCAKE_API_URL` is set to, so `client.ts` never resolves pos.pages.fm. */
export function stubApiUrl(): string {
  return stubBaseUrl()
}

export const STUB_API_KEY = "e2e-pancake-key"
export const STUB_SHOP_ID = "1328315613"

/** Accepted on `x-webhook-secret` by both the webhook and the cron route. */
export const WEBHOOK_SECRET = "e2e-webhook-secret"

/** Accepted as `Authorization: Bearer` by the cron route only. */
export const CRON_SECRET = "e2e-cron-secret"
