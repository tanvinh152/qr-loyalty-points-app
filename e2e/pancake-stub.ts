import { createServer, type Server } from "node:http"

import type { PancakeOrder } from "../src/lib/pancake/types"
import { STUB_API_KEY, stubBaseUrl, stubPort } from "./secrets"

/**
 * A local stand-in for the Pancake POS API.
 *
 * The registration and webhook flows cannot be tested by faking their INPUT.
 * `/api/webhooks/pancake` treats its POST body as a pointer only and re-fetches
 * the order through `getOrder()`; `signUp` does the same to prove the phone.
 * So a "fake" webhook delivery still calls the live POS unless the fetch itself
 * is intercepted.
 *
 * `src/lib/pancake/client.ts:20` reads its base URL from `PANCAKE_API_URL`, and
 * the client touches exactly three endpoints — GET order, GET customer, PUT
 * customer. Pointing that variable at this server therefore closes the flow
 * completely: nothing in the suite can reach pos.pages.fm, because the real host
 * is never named. The PUT recorder below doubles as the proof — a spec asserts
 * `stubWrites()` is empty everywhere except the one signup case where writing
 * back the member's real name and phone is the app's intended behaviour.
 *
 * The server lives in the Playwright RUNNER process (started from global setup)
 * while the app under test is a separate `next dev` process, so staging is done
 * over HTTP through the `/__stub/*` control plane rather than by importing this
 * module's state. Specs use the helpers at the bottom of this file.
 */

type Staged =
  | { kind: "order"; order: PancakeOrder }
  // `status` is what the HTTP layer answers; `success:false` is Pancake's other
  // way of saying "no such order" — a 200 body the client maps to `not_found`.
  | { kind: "status"; status: number }
  | { kind: "successFalse" }

type StubState = {
  orders: Map<string, Staged>
  customers: Map<string, unknown>
  writes: { customerId: string; body: unknown }[]
}

const state: StubState = { orders: new Map(), customers: new Map(), writes: [] }

function reset() {
  state.orders.clear()
  state.customers.clear()
  state.writes.length = 0
}

async function readJson(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } catch {
    return null
  }
}

export function startPancakeStub(): Promise<Server> {
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ success: false, message: "stub_error" }))
    })
  })

  async function handle(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) {
    const url = new URL(req.url ?? "/", stubBaseUrl())
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    }

    // ---- control plane (test-only; never mimics Pancake) ----
    if (url.pathname.startsWith("/__stub/")) {
      if (url.pathname === "/__stub/reset" && req.method === "POST") {
        reset()
        return send(200, { ok: true })
      }
      if (url.pathname === "/__stub/orders" && req.method === "POST") {
        const body = (await readJson(req)) as {
          code: string
          order?: PancakeOrder
          status?: number
          successFalse?: boolean
        } | null
        if (!body?.code) return send(400, { ok: false })
        const staged: Staged = body.order
          ? { kind: "order", order: body.order }
          : body.successFalse
            ? { kind: "successFalse" }
            : { kind: "status", status: body.status ?? 500 }
        // Pancake accepts either identifier for the same order, and `signUp`
        // may be given whichever one the member reads off their receipt.
        state.orders.set(body.code, staged)
        if (body.order?.system_id != null) {
          state.orders.set(String(body.order.system_id), staged)
        }
        return send(200, { ok: true })
      }
      if (url.pathname === "/__stub/customers" && req.method === "POST") {
        const body = (await readJson(req)) as {
          id: string
          customer: unknown
        } | null
        if (!body?.id) return send(400, { ok: false })
        state.customers.set(body.id, body.customer)
        return send(200, { ok: true })
      }
      if (url.pathname === "/__stub/writes" && req.method === "GET") {
        return send(200, { writes: state.writes })
      }
      return send(404, { ok: false })
    }

    // ---- the Pancake surface the client actually calls ----
    // The key is checked so a misconfigured run fails loudly here rather than
    // silently passing every ownership check.
    if (url.searchParams.get("api_key") !== STUB_API_KEY) {
      return send(401, { success: false, message: "unauthorized" })
    }

    const order = url.pathname.match(/^\/shops\/([^/]+)\/orders\/(.+)$/)
    if (order && req.method === "GET") {
      const staged = state.orders.get(decodeURIComponent(order[2]))
      if (!staged) return send(404, { success: false, message: "not_found" })
      if (staged.kind === "status") {
        return send(staged.status, { success: false, message: "staged" })
      }
      if (staged.kind === "successFalse") {
        return send(200, { success: false, data: null })
      }
      return send(200, { success: true, data: staged.order })
    }

    const customer = url.pathname.match(/^\/shops\/([^/]+)\/customers\/(.+)$/)
    if (customer) {
      const id = decodeURIComponent(customer[2])
      if (req.method === "GET") {
        const record = state.customers.get(id)
        if (!record) return send(404, { success: false, message: "not_found" })
        return send(200, { success: true, data: record })
      }
      if (req.method === "PUT") {
        const body = await readJson(req)
        state.writes.push({ customerId: id, body })
        return send(200, { success: true, data: { id, customer_id: id } })
      }
    }

    return send(404, { success: false, message: "not_found" })
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(stubPort(), "127.0.0.1", () => {
      // Otherwise a listening socket keeps the runner alive after the last spec.
      server.unref()
      resolve(server)
    })
  })
}

// ---- spec-side helpers (talk to the control plane over HTTP) ----

async function control(path: string, init?: RequestInit) {
  const res = await fetch(`${stubBaseUrl()}/__stub/${path}`, init)
  if (!res.ok) throw new Error(`pancake stub ${path}: HTTP ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

/** Clears every staged order, customer and recorded write. */
export async function resetStub() {
  await control("reset", { method: "POST" })
}

export async function stageOrder(code: string, order: PancakeOrder) {
  await control("orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, order }),
  })
}

/** Stages a transport-level failure: 404 -> not_found, 500/503 -> unavailable. */
export async function stageOrderFailure(code: string, status: number) {
  await control("orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, status }),
  })
}

/** Pancake's other "unknown order": HTTP 200 carrying `success: false`. */
export async function stageOrderMissing(code: string) {
  await control("orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, successFalse: true }),
  })
}

export async function stageCustomer(id: string, customer: unknown) {
  await control("customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, customer }),
  })
}

/** Every PUT the app has made to Pancake since the last reset. */
export async function stubWrites() {
  const body = await control("writes")
  return body.writes as { customerId: string; body: unknown }[]
}

/**
 * A claimable order fixture.
 *
 * Defaults matter: status 3 is in seed.sql's `claimable_statuses`, and the money
 * is on `total_price_after_sub_discount` because that — not `total_price` — is
 * what `orderSpendTotal()` reads and what the whole point formula is measured
 * on. The phone is carried MASKED, the state a real marketplace order arrives
 * in, so the ownership gate exercises `matchesMask` rather than the exact-match
 * shortcut.
 */
export function orderFixture(
  overrides: Partial<PancakeOrder> & { id: string },
): PancakeOrder {
  return {
    status: 3,
    system_id: null,
    status_name: "đã giao",
    bill_phone_number: null,
    shipping_address: null,
    customer: { customer_id: "pos-cus-default", phone_numbers: ["0****52"] },
    total_price: 500_000,
    total_price_after_sub_discount: 500_000,
    order_sources_name: null,
    items: [],
    ...overrides,
  } as PancakeOrder
}

/** The masked form Pancake returns for a number it has not been told. */
export function maskOf(phone: string): string {
  return `${phone.slice(0, 1)}****${phone.slice(-2)}`
}
