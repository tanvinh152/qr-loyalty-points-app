import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { en } from "@/lib/i18n/messages/en"
import { renderWithProviders } from "@/test/render"
import { tier } from "@/test/factories"
import { CancelSchedule, ScheduleDialog } from "./schedule-form"
import {
  cancelTierSchedule,
  previewPercentileAmount,
  saveTierSchedule,
} from "./actions"

// This form decides which of TWO MUTUALLY EXCLUSIVE columns carries the number
// that later moves a whole tier's spend threshold. Get it wrong and either the
// check constraint in 0010 refuses the row, or the wrong rule is queued against
// the entire member base.

vi.mock("./actions", () => ({
  saveTierSchedule: vi.fn(),
  previewPercentileAmount: vi.fn(),
  cancelTierSchedule: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const save = vi.mocked(saveTierSchedule)
const preview = vi.mocked(previewPercentileAmount)
const cancel = vi.mocked(cancelTierSchedule)
const m = en.admin.tiers

const TIERS = [
  tier({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Bạc",
    sort_order: 1,
  }),
  tier({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Vàng",
    sort_order: 2,
  }),
]

async function open() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderWithProviders(<ScheduleDialog tiers={TIERS} />, { locale: "en" })
  await user.click(screen.getByRole("button", { name: m.scheduleTitle }))
  await screen.findByLabelText(m.effectiveAt)
  return user
}

/** The Select that flips the two mutually exclusive columns. */
async function chooseMode(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("combobox", { name: m.scheduleMode }))
  await user.click(await screen.findByRole("option", { name: label }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  save.mockReset()
  save.mockResolvedValue({ ok: true, message: m.scheduleSaved })
  preview.mockReset()
  preview.mockResolvedValue(12_500_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("only the column the chosen mode uses is offered", () => {
  // 0010 insists the unused column is NULL. Rendering both fields would invite
  // a payload the database refuses.
  it("shows the amount field and hides the percentile one", async () => {
    await open()
    expect(screen.getByLabelText(m.targetAmount)).toBeInTheDocument()
    expect(screen.queryByLabelText(m.targetPercentile)).not.toBeInTheDocument()
  })

  it("swaps them when the mode changes", async () => {
    const user = await open()
    await chooseMode(user, m.percentileMode)

    expect(await screen.findByLabelText(m.targetPercentile)).toBeInTheDocument()
    expect(screen.queryByLabelText(m.targetAmount)).not.toBeInTheDocument()
  })
})

describe("nothing is queued from an incomplete form", () => {
  it("refuses an amount schedule with no amount", async () => {
    const user = await open()
    await user.type(screen.getByLabelText(m.effectiveAt), "2026-03-01T00:00")
    await user.click(screen.getByRole("button", { name: m.scheduleSubmit }))

    await waitFor(() => expect(save).not.toHaveBeenCalled())
  })

  it("refuses a percentile schedule with no percentile", async () => {
    const user = await open()
    await chooseMode(user, m.percentileMode)
    await user.type(screen.getByLabelText(m.effectiveAt), "2026-03-01T00:00")
    await user.click(screen.getByRole("button", { name: m.scheduleSubmit }))

    await waitFor(() => expect(save).not.toHaveBeenCalled())
  })

  it("refuses a schedule with no effective date", async () => {
    const user = await open()
    await user.type(screen.getByLabelText(m.targetAmount), "5000000")
    await user.click(screen.getByRole("button", { name: m.scheduleSubmit }))

    await waitFor(() => expect(save).not.toHaveBeenCalled())
  })
})

describe("what a completed form sends", () => {
  it("queues an amount raise", async () => {
    const user = await open()
    await user.type(screen.getByLabelText(m.targetAmount), "5000000")
    await user.type(screen.getByLabelText(m.effectiveAt), "2026-03-01T00:00")
    await user.click(screen.getByRole("button", { name: m.scheduleSubmit }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "amount", target_amount: 5_000_000 }),
      ),
    )
  })

  // Switching mode hides the amount field but does NOT clear the value behind
  // it, so a stale target_amount still rides along in the payload. That is
  // survivable only because `saveTierSchedule` nulls whichever column the mode
  // does not use before the insert — see
  // `src/app/admin/tiers/actions.test.ts` > "nulls the amount column even when
  // the form still carried one". This test pins BOTH halves of that contract:
  // the form is not the place the constraint is honoured, the action is.
  it("sends the chosen mode, and leaves stripping the stale column to the server", async () => {
    const user = await open()
    await user.type(screen.getByLabelText(m.targetAmount), "5000000")
    await chooseMode(user, m.percentileMode)
    await user.type(await screen.findByLabelText(m.targetPercentile), "5")
    await user.type(screen.getByLabelText(m.effectiveAt), "2026-03-01T00:00")
    await user.click(screen.getByRole("button", { name: m.scheduleSubmit }))

    await waitFor(() => expect(save).toHaveBeenCalled())
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sent.mode).toBe("percentile")
    expect(sent.target_percentile).toBe(5)
    // If this ever becomes null, the form started clearing it — good, but then
    // the action's own guard is the one that still has to be kept.
    expect(sent.target_amount).toBe(5_000_000)
  })
})

describe("the percentile preview", () => {
  // 0% selects nobody and 100% the whole base; neither is a tier. Asking the
  // server about them would leak a query for a figure that cannot be used.
  it.each([["0"], ["100"]])("does not ask about %s%%", async (value) => {
    const user = await open()
    await chooseMode(user, m.percentileMode)
    await user.type(await screen.findByLabelText(m.targetPercentile), value)

    vi.advanceTimersByTime(1000)
    await waitFor(() => expect(preview).not.toHaveBeenCalled())
  })

  // The field is typed into digit by digit. Without the debounce the admin
  // reads "5%" prices while typing "50".
  it("asks once, for the number actually left in the field", async () => {
    const user = await open()
    await chooseMode(user, m.percentileMode)

    const field = await screen.findByLabelText(m.targetPercentile)
    await user.type(field, "5")
    await user.type(field, "0")

    vi.advanceTimersByTime(500)

    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1))
    expect(preview).toHaveBeenCalledWith(50)
  })

  // The answer is tagged with the percentile it belongs to, so a late reply for
  // a half-typed number can never sit beside a different one.
  it("shows the figure for the number it was asked about", async () => {
    const user = await open()
    await chooseMode(user, m.percentileMode)
    await user.type(await screen.findByLabelText(m.targetPercentile), "5")

    vi.advanceTimersByTime(500)

    // Matched on the figure rather than the whole sentence: formatVnd emits a
    // narrow no-break space that Testing Library's normalizer leaves alone.
    expect(await screen.findByText(/12[.,]500[.,]000/)).toBeInTheDocument()
  })

  it("says so plainly when nobody has spent anything yet", async () => {
    preview.mockResolvedValue(0)
    const user = await open()
    await chooseMode(user, m.percentileMode)
    await user.type(await screen.findByLabelText(m.targetPercentile), "5")

    vi.advanceTimersByTime(500)

    expect(await screen.findByText(m.schedulePreviewEmpty)).toBeInTheDocument()
  })
})

// Cancelling drops a dated business decision that has to be re-entered by
// hand. It was the one destructive control in the portal that fired on a
// single click.
describe("cancelling a queued raise", () => {
  beforeEach(() => {
    cancel.mockReset()
    cancel.mockResolvedValue({ ok: true, message: m.scheduleCanceled })
  })

  it("asks first, and touches nothing until the dialog's own action is used", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithProviders(<CancelSchedule id="sched-1" tierName="Vàng" />, {
      locale: "en",
    })

    await user.click(screen.getByRole("button", { name: m.scheduleCancel }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(m.scheduleCancelBody("Vàng"))
    expect(cancel).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", { name: m.scheduleCancelConfirm }),
    )
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("sched-1"))
  })

  it("leaves the raise alone on cancel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithProviders(<CancelSchedule id="sched-1" tierName="Vàng" />, {
      locale: "en",
    })

    await user.click(screen.getByRole("button", { name: m.scheduleCancel }))
    await screen.findByRole("alertdialog")
    await user.click(screen.getByRole("button", { name: en.common.cancel }))

    expect(cancel).not.toHaveBeenCalled()
  })
})
