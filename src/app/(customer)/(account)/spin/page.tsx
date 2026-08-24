import Link from "next/link"
import {
  ArrowLeft,
  Ban,
  Coins,
  FerrisWheel,
  Gift,
  History,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
import { cn } from "@/lib/utils"
import { getLocale, getMessages } from "@/lib/i18n/server"
import {
  getSpinDailyLimit,
  getSpinHistory,
  getSpinPrizes,
  getSpinsUsedToday,
} from "@/lib/loyalty"
import { getAccount } from "../account"
import { Wheel, type WheelSlice } from "./wheel"

export async function generateMetadata() {
  const t = await getMessages()
  return { title: t.customer.spin.metaTitle }
}

const HISTORY_COUNT = 10

const TYPE_ICONS = {
  points: Coins,
  gift: Gift,
  none: Ban,
} as const

export default async function SpinPage() {
  const t = await getMessages()
  const s = t.customer.spin
  const { customer } = await getAccount()
  // The layout renders the "no points account" notice in this case.
  if (!customer) return null

  const [dailyLimit, prizes] = await Promise.all([
    getSpinDailyLimit(),
    getSpinPrizes(),
  ])

  // Two independent ways for the wheel to be off, and they read the same to a
  // member: the admin set the daily limit to 0, or nothing is left to draw.
  // Both are exactly the states `spin_wheel` would answer with P0005/P0004, so
  // showing a button here would only produce an error on the first click.
  if (dailyLimit <= 0 || prizes.length === 0) {
    return (
      <div className="grid gap-4 sm:gap-6">
        <PageHeader size="display" title={s.title} description={s.subtitle} />
        <SectionCard>
          <EmptyState
            icon={FerrisWheel}
            title={s.offTitle}
            description={s.offBody}
            action={
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "mt-2 rounded-full",
                )}
              >
                {s.backToDashboard}
              </Link>
            }
          />
        </SectionCard>
      </div>
    )
  }

  const [used, history] = await Promise.all([
    getSpinsUsedToday(customer.id),
    getSpinHistory(customer.id, HISTORY_COUNT),
  ])
  const spinsLeft = Math.max(0, dailyLimit - used)

  // Only what the wheel needs crosses to the client — a whole RewardRow would
  // ship the stock and weight of every slice to the browser for nothing.
  const slices: WheelSlice[] = prizes.map((prize) => ({
    id: prize.id,
    name: prize.name,
    prize_type: prize.prize_type,
  }))

  const locale = await getLocale()
  const dateFormat = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  )

  return (
    <div className="grid gap-4 sm:gap-6">
      <PageHeader
        size="display"
        title={s.title}
        description={s.subtitle}
        eyebrow={
          <Badge variant="secondary">
            <Sparkles className="size-3.5" aria-hidden />
            {spinsLeft > 0 ? s.spinsLeft(spinsLeft) : s.spinsLeftHint}
          </Badge>
        }
      >
        {/* /spin is reachable from the dashboard card only — it is not in the
            rail or the bottom bar — so the way back has to be on the page. The
            wheel-is-off branch above already carries the same link. */}
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "muted" }))}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {s.backToDashboard}
        </Link>
      </PageHeader>

      <SectionCard bodyClassName="p-4 sm:p-6 md:p-10">
        <Wheel slices={slices} initialSpinsLeft={spinsLeft} />
      </SectionCard>

      <SectionCard title={s.historyTitle} icon={History}>
        {history.length === 0 ? (
          <EmptyState icon={Gift} title={s.historyEmpty} />
        ) : (
          <ul className="divide-border divide-y">
            {history.map((win) => {
              const Icon = TYPE_ICONS[win.prize_type]
              return (
                <li
                  key={win.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "bg-surface-container grid size-10 shrink-0 place-items-center rounded-xl",
                        win.prize_type === "none"
                          ? "text-muted-foreground"
                          : "text-primary",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-lg truncate">
                        {/* The frozen copy, not a lookup: this has to keep
                            reading the way it read on the day it was won. */}
                        {win.prize_type === "none"
                          ? s.noPrizeLabel
                          : win.prize_name}
                      </p>
                      <p className="text-body-sm text-muted-foreground">
                        {dateFormat.format(new Date(win.created_at))}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {win.prize_type === "points" && (
                      <Badge variant="secondary">
                        {s.pointsChip(win.points_awarded)}
                      </Badge>
                    )}
                    {/* Only a gift is settled by hand, so only a gift can be
                        waiting at the counter. */}
                    {win.prize_type === "gift" && (
                      <Badge variant={win.fulfilled_at ? "success" : "warning"}>
                        {win.fulfilled_at ? s.collectedChip : s.pendingChip}
                      </Badge>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
