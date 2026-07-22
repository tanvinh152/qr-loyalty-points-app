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
  `id` is what gets persisted as `order_code`.
- **Claim flow**: `src/app/(customer)/(account)/claim/` — signed-in only, inside the account
  layout. `actions.ts` (`previewClaim`, `submitClaim`), `claim-form.tsx`. The form asks for the
  order code ONLY: the phone is the session customer's, and both actions re-run the
  `matchesMask` ownership check against the order. Server reads live in `src/lib/loyalty.ts`.
- **Admin**: `src/app/admin/` — `login/`, `settings/`, `tiers/`, `products/`, `rewards/`,
  `customers/`, `transactions/`, protected `layout.tsx`.
- **Customer accounts**: `src/app/(customer)/{login,register,auth}` + the `(account)` group
  (`dashboard/`, `claim/`, `rewards/`, `tiers/`, `history/`, `help/`, `profile/`). Auth is phone +
  password via a synthetic email (`phoneToEmail` in `src/lib/phone.ts`). Admin vs customer is
  the JWT claim `app_metadata.role === 'admin'` (`public.is_admin()` in `0005`); both portals
  are guarded in `src/lib/supabase/middleware.ts`. Customers still have NO direct write path to
  `public.customers` — redemption goes through `redeem_reward` (`0006`) and the profile form
  through `update_customer_profile` (`0007`), both service-role only like `claim_points`.
  `/tiers` renders all five member mockups from one route: the gem accent is picked by tier
  *rank*, never by name (`src/app/(customer)/(account)/tier-accent.ts`).
- **DB**: `supabase/migrations/*.sql` + `supabase/seed.sql`. Claim atomicity lives in the
  `claim_points` RPC — the ONLY write path for a claim. Never bypass it. It is granted to
  `service_role` ONLY (it trusts the item list it is handed) — call it with `createAdminClient()`.
- **Point calc**: `src/lib/points.ts` MUST stay in sync with the SQL in `0003_claim_rpc.sql`.
- **Ownership gate**: `matchesMask` in `src/lib/phone.ts` (Pancake masks phones as `0****70`).
  Never return customer point data before it passes. Rate limiting: `src/lib/rate-limit.ts`.
- **i18n**: cookie-driven, Vietnamese default. `src/lib/i18n/messages/en.ts` is the source of
  truth; `vi.ts` is typed against it, so add keys to both.
- **Design system**: dark-only "Chicha Pet Members" (`design/stitch-v2/README.md`). Tokens live
  in `src/app/globals.css` `:root`; the token NAMES are inherited from the old light system, so
  pages use `bg-card` / `text-muted-foreground` and never a literal hex. `globals.css` carries
  `@source not "../../design"`: without it Tailwind compiles the mockups' CDN classes and the
  build fails on their `url()` references.
- shadcn Button is Base UI: NO `asChild`. Use `buttonVariants` on a Link (see `src/components/page-link.tsx`).
