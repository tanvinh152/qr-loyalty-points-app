import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { en } from "@/lib/i18n/messages/en"
import { renderWithProviders } from "@/test/render"
import { reward, tier } from "@/test/factories"
import { RewardCard } from "./reward-card"
import { redeemReward } from "./actions"

// The one screen where a member spends points. The disabled matrix and the
// confirmation dialog are the whole of what stands between a tap and a debit
// that cannot be undone — there is no refund path anywhere in this app.

vi.mock("./actions", () => ({ redeemReward: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { toast } = await import("sonner")
const redeem = vi.mocked(redeemReward)
const r = en.customer.rewards

const GOLD = tier({ id: "tier-gold", name: "Gold", spend_threshold: 3_000_000 })
const VOUCHER = reward({ id: "reward-1", name: "Voucher", points_cost: 500 })

function show(props: Partial<Parameters<typeof RewardCard>[0]> = {}) {
  return renderWithProviders(
    <RewardCard reward={VOUCHER} currentPoints={500} {...props} />,
    { locale: "en" },
  )
}

const trigger = () =>
  screen.getByRole("button", {
    name: new RegExp(`${r.redeem}|${r.notEnough}|Requires`, "i"),
  })

beforeEach(() => {
  redeem.mockReset()
  redeem.mockResolvedValue({
    ok: true,
    rewardName: "Voucher",
    pointsSpent: 500,
    currentPoints: 0,
  })
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe("when a member may not redeem", () => {
  it("blocks a sold-out reward", () => {
    show({ reward: reward({ quantity: 0 }) })
    expect(trigger()).toBeDisabled()
  })

  it("blocks and explains an unaffordable reward", () => {
    show({ currentPoints: 499 })
    const button = trigger()
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(r.notEnough)
  })

  it("blocks a tier-gated reward and names the tier needed", () => {
    show({ lockedFor: GOLD })
    const button = trigger()
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(r.tierRequired("Gold"))
  })

  // The boundary. The check is `currentPoints < points_cost`, so exactly enough
  // must be enough — an off-by-one here refuses a member their own points.
  it("allows a member holding exactly the price", () => {
    show({ currentPoints: 500 })
    expect(trigger()).toBeEnabled()
  })

  // One `action` node is rendered by three call sites. A guard that only held
  // in the shop card would leave the dashboard tiles redeemable.
  it.each(["card", "row", "feature"] as const)(
    "keeps the guard in the %s variant",
    (variant) => {
      show({ variant, currentPoints: 0 })
      expect(trigger()).toBeDisabled()
    },
  )
})

describe("the confirmation gate", () => {
  it("opens the dialog without spending anything", async () => {
    const user = userEvent.setup()
    show()

    await user.click(trigger())

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(redeem).not.toHaveBeenCalled()
  })

  it("spends only once the dialog's own action is used", async () => {
    const user = userEvent.setup()
    show()

    await user.click(trigger())
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: r.redeem }))

    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1))
  })

  // The client sends the reward id and nothing else: not a price, not a
  // customer id. Whose balance moves is resolved from the session on the server.
  it("sends the reward id alone", async () => {
    const user = userEvent.setup()
    show()

    await user.click(trigger())
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: r.redeem }))

    await waitFor(() => expect(redeem).toHaveBeenCalledWith("reward-1"))
    expect(redeem.mock.calls[0]).toHaveLength(1)
  })

  it("leaves the member a way out", async () => {
    const user = userEvent.setup()
    show()

    await user.click(trigger())
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: en.common.cancel }))

    expect(redeem).not.toHaveBeenCalled()
  })
})

describe("what the member is told afterwards", () => {
  async function confirm() {
    const user = userEvent.setup()
    show()
    await user.click(trigger())
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: r.redeem }))
  }

  it("celebrates only a real success", async () => {
    await confirm()
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(r.success("Voucher")),
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  // The server's message is the specific one ("out of stock", "not enough
  // points"); swallowing it for a generic failure would leave the member
  // guessing why their points did not move.
  it("surfaces the server's reason verbatim on a refusal", async () => {
    redeem.mockResolvedValue({
      ok: false,
      code: "out_of_stock",
      error: r.outOfStock,
    })
    await confirm()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(r.outOfStock))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
