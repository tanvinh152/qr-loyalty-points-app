// Temporary verification helper: seeds the rows the new admin screens read, so
// their rendering can be checked against real data. Deleted after the check.
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=")
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ]
    }),
)

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const [cmd, ...args] = process.argv.slice(2)

if (cmd === "seed") {
  const { data: customer } = await db
    .from("customers")
    .select("id, phone, full_name")
    .eq("phone", "0376733152")
    .maybeSingle()
  console.log("customer:", customer)

  const { data: ticket, error: e1 } = await db
    .from("support_requests")
    .insert({
      customer_id: customer?.id ?? null,
      name: customer?.full_name ?? "Test customer",
      email: "test@example.com",
      topic: "points",
      message: "Điểm đơn hàng 8661 chưa được cộng.\nNhờ shop kiểm tra giúp.",
    })
    .select()
    .single()
  console.log("ticket:", e1?.message ?? ticket.id, ticket?.status)

  const { data: rewards } = await db
    .from("rewards")
    .select("id, name, points_cost")
    .order("points_cost")
    .limit(2)
  console.log("rewards:", rewards)
  if (rewards?.[0]) {
    const { error: e2 } = await db
      .from("rewards")
      .update({
        category: "pate",
        original_points_cost: rewards[0].points_cost + 50,
        is_exclusive: true,
        is_featured: true,
        is_active: true,
      })
      .eq("id", rewards[0].id)
    console.log("reward0 update:", e2?.message ?? "ok")
  }
  if (rewards?.[1]) {
    // Must trip rewards_one_featured (23505) — the case saveReward now reports.
    const { error: e3 } = await db
      .from("rewards")
      .update({ is_featured: true, is_active: true })
      .eq("id", rewards[1].id)
    console.log("reward1 featured conflict code:", e3?.code, e3?.message)
  }

  const { data: tier } = await db
    .from("membership_tiers")
    .select("id, name")
    .order("threshold")
    .limit(1)
    .single()
  const { error: e4 } = await db
    .from("membership_tiers")
    .update({
      perks: [
        { icon: "percent", title: "Giảm 10% mọi đơn", detail: "Áp dụng tự động" },
        { icon: "truck", title: "Miễn phí vận chuyển", detail: null },
        { icon: "cake", title: "Quà sinh nhật boss", detail: "Mỗi năm một lần" },
        { icon: "unknown-key", title: "Icon lạ để test fallback", detail: null },
      ],
    })
    .eq("id", tier.id)
  console.log("tier perks:", tier.name, e4?.message ?? "ok")
}

if (cmd === "close") {
  const { error, count } = await db
    .from("support_requests")
    .update({ status: "closed" }, { count: "exact" })
    .eq("id", args[0])
  console.log("close:", error?.message ?? `rows=${count}`)
}

if (cmd === "cleanup") {
  await db.from("support_requests").delete().eq("email", "test@example.com")
  console.log("tickets removed")
}
