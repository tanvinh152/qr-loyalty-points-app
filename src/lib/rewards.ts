// Pure reward constants. Kept out of `loyalty.ts` because that module pulls in
// the service-role Supabase client, and the customer's reward card is a client
// component that only needs the threshold.

/**
 * Stock at or below this counts as "running low": the admin stat row, the admin
 * dashboard tile and the customer's shop chip all read it from here so the three
 * cannot drift apart.
 */
export const LOW_STOCK = 5
