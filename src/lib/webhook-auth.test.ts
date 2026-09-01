import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  WEBHOOK_SECRET_HEADER,
  verifyCronRequest,
  verifyWebhookSecret,
} from "./webhook-auth"

// This module is the ONLY thing standing in front of /api/webhooks/pancake and
// /api/cron/daily. Pancake does not sign its deliveries, so a shared secret is
// the strongest scheme available — which makes every branch below load-bearing.
//
// The `unit` project does not set `unstubEnvs`, so the env has to be put back by
// hand or one test's secret leaks into the next.

const SECRET = "webhook-s3cret"
const CRON = "cron-s3cret-and-longer"

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://shop.test/api/webhooks/pancake", {
    method: "POST",
    headers,
  })
}

beforeEach(() => {
  vi.stubEnv("WEBHOOK_SECRET", SECRET)
  vi.stubEnv("CRON_SECRET", CRON)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("verifyWebhookSecret", () => {
  it("accepts the exact shared secret", () => {
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: SECRET }))).toBe(
      true,
    )
  })

  // A prefix or `startsWith` compare would pass this. timingSafeEqual does not.
  it("refuses a wrong value of the same length", () => {
    const wrong = "X".repeat(SECRET.length)
    expect(wrong).toHaveLength(SECRET.length)
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: wrong }))).toBe(
      false,
    )
  })

  // timingSafeEqual THROWS on a length mismatch, so the early return guarding it
  // is not an optimisation — without it the endpoint 500s on every bad guess.
  it("refuses a wrong value of a different length without throwing", () => {
    expect(() =>
      verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "short" })),
    ).not.toThrow()
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "short" }))).toBe(
      false,
    )
  })

  it("refuses a request carrying no secret header at all", () => {
    expect(verifyWebhookSecret(req())).toBe(false)
  })

  it("refuses an empty header value rather than reading it as a match", () => {
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "" }))).toBe(false)
  })

  // The most dangerous branch in the file. Drop the `!expected` guard and an
  // unset secret makes "" === "" true, opening both routes to the world.
  it("fails closed when WEBHOOK_SECRET is unset, header or not", () => {
    vi.stubEnv("WEBHOOK_SECRET", "")
    expect(verifyWebhookSecret(req())).toBe(false)
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "" }))).toBe(false)
    expect(
      verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "undefined" })),
    ).toBe(false)
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: SECRET }))).toBe(
      false,
    )
  })

  it("matches the header name case-insensitively, as Headers does", () => {
    expect(verifyWebhookSecret(req({ "X-Webhook-Secret": SECRET }))).toBe(true)
  })

  // The compare runs over UTF-8 BYTES, not code units: "sécret" is 6 characters
  // but 7 bytes. A 6-byte guess must be rejected by the length check rather than
  // reaching timingSafeEqual and throwing.
  it("compares UTF-8 bytes, not string length", () => {
    vi.stubEnv("WEBHOOK_SECRET", "sécret")
    expect("sécret").toHaveLength(6)
    expect(Buffer.from("sécret")).toHaveLength(7)

    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "sécret" }))).toBe(
      true,
    )
    expect(() =>
      verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "abcdef" })),
    ).not.toThrow()
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: "abcdef" }))).toBe(
      false,
    )
  })

  // The two budgets do not cross. Pancake will never send Bearer, so the webhook
  // must not accept the cron credential under any header.
  it("does not accept the cron secret", () => {
    expect(verifyWebhookSecret(req({ [WEBHOOK_SECRET_HEADER]: CRON }))).toBe(
      false,
    )
    expect(
      verifyWebhookSecret(req({ authorization: `Bearer ${CRON}` })),
    ).toBe(false)
  })
})

describe("verifyCronRequest", () => {
  it("accepts the webhook header, which is the manual/internal call", () => {
    expect(verifyCronRequest(req({ [WEBHOOK_SECRET_HEADER]: SECRET }))).toBe(
      true,
    )
  })

  // What Vercel Cron sends automatically once CRON_SECRET is a project env var.
  it("accepts Authorization: Bearer <CRON_SECRET>", () => {
    expect(verifyCronRequest(req({ authorization: `Bearer ${CRON}` }))).toBe(
      true,
    )
  })

  it("requires the Bearer prefix", () => {
    expect(verifyCronRequest(req({ authorization: CRON }))).toBe(false)
  })

  it("refuses an empty Bearer token", () => {
    expect(verifyCronRequest(req({ authorization: "Bearer " }))).toBe(false)
  })

  // Pins the prefix as case-SENSITIVE. RFC 7235 says the scheme is
  // case-insensitive, but Vercel always sends "Bearer" — if this ever needs to
  // change, it is a deliberate decision, not a test to quietly relax.
  it("does not accept a lowercase bearer prefix", () => {
    expect(verifyCronRequest(req({ authorization: `bearer ${CRON}` }))).toBe(
      false,
    )
  })

  it("fails closed when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "")
    expect(verifyCronRequest(req({ authorization: "Bearer anything" }))).toBe(
      false,
    )
    expect(verifyCronRequest(req({ authorization: "Bearer " }))).toBe(false)
  })

  it("refuses everything when both secrets are unset", () => {
    vi.stubEnv("WEBHOOK_SECRET", "")
    vi.stubEnv("CRON_SECRET", "")
    expect(
      verifyCronRequest(
        req({
          [WEBHOOK_SECRET_HEADER]: SECRET,
          authorization: `Bearer ${CRON}`,
        }),
      ),
    ).toBe(false)
  })

  it("refuses a Bearer token of a different length without throwing", () => {
    expect(() =>
      verifyCronRequest(req({ authorization: "Bearer nope" })),
    ).not.toThrow()
    expect(verifyCronRequest(req({ authorization: "Bearer nope" }))).toBe(false)
  })

  it("does not accept the webhook secret as a Bearer token", () => {
    expect(verifyCronRequest(req({ authorization: `Bearer ${SECRET}` }))).toBe(
      false,
    )
  })
})
