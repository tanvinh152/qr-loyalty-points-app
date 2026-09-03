<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Loyalty Point App — project map

QR loyalty-point app. Next.js 16 (App Router) + Supabase + Pancake POS + a UI layer built on
**Animate UI** over **Radix** (`radix-ui`, the unified package) + **`motion`**. Base UI was ripped
out on 2026-09-01 and Animate UI was adopted the same day.

- **Animate UI is VENDORED, via its CLI.** `npx shadcn@latest add @animate-ui/<slug>`, with the
  registry declared in `components.json`. Because `aliases.components` is `@/components`, targets
  like `components/animate-ui/primitives/radix/dialog.tsx` land **inside** `src/`, not outside it;
  `hooks/*` land in `src/hooks/`, `lib/*` in `src/lib/`. (An earlier note here claimed the opposite
  — it was wrong.) Only the `primitives-*` and `icons-*` layers are taken. The `components-*` layer
  is stock shadcn styling that fights the Azure Paw ladder, and stacking our shim on theirs makes
  `tailwind-merge` arbitrate every class twice.
- **Three layers.** `src/components/animate-ui/` (vendored, normalised, owns the motion) →
  `src/components/ui/` (this app's API and its class strings) → ~68 consumers, whose
  `@/components/ui/x` imports did not change and must not have to.
- **`ui/` is MIXED-PROVENANCE, and that is finished, not half-done.** On Animate UI: `dialog`,
  `alert-dialog`, `tooltip`, `checkbox`, `menu`, `button`, `progress`, `drawer`, `accordion`.
  Still plain Radix or plain markup: `select`, `avatar`, `input`, `label`, `textarea`, `table`,
  `form`, `badge`, `alert`, `sonner` — **because Animate UI ships no such component.** Checked
  against the registry; do not go looking, and do not "finish the migration".
- **ICONS are a THIN OVERLAY on lucide, and that is permanent** (added 2026-09-01).
  `lucide-react` is still the base library and `components.json` still says `"iconLibrary": "lucide"`:
  Animate UI ships 260 icons, `src/**` uses 93 distinct ones, and only **39** overlap. The registry
  has no `gift` (16 uses, the most-used glyph here), no `paw-print` (the brand mark), and no
  `receipt`, `newspaper`, `medal`, `coins`, `wallet`, `mail`, `info`, `home`, `trending-up`,
  `pencil`, `eye`/`eye-off`, `hand`, `undo-2`, `inbox`, `ferris-wheel`, `help-circle`, `history`, or
  any calendar icon. Checked against `https://animate-ui.com/r/registry.json` — do not go looking,
  and do not "finish the migration".
  The rule for which glyph animates is **animation follows interaction, not availability**: an icon
  is animated only when it is a CONTROL'S OWN affordance and every glyph in that control group is
  covered. Ten icons across eight surfaces qualify — the theme toggle, the sidebar collapse toggle,
  pagination, the header back link, the search field, the dialog close button, `ConfirmDelete`, the
  schedule form's remove-row button and the help form's submit. A content icon (a `StatCard` chip,
  an `EmptyState` glyph, a `SectionCard` header) is static, always.
  Four surfaces are excluded ON PURPOSE and must stay that way:
  - `portal-nav.tsx`'s ICONS map — only 5 of its 13 keys exist upstream, and the rail is the
    most-seen surface in the app. `account-menu` / `admin-menu` share that glyph set.
  - `portal-identity.tsx`'s chevron — it carries `group-data-[state=open]:rotate-180`, and Motion
    writes `transform` INLINE, which beats the class. Same double-transform bug as
    `active:scale-[.98]` + `tapScale`.
  - `pending-icon.tsx` / `ui/sonner.tsx`'s `Loader2` — `animate-spin` is deliberately EXEMPT from the
    reduced-motion collapse in `globals.css`, and a Motion-driven spinner would be frozen by
    `MotionConfig reducedMotion="user"`. That exemption is the whole point; do not undo it.
  - the admin forms' `Plus`/`Pencil` triggers — two states of the same button, and `pencil` is absent.
  Wiring: hover must be read on the CONTROL, not the glyph (a `size-4` icon does not cover its
  button's padding), so the control is wrapped in `<AnimateIcon animateOnHover asChild>`. That path
  is safe — `icon.tsx`'s own `composeEventHandlers` COMPOSES with the child's handlers rather than
  overwriting them, unlike Animate UI's `Slot`. `asChild` is not optional on a block child: the
  default renders an inline `m.span`, which would put a field inside an inline box (`ui/input.tsx`).
  Sizing needs nothing: Animate UI defaults `size = 28` and writes width/height ATTRIBUTES, which the
  existing `className="size-N"` overrides in CSS, so every call site keeps its old API.
  `src/components/ui/icon.ts` holds `AppIcon`, the icon-as-a-prop type for the four components that
  RECEIVE a glyph (`StatCard`, `EmptyState`, `SectionCard`, `Input`). It replaced `LucideIcon`, which
  stopped being true the moment one of them was handed an Animate UI icon — the two libraries share
  no props type.
  `icons/icon.tsx` carries a file-scoped `eslint-disable` for `react-hooks/refs` and
  `react-hooks/set-state-in-effect`. Both fire on upstream code; the refs hits are false positives
  (`composeEventHandlers` only stores the callback), and it is scoped rather than fixed so the file
  stays diffable.
- **A SERVER component's `asChild` child is not an element — it is a Flight LAZY CHUNK.** React
  outlines a large enough prop into its own chunk and hands the client a `Symbol(react.lazy)`
  wrapper, so `React.isValidElement` is FALSE in the SSR pass and true in the browser, where the
  chunk has resolved. Upstream's `primitives/animate/slot.tsx` bails to `null` on that, which
  rendered NOTHING on the server and the real element on the client — a hydration mismatch on every
  page carrying a search field. The file now falls back to rendering `children` untouched instead:
  a Slot merges only handlers and a ref, which emit no HTML, so the markup is identical and the
  wrapper is merely inert for that one server pass. `slot.test.tsx` is the guard.
  Whether a call site trips it is a SIZE heuristic — `ui/input.tsx`'s long class string is outlined,
  `page-link.tsx`'s is not — so it is NOT something a call site can be trusted to avoid, and the two
  server-side `AnimateIcon … asChild` call sites stay as they are. Radix's `Slot` has the same blind
  spot, which is the second reason Button's `asChild` branch is client-only.
- **The post-install pass is mandatory** before a vendored file is committed: rewrite `motion.` →
  `m.` (including `motion.create`), run Prettier, confirm `cn` comes from `@/lib/utils`, audit
  `data-slot` names against what the tests query, and delete sub-components nothing uses along with
  their registry dependencies. Motion overrides belong in the `ui/` shim as default props, NOT as
  edits to the vendored file, so the vendored tree stays diffable against upstream — but the file
  is ours and may be patched outright when upstream lacks an API we need (`asChild` on
  `DropdownMenuItem`, a renameable `data-slot` on `SheetContent`).
- Re-running `add` for one item **rewrites the shared files** (`use-controlled-state`,
  `get-strict-context`, `animate/slot`), which carry local fixes. Back them up and restore after
  every install, and diff `package.json` + the lockfile for dependency churn.
- **`drawer` lost swipe-to-dismiss.** It was `vaul`; it is now `primitives-radix-sheet`, which has
  no drag, no velocity dismiss, no nested-scroll yielding, no iOS scroll-lock. That is a real
  regression on a phone-first app, taken deliberately to keep one engine. `vaul` stays in
  `package.json`: reverting is one file.

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
- **Customer accounts**: `src/app/(customer)/{login,register,auth}` + the `(account)` group
  (`dashboard/`, `rewards/`, `tiers/`, `history/`, `help/`, `profile/`). Auth is phone +
  password, but Supabase Auth is email-keyed: `/register` REQUIRES a real email, stores it on
  `auth.users` AND `customers.email`, and `signIn` resolves phone → `customers.email` before
  `signInWithPassword` (`0014`). Nothing is ever mailed. Admin vs customer is
  the JWT claim `app_metadata.role === 'admin'` (`public.is_admin()` in `0005`); both portals
  are guarded in `src/lib/supabase/middleware.ts`. Customers still have NO direct write path to
  `public.customers` — redemption goes through `redeem_reward` (`0006`) and the profile form
  through `update_customer_profile` (`0007`), both service-role only like `claim_points`.
  On `/tiers` and in the header's member block a tier is read by its GEM COLOUR, picked by tier
  _rank_, never by name (`src/app/(customer)/(account)/tier-accent.ts`). That rule is scoped to
  those two places: the `/dashboard` hero is a fixed brand gradient (`bg-hero`), not a tier wash.
- **Tiers are SPEND, points are currency**: `membership_tiers.spend_threshold` is đồng measured
  against `customers.lifetime_spend` (`0010`); `lifetime_points` only buys rewards and decides
  NOTHING about a tier. `customers.tier_id` is the HIGHEST TIER EVER HELD — sticky, only ever
  raised, by `claim_points` (`0011`) or a direct admin grant (`0012`). Thresholds only ever go up,
  via `tier_threshold_schedules` applied by `apply_due_tier_schedules()`, which never touches
  `customers.tier_id` — that omission IS the grandfathering. A `percentile` schedule ("top 5%")
  is resolved to a đồng amount at apply time and frozen. Nothing may fake spend to force a tier:
  `tier_percentile_amount()` ranks the member base by that column. Schedules fire from the cron
  route `/api/cron/daily` AND fire-and-forget on an `/admin/tiers` render. UI must call
  `resolveDisplayTier`/`tierProgress(tiers, spend, customer)`, never the raw earned tier.
- **ONE GIFT CATALOG**: `public.rewards` holds all THREE kinds of gift, keyed by `kind` — `redeem`
  (the points shop), `spin` (a wheel wedge, `0022`) and `milestone` (a rung of the spend ladder,
  `0024`). None of them is its own table; check constraints stop each kind squatting on the others'
  columns, and EVERY shop query must pin `kind = 'redeem'` or the other two leak into the storefront.
  Admin manages all three on `/admin/rewards` behind `KindTabs`.
- **Spend milestones** (`0024`) are an INDEPENDENT ladder from the tiers: same unit (đồng of
  `customers.lifetime_spend`), nothing else shared — passing a rung moves no tier. Unlocking is
  **derived at read time**, never materialised and emphatically **not** hooked into `claim_points`:
  `adjust_customer_points` (`0012`) and `reconcile_order_spend` (`0016`) also move `lifetime_spend`,
  so a milestone unlocked inside `claim_points` alone would be permanently unreachable for anyone
  pushed over a rung by an admin adjustment or a TikTok reconciliation. Claiming is the member's own
  action through `claim_milestone_reward` (service-role only); `milestone_awards_once_idx` is what
  makes a double-click idempotent, and the award row is **never retracted** even if a refund later
  drops spend below the rung — same sticky posture as `customers.tier_id`. The ladder credits no
  points and writes no `transactions` row: there is no voucher engine, so the prize is handed over at
  the counter like a `gift` wheel prize. Pure helpers in `src/lib/milestones.ts` (no `server-only` —
  the claim button is a client component); the roadmap is `/rewards/roadmap`, a SUB-ROUTE of
  `/rewards` so `PortalNav`'s prefix match keeps "Quà tặng" lit and the nav stays at exactly 4 items.
- **DB**: `supabase/migrations/*.sql` + `supabase/seed.sql`. Claim atomicity lives in the
  `claim_points` RPC — the ONLY write path for a claim. Never bypass it. It is granted to
  `service_role` ONLY (it trusts what it is handed) — call it with `createAdminClient()`.
  Order money reaches it as `p_order_total` (`orderSpendTotal()` in `src/lib/pancake/client.ts`),
  which reads `total_price_after_sub_discount` — after every voucher, excluding shipping. That is
  the single definition of "money actually paid" and what §3.1/§5.1 are measured on.
- **Point calc**: points are MONEY, not SKUs (`0025_spend_based_points.sql`, spec §5.1) —
  `base = floor(order_total / loyalty_settings.vnd_per_point)` then `× tier multiplier`. The đồng
  division is ALWAYS floor and is deliberately NOT governed by `rounding`, which applies only to the
  multiplier step; don't "fix" that asymmetry. The old per-SKU `product_points` table, its
  `unmapped_sku_points` fallback and the whole `/admin/products` screen were DROPPED in 0025 — an
  unmapped SKU used to earn zero, which was the acceptance blocker. `p_items` is still passed and
  still stored in `meta.items`, but only as the ledger's per-line audit trail. It lives ONLY in the
  RPC; `src/lib/points.ts` is types now. Do not reintroduce a second implementation; if the admin UI
  ever needs a preview, call the RPC.
- **Storage**: ONE public bucket, `media` (`0015_media_storage.sql`), with a folder per feature —
  `rewards/`, `blog/`, `spin/`, `milestones/`. The allowlist is `MEDIA_FOLDERS` in `src/lib/media.ts`
  and is TypeScript-only: the storage policies gate on `bucket_id` alone, never on the prefix, so
  adding a folder needs no SQL. Declared in the migration, NOT in `config.toml`
  (that block only applies to `supabase start`, so a hosted project would have no bucket).
  `src/lib/media.ts` is the pure half — bucket limits, the folder ALLOWLIST, `mediaPath`,
  `mediaObjectPath` — and is imported by the browser too, so it must stay free of `server-only`.
  `src/lib/storage.ts` is the only code that talks to the bucket. The stored key is
  `<folder>/<uuid>.<ext>` where `ext` comes from the VALIDATED MIME TYPE, never the uploaded
  filename, and SVG is not allowed. `rewards.image_url` holds the full public URL and may STILL
  hold a hand-pasted external one, which is why the render sites stay a plain `<img>` and why
  `deleteImageByUrl` no-ops on any URL outside the bucket. Uploads go through `uploadMedia`
  (`src/app/admin/media-actions.ts`), which CHECKS `app_metadata.role === 'admin'` ITSELF: it
  hands the file to `createAdminClient()`, which bypasses the bucket's RLS, and a server action is
  a public POST endpoint — the `/admin` proxy guard is not enough on its own. UI:
  `src/components/image-upload.tsx`.
- **Ownership gate**: `matchesOrderPhones` in `src/lib/phone.ts`, over
  `orderPhoneCandidates(order)`. Pancake masks phones as `0****70`, but `customer.phone_numbers`
  also holds the real one once the record has it — when a real number is present it is compared
  EXACTLY and the masks beside it are ignored; `matchesMask` is only the fallback. Never return
  customer point data before it passes. Rate limiting: `src/lib/rate-limit.ts`.
- **i18n**: cookie-driven, Vietnamese default. `src/lib/i18n/messages/en.ts` is the source of
  truth; `vi.ts` is typed against it, so add keys to both.
- **Design system**: Stitch "Azure Paw" — `design/stitch_remix_of_loyalty_rewards_dashboard/`
  (README + `azure_paw/DESIGN.md` + 4 desktop screens) is the ONLY layout reference. The older
  `stitch-v2` / `stitch-light` / `stitch-v3` folders were DELETED on 2026-08-25; `design/` is
  gitignored so they are unrecoverable — don't go looking, and don't cite them.
  **LIGHT is the baseline**: it is `globals.css` `:root`. There is no `:root[data-theme="light"]`
  and no `prefers-color-scheme: light` block — light wins by NOT matching the dark overrides.
  DARK is the override, carried by TWO selectors holding identical values that must stay in sync
  (`@media (prefers-color-scheme: dark) :root:not([data-theme])` and `:root[data-theme="dark"]`),
  and it is FROZEN at the old "Chicha Pet Members" set because the client only ever supplied a
  light design. Its provenance now lives ONLY in `docs/color_palette_theme.md`.
  In DARK, `docs/color_palette_theme.md` supplies the ACCENTS only (`--primary-container`,
  `--ring`, `--brand`, `--foreground`); the surface ladder is a low-chroma neutral on purpose —
  the doc's navies as `--background`/`--card` turned the app unreadably blue, don't put them back.
  Pages use `bg-card` / `text-muted-foreground` and never a literal hex
  (`src/**` currently has zero hardcoded hex — keep it that way). `--chicha-blue` is the logo
  mark's own blue and is exempt from the palette. `globals.css` carries
  `@source not "../../design"`: without it Tailwind compiles the mockups' CDN classes and the
  build fails on their `url()` references. The three `code.html` exports each ship a DIFFERENT
  inline `tailwind.config` (and the tiers one defines no `fontSize` at all, so its `text-body-*`
  classes are no-ops) — `azure_paw/DESIGN.md` outranks any single export.
- **Portal shells**: both portals use the SAME flex + `sticky` shell — a `SidebarRail` flex item
  (`shrink-0`) and a grow column, so `<main>` reflows structurally. Admin's old `fixed` aside +
  `md:pl-64` is GONE; never reintroduce a hardcoded mirror of the rail's width, it cannot survive a
  width that is state. `src/components/portal-sidebar.tsx` owns the rail and the collapse context
  (the toggle lives in the header, the rail is an `<aside>` — siblings, hence context, not props).
  Collapse is a cookie (`src/lib/sidebar/`) read SERVER-side so the first HTML has the real width;
  it deliberately does NOT `router.refresh()` like the theme does — nothing server-rendered depends
  on it, and a refresh would re-run the layouts' account/tier queries on every click. A collapsed
  rail label is `sr-only` + `title`, NEVER `hidden`: `display:none` strips the link's accessible
  name and leaves a screen reader a column of nameless icons (`portal-nav.test.tsx` guards this).
  The rail owns its own horizontal padding because `group-data` variants match DESCENDANTS, so a
  class on the `<aside>` can never react to the `<aside>`'s own state.
  `PortalHeader` (`src/components/portal-header.tsx`) is the bar both portals wear. It runs
  FULL-BLEED at `px-4 md:px-6 lg:px-8` and is deliberately NOT capped at the `max-w-[1280px]`
  `<main>` carries: the bar is chrome, not content, and centring its row inside that cap parks the
  toggle and the account block hundreds of px in from the edges on a wide monitor. It was tried and
  rejected on 2026-08-31 — the header and `<main>` are allowed to disagree about their left edge.
- **EVERYTHING about your account hides behind the avatar, at every width.** The header's right end
  is exactly two things: the member portal's live `context` — the wheel pill and the points pill —
  and, in `system`, the identity
  block — avatar + name + tier (member) or email + role (admin) — which is the TRIGGER for a menu
  holding the theme switch, sign-out, and (member only) `/profile` and `/help`. Theme and sign-out
  were loose icons beside it until 2026-08-31; three ungrouped controls fought for one corner.
  Two surfaces, one per pointer: `PortalIdentity` (`src/components/portal-identity.tsx`) is the
  `md`-and-up dropdown over `ui/menu.tsx` (Radix `DropdownMenu`), `AccountMenu` / `AdminMenu` over
  `PortalMenu` + `ui/drawer.tsx` (**vaul** — Radix ships no swipe-dismissable drawer) is the phone
  bottom sheet. They are NOT one responsive component —
  a sheet is right under a thumb and wrong under a cursor — but they must offer the SAME actions.
  Rules that bite:
  - `PortalIdentity` must never use a heading element: `PortalHeader`'s locator `<h1>` is the only
    one in the bar and `portal-header.test.tsx` looks it up by role with no name.
  - The sign-out `<form>` sits INSIDE the popup, so its `MenuItem` takes `closeOnClick={false}` —
    closing would unmount the form out from under its own submit. Same for the theme row, which is
    not a destination at all. `closeOnClick` is OUR prop; `ui/menu.tsx` maps it to Radix's
    `onSelect={(e) => e.preventDefault()}`. Do not reach for `onSelect` at a call site.
    `menu.test.tsx` guards both halves of that mapping.
  - The theme row is `ThemeMenuItem` (`src/components/theme-toggle.tsx`), not
    `<MenuItem asChild><ThemeToggle/></MenuItem>`: Radix's `asChild` spreads the item's props onto
    the child exactly as Base UI's `render` did, and ThemeToggle's Button swallows them. The gotcha
    SURVIVED the migration — do not "simplify" it back.
  - The labelled sign-out on `/profile` and in the no-customer `EmptyState` is the backstop now that
    nothing is signed out in one click; keep both.
  - `account-menu.test.tsx` is the only guard on the phone path; don't weaken it.
- **"Nâng hạng" is pinned to the BOTTOM of the rail** via `SidebarCta`
  (`src/components/portal-sidebar.tsx`) — the whole of the member rail's `footer` slot now that the
  member block moved to the header (admin's `footer` is GONE entirely). `SidebarCta` is a client
  component and not another server-rendered slot for one reason: `title` must be set ONLY while
  collapsed, which CSS cannot express — the same rule the rail's nav links follow, and the label goes
  `sr-only`, NEVER `hidden`. Below `md` there is no rail at all, so it moves into `AccountMenu`; it is
  deliberately NOT repeated in the desktop dropdown, where the rail already shows it at all times.
- **`/dashboard` is a 12-column bento** (`lg:grid-cols-12`), and its one hard rule is that a missing
  block must never leave a hole. Two devices do that: the **4-slot always has a tenant** — the featured
  gift if there is one, otherwise the summary `<dl>`, which is what lets the hero stay at a constant
  `lg:col-span-8` — and the daily-action tiles (check-in / milestones) take their span from
  `ENGAGEMENT_SPAN[count]`, a lookup of FULL class strings because Tailwind cannot see an interpolated
  one. The wheel was a third such tile until 2026-08-31. "Đơn hàng gần đây" swaps list↔table on a **container query** (`@container/orders` +
  `@[30rem]/orders:`), never a viewport breakpoint: that tile's width depends on whether the rail is
  collapsed, and collapse is user state — the same reason a hardcoded `md:pl-64` is banned.
- **The wheel is a DIALOG, not a route.** `/spin` was a page until 2026-08-31 and is gone: no route,
  no entry in the layout's `titles`, none in `ACCOUNT_PREFIXES`, and no `revalidatePath("/spin")`
  anywhere — don't reintroduce one. `src/app/(customer)/(account)/spin/` is a PAGE-LESS folder that
  keeps `actions.ts` + the two client components, because that is where the app keeps server actions.
  The trigger is the header's pill (`SpinDialog`, `context` slot, beside the points pill), so the
  wheel is one control away from every screen. What the layout reads on every route is ONLY what the
  pill's badge needs — `getSpinDailyLimit` / `getSpinsUsedToday` / `getUncollectedGiftCount`, each
  gated on the wheel being on and a `customers` row existing. The wedges and the win list come from
  `loadSpinBoard`, a server action run when the dialog OPENS and again once a spin has STOPPED
  (`Wheel`'s `onSettled`) — never mid-spin, or a just-sold-out wedge would vanish from under the
  turn in progress. It proves the session itself: a server action is a public POST endpoint, the same
  reason `uploadMedia` re-checks the admin claim. The spin result renders INLINE under the wheel
  rather than in its own dialog — a popup over the popup would hide the wedge that just stopped under
  the pointer. The pill's badge dot has an `sr-only` twin (`nav.spinPending` / `nav.spinLeft`): an
  unfulfilled `gift` win is settled by hand at the counter, and the dot is the only place a member is
  told one is waiting.
- **`src/components/ui/button.tsx` MUST NOT GAIN A `"use client"` DIRECTIVE.** It has none today,
  deliberately: 15 server components call `buttonVariants()` to style a `<Link>`, and a directive
  turns every one of them into _"Attempted to call buttonVariants() from the server"_ at runtime.
  Neither `tsc` nor vitest can see it — **only `npm run build` does**, so run it after touching this
  file. Rendering the client `ButtonPrimitive` from a directive-free module is fine; the import is
  what creates the boundary, and it creates it around the primitive alone.
- **Button supports `asChild`** — but the house pattern for links is still
  `cn(buttonVariants({…}))` on a `<Link>`, at 22 sites (20 of them server). The `asChild` branch is
  the client-only one, because Radix's `Slot` uses hooks, so `<Button asChild><Link/></Button>`
  would push those subtrees across the client boundary for nothing. Reach for `asChild` only inside client
  components, where it buys ref and handler merging — chiefly Dialog / AlertDialog / DropdownMenu /
  Tooltip triggers. `src/components/page-link.tsx` is NOT an `asChild` workaround and does not go
  away: it renders an inert `<span aria-hidden>` when there is no page to go to, which an `asChild`
  Button cannot express. The `asChild` branch uses **Radix's** `Slot`, never Animate UI's: Animate
  UI merges as `{...childProps, ...slotProps}`, so a slot prop OVERWRITES a child's own handler
  instead of composing with it.
- Button keeps `type="button"` as its default, because the Base UI primitive it replaced did, a bare
  `<button>` defaults to `type="submit"`, and **Animate UI's button primitive sets no default
  either** — 20 call sites sit inside a `<form>` without an explicit type. `button.test.tsx` is the
  only thing standing between that and a silent regression.
- The press is Motion's (`tapScale={0.98}`), and `active:scale-[.98]` was REMOVED from the cva to
  match: CSS and Motion both writing `transform` double-bounced the button mid-press. `hoverScale`
  is pinned to `1` — Animate UI's `1.05` default overflows the `xl` auth CTA out of its card and
  pushes bento buttons past their grid cell.
- Base UI's `render={<X/>}` is Radix's `asChild` + `<X/>` as the child, and **the trigger's children
  move INSIDE X**: Radix's Slot will not merge slot children into a child that already has its own.
  Get it wrong and the control keeps working but loses its accessible name.
- **A Radix `Select.Item` may NEVER carry `value=""`** — it throws at render, invisible to `tsc`.
  The empty-choice sentinel is `NO_SELECTION` (`src/lib/schemas.ts`), mapped back to `null` by
  `blankToNull` at the submit boundary (`adjust-form.tsx`, `reward-form.tsx`). Radix Select items
  never take DOM focus either, so style them with `data-highlighted:`, never `focus:`.
- `src/app/globals.css` keeps `@import "shadcn/tailwind.css"`, so `shadcn` stays in devDependencies
  and is load-bearing at build time. Its `@custom-variant`s (`data-open`, `data-closed`,
  `data-checked`, `data-disabled`, …) are written to match BOTH `[data-state="open"]` (Radix) and
  `[data-open]` (Base UI) — which is why almost every class string in `ui/` survived the swap.
- **Motion system.** Durations and easings are tokens: a NON-`inline` `@theme` block in `globals.css`
  (`--transition-duration-instant|quick|base|slow|reveal`, `--ease-out-quart|out-expo|back-out|
in-quart`) mirrored for JS in `src/lib/motion/tokens.ts`. It must stay non-`inline`: `@theme inline`
  inlines the value into the utility and emits NO custom property, so the hand-written `@utility`
  keyframes that reference `var(--ease-*)` would silently resolve to nothing. `--ease-back-out` is the
  ONLY overshoot in the system and is allowed on win/claim confirmations and nowhere else.
  `MotionProvider` (`src/lib/motion/provider.tsx`) mounts `LazyMotion` in **strict** mode, so
  components use `m.div`, never `motion.div` — which is why every vendored Animate UI file is
  rewritten to `m.` on install, and why `eslint.config.mjs` bans importing `motion` from
  `motion/react` anywhere under `src/`. A missed `motion.*` in a file that is imported but never
  rendered throws nothing; it just silently ships the full bundle.
  **`domMax` IS loaded** (changed on 2026-09-01): Animate UI's `switch` puts a bare `layout` on its
  thumb, `tabs` uses `layout="size"` and `effects/highlight` moves with `layoutId`, and under
  `domAnimation` all three are ignored **silently** — a thumb that teleports, with no warning. What
  `domAnimation` used to make impossible is now only a rule: nothing under
  `src/app/(customer)/(account)/dashboard/` may use `layout`/`layoutId`, because it would transform
  a tile out of its assigned cell and leave the hole the no-hole rule exists to prevent. That rule
  is enforced by a `no-restricted-syntax` selector in `eslint.config.mjs`, scoped to `<m.* />` —
  `layout` is also an ordinary string prop here (`PostCard layout="tile"`).
- **Presence moved from CSS to `AnimatePresence`.** In every migrated file the
  `data-open:animate-in` / `data-closed:animate-out` utilities and the `duration-* ease-*` that
  timed them are DELETED — keeping both animates each open twice. Three things that look similar
  are NOT dead and must stay: `data-checked:` / `data-unchecked:` (checkbox colour),
  `data-highlighted:` (menu row hover) and `data-[state=open]` on triggers
  (`group-data-[state=open]:rotate-180`) — Radix still stamps all of those. `select.tsx` also keeps
  its own `data-open:animate-*`, because Select never migrated.
- Prefers-reduced-motion is handled app-wide in `globals.css` (everything collapses to 1ms;
  `.animate-spin` and `.animate-pulse` are EXEMPT because a frozen spinner reads as a hung request)
  plus `MotionConfig reducedMotion="user"`. Do not add a per-component check; the wheel's is the one
  exception, and it reads `matchMedia` inside its click handler, never during render.
- Numbers in `src/lib/i18n/messages/*.ts` go through that file's own pinned `num()`, never a bare
  `toLocaleString()`: the bare call reads the runtime's default, and Node's en-US ("1,500") against a
  Vietnamese browser ("1.500") was a real hydration mismatch on every reward card.
- Tests: Radix needs `hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` / `scrollTo`
  stubs and Motion needs `MotionGlobalConfig.skipAnimations = true`; both live in `src/test/setup.ts`.
  That flag is what makes an `AnimatePresence` exit resolve synchronously, so "the popup is gone" is
  provable under jsdom — verified for tooltip, dialog and the phone sheet. `src/test/render.tsx`
  mounts `MotionProvider`, so `strict` catches a stray `motion.` in CI; `menu.test.tsx` and
  `truncated-text.test.tsx` render OUTSIDE it on purpose, proving the popups still degrade when no
  Motion features are loaded. Note Radix's tooltip does not close on `userEvent.unhover()` under
  jsdom — that is true of plain Radix too, so drive `open` directly rather than chasing it.
  If user-event ever refuses a click inside an open dialog ("pointer-events: none"), that is Radix's
  DismissableLayer setting it on `<body>` — the fix is `userEvent.setup({ pointerEventsCheck: 0 })`,
  but check first whether the popup in question is still a non-Radix one.
