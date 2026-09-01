import { vi, type Mock } from "vitest"

/**
 * A stand-in for the two Supabase clients the app hands to its server actions:
 * the cookie-scoped one from `@/lib/supabase/server` and the service-role one
 * from `@/lib/supabase/admin`.
 *
 * It is deliberately NOT an emulator. `.eq()`, `.gte()` and friends only RECORD
 * their arguments — they never filter anything, and the answer to a chain comes
 * from `tableReplies`. Testing what Postgres does with those filters is the job
 * of `supabase/tests/*.sql`, where the real planner is available; the job here
 * is to test the ACTION: does it prove the session, does it reach for the right
 * RPC, does it map the error code a member actually sees.
 *
 * `client` is typed `any` on purpose. Satisfying `SupabaseClient` would mean
 * modelling the whole generic query builder, which is the emulator trap — and
 * `npm run typecheck` runs in CI, so it would cost real time on every push.
 */

export type PgError = { code?: string; message?: string }

export type Reply<T = unknown> = {
  data?: T | null
  error?: PgError | null
  count?: number | null
}

export type AuthUser = {
  id: string
  email?: string | null
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export type QueryOp = "select" | "insert" | "update" | "delete" | "upsert"

export type FilterName =
  | "eq"
  | "neq"
  | "is"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "order"
  | "limit"
  | "range"

/** One builder chain that was actually awaited, recorded in call order. */
export type Query = {
  table: string
  op: QueryOp
  /** Columns for a select, or the row payload for insert/update/upsert. */
  arg?: unknown
  /** The second argument of `.select(cols, { count, head })`. */
  opts?: unknown
  filters: Array<{ fn: FilterName; args: unknown[] }>
  terminal: "single" | "maybeSingle" | "await"
}

/**
 * What a chain answers with. A function is handed the recorded chain, which is
 * how a test distinguishes two queries against the SAME table — the builder
 * does not filter, so the filters it recorded are the only thing telling them
 * apart.
 */
export type ReplyFor = Reply | ((query: Query) => Reply)

export type SupabaseFake = {
  /**
   * Hand this straight to a `vi.mock` factory. `any` is deliberate — see the
   * module comment: modelling `SupabaseClient`'s generic query builder is the
   * emulator trap, and `npm run typecheck` runs on every push.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
  /**
   * Read at getUser() time rather than captured, so a test can flip the caller
   * after the client has already been handed to the module under test.
   */
  user: AuthUser | null
  rpc: Mock
  rpcReplies: Map<string, Reply>
  /** Keyed `"table"` or `"table.op"`; the more specific key wins. */
  tableReplies: Map<string, ReplyFor>
  queries: Query[]
  /** The LAST chain run against `table`, optionally narrowed by op. */
  query(table: string, op?: QueryOp): Query | undefined
  /** Every chain run against `table`, optionally narrowed by op. */
  queriesFor(table: string, op?: QueryOp): Query[]
  reset(): void
}

const FILTERS: FilterName[] = [
  "eq",
  "neq",
  "is",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
  "order",
  "limit",
  "range",
]

const OPS: QueryOp[] = ["select", "insert", "update", "delete", "upsert"]

export function createSupabaseFake(seed?: {
  user?: AuthUser | null
  rpc?: Record<string, Reply>
  tables?: Record<string, ReplyFor>
}): SupabaseFake {
  const initialUser = seed?.user ?? null

  const fake = {
    user: initialUser,
    rpcReplies: new Map(Object.entries(seed?.rpc ?? {})),
    tableReplies: new Map(Object.entries(seed?.tables ?? {})),
    queries: [] as Query[],
  } as SupabaseFake

  fake.rpc = vi.fn((name: string) =>
    Promise.resolve(settle(fake.rpcReplies.get(name))),
  )

  function replyFor(q: Query): Reply | undefined {
    const found =
      fake.tableReplies.get(`${q.table}.${q.op}`) ??
      fake.tableReplies.get(q.table)
    return typeof found === "function" ? found(q) : found
  }

  function chain(table: string) {
    const q: Query = { table, op: "select", filters: [], terminal: "await" }
    let settled = false

    const record = (terminal: Query["terminal"]) => {
      // A chain can only run once; guard so an accidental double-await does not
      // show up as two queries.
      if (!settled) {
        settled = true
        q.terminal = terminal
        fake.queries.push(q)
      }
      return settle(replyFor(q))
    }

    const builder: Record<string, unknown> = {
      single: () => Promise.resolve(record("single")),
      maybeSingle: () => Promise.resolve(record("maybeSingle")),
      // Thenable: `saveSettings` and `saveTierSchedule` await the builder
      // itself, with no terminal method at all.
      then: (
        resolve: (v: Reply) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(record("await")).then(resolve, reject),
    }

    for (const op of OPS) {
      builder[op] = (arg?: unknown, opts?: unknown) => {
        q.op = op
        q.arg = arg
        q.opts = opts
        return builder
      }
    }
    for (const fn of FILTERS) {
      builder[fn] = (...args: unknown[]) => {
        q.filters.push({ fn, args })
        return builder
      }
    }
    return builder
  }

  fake.client = {
    auth: {
      // The app never destructures `error` off this, but returning it keeps the
      // shape honest.
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    rpc: (name: string, args?: unknown) => fake.rpc(name, args),
    from: (table: string) => chain(table),
  }

  fake.query = (table, op) => {
    const all = fake.queriesFor(table, op)
    return all[all.length - 1]
  }

  fake.queriesFor = (table, op) =>
    fake.queries.filter((q) => q.table === table && (!op || q.op === op))

  fake.reset = () => {
    fake.user = initialUser
    fake.queries.length = 0
    fake.rpc.mockClear()
    fake.rpcReplies = new Map(Object.entries(seed?.rpc ?? {}))
    fake.tableReplies = new Map(Object.entries(seed?.tables ?? {}))
  }

  return fake
}

function settle(reply: Reply | undefined) {
  return { data: null, error: null, count: null, ...reply }
}

/** Carries the claim `public.is_admin()` reads. Service-role writable only. */
export function adminUser(over?: Partial<AuthUser>): AuthUser {
  return {
    id: "staff-1",
    email: "staff@shop.test",
    ...over,
    app_metadata: { role: "admin", ...over?.app_metadata },
  }
}

/** Signed in, but carrying no role claim — an ordinary member. */
export function memberUser(over?: Partial<AuthUser>): AuthUser {
  return {
    id: "member-1",
    email: "member@shop.test",
    app_metadata: {},
    ...over,
  }
}

export function ok<T>(data: T): Reply<T> {
  return { data, error: null }
}

/** A Postgres failure, identified the only way the actions read it: by code. */
export function pgFail(code: string): Reply<never> {
  return { data: null, error: { code, message: `raised ${code}` } }
}
