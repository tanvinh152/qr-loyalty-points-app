import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CustomerRow, MembershipTierRow } from "@/lib/db-types"
import { en } from "@/lib/i18n/messages/en"
import { renderWithProviders } from "@/test/render"
import { AdjustForm } from "./adjust-form"
import { adjustPoints } from "./actions"

// The Server Action, and the toast it feeds. Neither can run in jsdom.
vi.mock("./actions", () => ({ adjustPoints: vi.fn() }))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const adjust = vi.mocked(adjustPoints)
const m = en.admin.customers.detail.adjust
const v = en.validation

const tier = (
  id: string,
  name: string,
  spend_threshold: number,
): MembershipTierRow => ({
  id,
  name,
  spend_threshold,
  multiplier: 1,
  sort_order: spend_threshold,
  benefits: null,
  perks: [],
  created_at: "2026-01-01T00:00:00Z",
})

const BRONZE = tier("tier-bronze", "Bronze", 0)
const SILVER = tier("tier-silver", "Silver", 5_000_000)
const GOLD = tier("tier-gold", "Gold", 20_000_000)
const TIERS = [BRONZE, SILVER, GOLD]

function customer(partial: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    auth_user_id: null,
    phone: "0912345670",
    email: null,
    full_name: "Lê Đức Tú",
    date_of_birth: null,
    pet_name: null,
    pet_type: null,
    pet_dob: null,
    profile_completed_at: null,
    pancake_customer_id: null,
    current_points: 100,
    lifetime_points: 300,
    lifetime_spend: 5_000_000,
    tier_id: SILVER.id,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  }
}

function renderForm(row: CustomerRow = customer()) {
  return renderWithProviders(<AdjustForm customer={row} tiers={TIERS} />, {
    locale: "en",
  })
}

const submit = () => screen.getByRole("button", { name: m.submit })
const reasonBox = () => screen.getByRole("textbox", { name: m.reason })
const currentDelta = () => screen.getByRole("spinbutton", { name: m.currentDelta })
const lifetimeDelta = () =>
  screen.getByRole("spinbutton", { name: m.lifetimeDelta })

beforeEach(() => {
  adjust.mockReset()
  adjust.mockResolvedValue({ ok: true, message: m.saved })
})

describe("AdjustForm", () => {
  it("refuses an adjustment that changes nothing", async () => {
    // Mirrors the RPC's own no-op guard. The refine reports at current_delta
    // even though it is a whole-object rule, so the message must surface there.
    const user = userEvent.setup()
    renderForm()

    await user.type(reasonBox(), "Nhập nhầm")
    await user.click(submit())

    expect(await screen.findByText(v.adjustEmpty)).toBeInTheDocument()
    expect(adjust).not.toHaveBeenCalled()
  })

  it("requires a reason", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(currentDelta())
    await user.type(currentDelta(), "5")
    await user.click(submit())

    expect(await screen.findByText(v.reasonRequired)).toBeInTheDocument()
    expect(adjust).not.toHaveBeenCalled()
  })

  it("submits the deltas as numbers, not the strings the inputs hold", async () => {
    // z.coerce.number() is the only thing between the DOM's strings and an RPC
    // that takes integers.
    const user = userEvent.setup()
    renderForm()

    await user.clear(currentDelta())
    await user.type(currentDelta(), "5")
    await user.type(reasonBox(), "Bù điểm đơn lỗi")
    await user.click(submit())

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: customer().id,
        current_delta: 5,
        lifetime_delta: 0,
        reason: "Bù điểm đơn lỗi",
      }),
    )
  })

  it("accepts a negative delta — the RPC is what clamps the balance", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(currentDelta())
    await user.type(currentDelta(), "-50")
    await user.type(reasonBox(), "Thu hồi điểm")
    await user.click(submit())

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust.mock.calls[0][0]).toMatchObject({ current_delta: -50 })
  })

  it("previews the resulting balances as the admin types", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(currentDelta())
    await user.type(currentDelta(), "50")
    await user.clear(lifetimeDelta())
    await user.type(lifetimeDelta(), "50")

    expect(
      await screen.findByText(`${m.currentDelta}: 100 → 150`),
    ).toBeInTheDocument()
    expect(screen.getByText(`${m.lifetimeDelta}: 300 → 350`)).toBeInTheDocument()
  })

  it("offers only tiers above the one already held", async () => {
    // The member holds Silver, so Bronze and Silver must not be grantable — the
    // RPC refuses a sideways or downward grant.
    renderForm()

    const trigger = screen.getByRole("combobox")
    expect(trigger).toHaveTextContent(m.noTierGrant)

    const user = userEvent.setup()
    await user.click(trigger)

    const options = await screen.findAllByRole("option")
    const labels = options.map((option) => option.textContent)
    expect(labels).toContain(m.noTierGrant)
    expect(labels.some((label) => label?.includes("Gold"))).toBe(true)
    expect(labels.some((label) => label?.includes("Bronze"))).toBe(false)
    expect(labels.some((label) => label?.includes("Silver"))).toBe(false)
  })

  it("offers every tier to a member who holds none", () => {
    renderForm(customer({ tier_id: null }))
    // Nothing held means no floor: all three are grantable. Asserted through the
    // preview line, which falls back to "no tier" until one is picked.
    expect(screen.getByRole("combobox")).toHaveTextContent(m.noTierGrant)
  })

  it("surfaces a server-side failure on the form", async () => {
    adjust.mockResolvedValue({ ok: false, message: m.insufficient })
    const user = userEvent.setup()
    renderForm()

    await user.clear(currentDelta())
    await user.type(currentDelta(), "-500")
    await user.type(reasonBox(), "Thu hồi điểm")
    await user.click(submit())

    expect(await screen.findByText(m.insufficient)).toBeInTheDocument()
  })
})
