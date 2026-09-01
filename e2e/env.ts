
/**
 * E2E runs against the LOCAL Supabase stack and refuses to run against anything
 * else.
 *
 * This is not a convenience check. The specs deliberately mutate real rows —
 * they set a member's balance, zero a reward's stock and flip `is_active`
 * mid-test — and `.env.local` in this repo points at the HOSTED project. Pointing
 * the suite there would corrupt live customer data with no undo, so the guard
 * below is the only thing standing between a stray `npm run test:e2e` and a
 * production incident.
 */

const LOCAL_URL = "http://127.0.0.1:54321"

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? LOCAL_URL

export const SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  // The Supabase CLI's fixed local service-role key. It is the same on every
  // machine, is not a secret, and works only against a stack on this host.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

export const PUBLISHABLE_KEY =
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

/** Throws unless the target is a database on this machine. */
export function assertLocalTarget(): void {
  const host = new URL(SUPABASE_URL).hostname
  const isLocal =
    host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0"

  if (!isLocal) {
    throw new Error(
      `Refusing to run E2E against ${SUPABASE_URL}.\n` +
        "These specs write to the database — they set balances, zero stock and " +
        "deactivate rewards. Run `supabase start` and leave E2E_SUPABASE_URL " +
        "unset, or point it at a throwaway project.",
    )
  }
}

