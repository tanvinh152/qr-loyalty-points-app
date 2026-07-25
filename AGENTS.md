<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Loyalty Point App — project map

QR loyalty-point app. Next.js 16 (App Router) + Supabase + Pancake POS + shadcn/ui (Base UI, NOT Radix).

- **Request middleware**: `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`). Guards `/admin`.
- **Supabase clients**: `src/lib/supabase/{client,server,admin,middleware}.ts`. `admin.ts` is service-role, server-only.
- **Pancake POS**: `src/lib/pancake/{client,types}.ts`, server-only. Orders are fetched live and
  never stored. `getOrder()` accepts either identifier (`system_id` or `id`); the canonical
  `id` is what gets persisted as `order_code`. The one WRITE is `updateCustomer()` —
  `PUT /shops/:id/customers/:customer_id` with the body wrapped in `{ customer: … }` (a bare
  object or a POST both answer 400). Reads come back MASKED (`name: "K******h"`), so nothing
  read from a customer record may be treated as a real name or phone.
- **Earning flow**: there is NO manual claim screen. `/register` collects full name, DOB, phone
  and a recent order code; `signUp` (`src/app/(customer)/auth/actions.ts`) proves the phone via
  `matchesOrderPhones`, claims that order, writes `customers.pancake_customer_id`
  (`linkPancakeCustomer` in `src/lib/loyalty.ts`) and pushes the real name + phone to Pancake.
  Every later order is credited by `src/app/api/webhooks/pancake/route.ts`, which can only
  attribute orders whose `customer.customer_id` matches that link. The Pancake write only fills
  what the POS lacks (`isMasked` in `src/lib/phone.ts` decides); a signup whose order belongs to
  an already-linked POS customer is refused. A signup that died before linking leaves an auth
  user with no `customers` row — `find_orphan_auth_user` (`0009`) is what lets the next attempt
  adopt it instead of the phone being stuck on "already registered" forever.
- **Admin**: `src/app/admin/` — `login/`, `settings/`, `tiers/`, `products/`, `rewards/`,
  `customers/`, `transactions/`, protected `layout.tsx`.
- **Customer accounts**: `src/app/(customer)/{login,register,auth}` + the `(account)` group
  (`dashboard/`, `rewards/`, `tiers/`, `history/`, `help/`, `profile/`). Auth is phone +
  password, but Supabase Auth is email-keyed: `/register` REQUIRES a real email, stores it on
  `auth.users` AND `customers.email`, and `signIn` resolves phone → `customers.email` before
  `signInWithPassword` (`0014`). Nothing is ever mailed. Admin vs customer is
  the JWT claim `app_metadata.role === 'admin'` (`public.is_admin()` in `0005`); both portals
  are guarded in `src/lib/supabase/middleware.ts`. Customers still have NO direct write path to
  `public.customers` — redemption goes through `redeem_reward` (`0006`) and the profile form
  through `update_customer_profile` (`0007`), both service-role only like `claim_points`.
  `/tiers` renders all five member mockups from one route: the gem accent is picked by tier
  *rank*, never by name (`src/app/(customer)/(account)/tier-accent.ts`).
- **Tiers are SPEND, points are currency**: `membership_tiers.spend_threshold` is đồng measured
  against `customers.lifetime_spend` (`0010`); `lifetime_points` only buys rewards and decides
  NOTHING about a tier. `customers.tier_id` is the HIGHEST TIER EVER HELD — sticky, only ever
  raised, by `claim_points` (`0011`) or a direct admin grant (`0012`). Thresholds only ever go up,
  via `tier_threshold_schedules` applied by `apply_due_tier_schedules()`, which never touches
  `customers.tier_id` — that omission IS the grandfathering. A `percentile` schedule ("top 5%")
  is resolved to a đồng amount at apply time and frozen. Nothing may fake spend to force a tier:
  `tier_percentile_amount()` ranks the member base by that column. Schedules fire from the cron
  route `/api/cron/tier-schedules` AND fire-and-forget on an `/admin/tiers` render. UI must call
  `resolveDisplayTier`/`tierProgress(tiers, spend, customer)`, never the raw earned tier.
- **DB**: `supabase/migrations/*.sql` + `supabase/seed.sql`. Claim atomicity lives in the
  `claim_points` RPC — the ONLY write path for a claim. Never bypass it. It is granted to
  `service_role` ONLY (it trusts the item list it is handed) — call it with `createAdminClient()`.
  Order money reaches it as `p_order_total` (`orderSpendTotal()` in `src/lib/pancake/client.ts`).
- **Point calc**: lives ONLY in `claim_points` (`0011_claim_spend.sql`). `src/lib/points.ts`
  is types now — the TS copy of the arithmetic was deleted because nothing called it. Do not
  reintroduce a second implementation; if the admin UI ever needs a preview, call the RPC.
- **Ownership gate**: `matchesOrderPhones` in `src/lib/phone.ts`, over
  `orderPhoneCandidates(order)`. Pancake masks phones as `0****70`, but `customer.phone_numbers`
  also holds the real one once the record has it — when a real number is present it is compared
  EXACTLY and the masks beside it are ignored; `matchesMask` is only the fallback. Never return
  customer point data before it passes. Rate limiting: `src/lib/rate-limit.ts`.
- **i18n**: cookie-driven, Vietnamese default. `src/lib/i18n/messages/en.ts` is the source of
  truth; `vi.ts` is typed against it, so add keys to both.
- **Design system**: dark-only "Chicha Pet Members" (`design/stitch-v2/README.md`). Tokens live
  in `src/app/globals.css` `:root`; the token NAMES are inherited from the old light system, so
  pages use `bg-card` / `text-muted-foreground` and never a literal hex. `globals.css` carries
  `@source not "../../design"`: without it Tailwind compiles the mockups' CDN classes and the
  build fails on their `url()` references.
- shadcn Button is Base UI: NO `asChild`. Use `buttonVariants` on a Link (see `src/components/page-link.tsx`).
