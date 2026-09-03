// English catalog — the source of truth. `Messages` (typeof en) is the shape
// every other locale must satisfy. Interpolated strings are functions so the
// arguments stay type-checked across locales.
//
// House rules for anyone adding copy here:
//  * American spelling (center, program, canceled, finalized).
//  * Never describe a flow the code does not have. Points are credited by the
//    Pancake webhook and by the one proof order taken at signup — there is no
//    scan screen, no counter, and no manual claim.

const NUMBER = new Intl.NumberFormat("en-US")

// Point counts, formatted against THIS catalog's locale rather than
// `toLocaleString()` with no argument. That bare call reads the runtime's
// default, and Node's ICU default (en-US, "1,500") disagreed with a Vietnamese
// browser ("1.500") — every one of these strings renders inside a client
// component, so the disagreement was a hydration mismatch that made React throw
// away and re-render the subtree on load. Money already went through formatVnd,
// which has always been pinned to vi-VN.
const num = (value: number) => NUMBER.format(value)

export const en = {
  meta: {
    appTitle: "Loyalty Points",
    appDescription: "Earn points automatically and track your rewards",
  },
  common: {
    previous: "Previous",
    next: "Next",
    page: (n: number) => `Page ${n}`,
    showing: (shown: number, total: number) =>
      `Showing ${num(shown)} of ${num(total)}`,
    showingRange: (first: number, last: number, total: number) =>
      `Showing ${num(first)}-${num(last)} of ${num(total)}`,
    save: "Save",
    saving: "Saving…",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    active: "Active",
    inactive: "Inactive",
    actions: "Actions",
    search: "Search",
    // Delete is irreversible, so it always goes through a confirmation dialog.
    confirmDeleteTitle: "Delete this record?",
    confirmDeleteBody: (name: string) =>
      `“${name}” will be removed permanently. This cannot be undone.`,
    deleting: "Deleting…",
    deleted: "Deleted",
    deleteFailed: "Could not delete. Please try again.",
    pagination: "Pagination",
    loading: "Loading…",
    errorTitle: "Something went wrong",
    errorBody: "This screen failed to load. Try again in a moment.",
    retry: "Try again",
    notFoundTitle: "Page not found",
    notFoundBody:
      "That link goes nowhere. It may have moved, or never existed.",
    goHome: "Back to home",
    clearFilters: "Clear filters",
  },
  // Pancake order status codes. Codes and names verified against the live
  // shop — see src/lib/pancake/order-status.ts.
  pancakeStatus: {
    new: { label: "New", hint: "Just created, not confirmed by the shop yet" },
    submitted: { label: "Confirmed", hint: "The shop confirmed the order" },
    packing: { label: "Packing", hint: "Being packed at the warehouse" },
    shipped: { label: "Shipped", hint: "Handed to the carrier, on its way" },
    delivered: { label: "Delivered", hint: "The customer received the parcel" },
    receivedMoney: {
      label: "Paid",
      hint: "Delivered and the money has been collected — the final state",
    },
    returning: { label: "Returning", hint: "On its way back to the shop" },
    returned: { label: "Returned", hint: "Back in the warehouse" },
    canceled: { label: "Canceled", hint: "Canceled before delivery" },
    removed: { label: "Removed", hint: "Deleted from Pancake" },
    code: (n: number) => `code ${n}`,
    unknown: (n: number) => `Status #${n}`,
  },
  // The program's name. Shown on the auth split and the account rail.
  brand: {
    name: "ChiCha Membership",
  },
  // Light/dark switch. The label shows the theme the button switches TO.
  theme: {
    light: "Light",
    dark: "Dark",
    switchToLight: "Switch to light theme",
    switchToDark: "Switch to dark theme",
  },
  // The desktop rail's collapse switch. Chrome shared by both portals, so it
  // sits at the top level rather than under `admin` or `customer`. The label
  // describes the ACTION, matching the theme keys above.
  sidebar: {
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    // The header's back chevron, shown only on a detail route.
    back: "Back to section",
  },
  admin: {
    metaTitle: "Admin",
    nav: {
      brand: "ChiCha Membership",
      dashboard: "Dashboard",
      settings: "Settings",
      tiers: "Tiers",
      rewards: "Rewards",
      spin: "Spin wheel",
      blog: "Blog",
      customers: "Customers",
      transactions: "Transactions",
      support: "Support",
      signOut: "Sign out",
      role: "Administrator",
      // The phone sheet behind the avatar — the member portal's AccountMenu
      // equivalent, holding every section the four-slot tab bar cannot carry.
      accountLabel: "Your account",
      menuTitle: "Admin",
      // Both navigations can be in the DOM at once on a phone, so each needs
      // its own accessible name.
      sidebarLabel: "Admin sections",
      bottomLabel: "Main admin sections",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Welcome back. Here's what's happening today.",
      customers: "Customers",
      // Counts every row in `customers`, which is written at signup and by the
      // webhook — not a count of who has earned points.
      customersHint: "Everyone with a registered account",
      pointsIssued: "Points issued",
      pointsIssuedHint: "Total points given out",
      pointsRedeemed: "Points redeemed",
      pointsRedeemedHint: "Total points spent on rewards",
      transactions: "Transactions",
      transactionsHint: "Every points movement, in and out",
      recent: "Recent activity",
      searchLabel: "Search customers",
      searchPlaceholder: "Search a customer by phone…",
      tierDistribution: "Tier distribution",
      tierMembers: (n: number) => `${num(n)} members`,
      viewAllTiers: "View all tiers",
      viewAllTransactions: "View all activity",
      noRecent: "No activity yet.",
      colBalance: "Total points",
      movement: (amount: number) =>
        amount > 0 ? `+${num(amount)}` : num(amount),
      noTiers: "No tiers configured yet.",
      openTickets: "Open requests",
      openTicketsHint: "Support tickets waiting for a reply",
      lowStock: "Rewards running low",
      lowStockHint: (n: number) => `${n} or fewer left in stock`,
      quickActions: "Quick actions",
      addReward: "Add a reward",
      addTier: "Add a tier",
      addProduct: "Map a product",
    },
    login: {
      metaTitle: "Admin Login",
      title: "Admin",
      description: "Sign in to manage loyalty points.",
      panelTitle: "The back office for the pack.",
      panelBody:
        "Points, tiers, rewards and every request your members send — all in one place.",
      email: "Email",
      password: "Password",
      signingIn: "Signing in…",
      signIn: "Sign in",
      required: "Email and password are required.",
      invalidCredentials: "Invalid credentials.",
      rateLimited: "Too many failed attempts. Try again in a few minutes.",
    },
    settings: {
      metaTitle: "Loyalty Settings",
      title: "Loyalty Settings",
      helper:
        "Points = (money actually paid ÷ đồng per point) × tier multiplier, then rounded.",
      // The multiplier has to produce a fraction, or the rounding step in the
      // example demonstrates nothing.
      formulaExample:
        "Example: a 2,000,000đ order ÷ 1,000 = 2,000 base points, Gold multiplier 1.1 → 2,200 points.",
      rounding: "Rounding",
      roundingHelper:
        "How a fractional points total is turned into a whole number.",
      floor: "Round down",
      round: "Round to nearest",
      ceil: "Round up",
      floorExample: "12.7 → 12",
      roundExample: "12.5 → 13",
      ceilExample: "12.1 → 13",
      claimableStatuses: "Which orders can earn points?",
      claimableStatusesHelper:
        "Tick the Pancake order statuses that are allowed to earn points. An order in any other status is skipped until it reaches one of these.",
      recommended: "recommended",
      selectedCount: (n: number) => `${n} selected`,
      noStatusSelected: "Pick at least one status.",
      vndPerPoint: "Đồng per point",
      vndPerPointHelper:
        "How many đồng of actually-paid money earn 1 base point. The programme rule is 1,000đ = 1 point. Anything under that is always rounded down.",
      welcomeGiftPoints: "Welcome gift",
      welcomeGiftPointsHelper:
        "Points granted once on successful registration. 0 = off.",
      checkinPoints: "Daily check-in",
      checkinPointsHelper:
        "Points for one check-in per day. 0 = hides the check-in card.",
      spinDailyLimit: "Spins per day",
      spinDailyLimitHelper:
        "Free wheel spins each member gets per day. 0 = hides the wheel.",
      save: "Save settings",
      invalidInput: "Invalid input",
      saveFailed: "Save failed. Check permissions.",
      saved: "Settings saved.",
    },
    tiers: {
      metaTitle: "Membership Tiers",
      title: "Membership Tiers",
      helper:
        "A tier is reached on total money spent, and once reached it is kept for good — raising a threshold never demotes anyone. The multiplier applies to every future order.",
      name: "Name",
      fixedField: "Fixed for the five-tier ladder — cannot be changed.",
      spendThreshold: "Spend required",
      spendThresholdHelper:
        "Total money ever spent to reach this tier, in đồng. 0 = starting tier.",
      multiplier: "Multiplier",
      multiplierHelper: "1 = normal. 1.5 = every order earns 1.5× points.",
      sortOrder: "Order",
      benefits: "Short description",
      benefitsHelper:
        "One line summarizing the tier. The perks below are what the tier screen renders.",
      perks: "Perks",
      perksHelper:
        "Shown on the customer's tier screen. The first three also headline the tier card.",
      perkIcon: "Icon",
      perkTitle: "Title",
      perkTitlePlaceholder: "e.g. 10% off every order",
      perkDetail: "Detail",
      perkDetailPlaceholder: "One line of explanation (optional)",
      perkAdd: "Add a perk",
      perkRemove: "Remove perk",
      perkNone: "No perks yet.",
      perkCount: (n: number) => `${n} perk${n === 1 ? "" : "s"}`,
      perkIcons: {
        percent: "Discount",
        gift: "Gift",
        truck: "Shipping",
        cake: "Birthday",
        award: "Status",
        sparkles: "Other",
        wheel: "Spin wheel",
        paw: "Pet",
        flask: "New products",
        layers: "Collection",
        heart: "Care",
      },
      listTitle: "Tier list",
      empty: "No tiers yet — add your first one below.",
      saved: "Tier saved.",
      saveFailed: "Save failed.",
      thresholdBelowNeighbor:
        "That would drop this tier to or below the one beneath it.",
      thresholdAboveNeighbor:
        "That would raise this tier to or past the one above it.",
      // ---- scheduled threshold raises ----
      pendingThreshold: "Upcoming threshold",
      pendingNone: "No change queued",
      scheduleTitle: "Schedule a raise",
      scheduleHelper:
        "Raise a tier's threshold on a date you choose. Members who already reached the tier keep it — a raise only affects who can still get there.",
      scheduleTier: "Tier",
      scheduleMode: "New threshold set by",
      amountMode: "A fixed amount",
      percentileMode: "A share of members",
      amountModeHelper: "The exact spend the tier will require.",
      percentileModeHelper:
        "For example 5 means “the top 5% of spenders”. It is turned into a đồng amount on the effective date and stays fixed after that.",
      targetAmount: "New spend required",
      targetPercentile: "Top % of members",
      effectiveAt: "Applies from (Vietnam time, UTC+7)",
      effectiveAtHelper:
        "Nothing changes before this moment. Leave it in the future to announce the raise first. Enter the time in Vietnam's time zone.",
      scheduleNote: "Note",
      scheduleNoteHelper: "Your own reminder of why. Not shown to customers.",
      schedulePreviewHint: (amount: string) =>
        `Right now the top slice starts at ${amount}. The figure is recalculated on the effective date.`,
      schedulePreviewEmpty: "No members have spent anything yet.",
      scheduleSubmit: "Queue the raise",
      scheduleSaved: "Raise scheduled.",
      scheduleSaveFailed: "Could not schedule that raise.",
      scheduleCancel: "Cancel the queued raise",
      scheduleCancelTitle: "Cancel this queued raise?",
      scheduleCancelBody: (tierName: string) =>
        `The threshold raise queued for ${tierName} will not run. You can queue a new one later.`,
      scheduleCancelConfirm: "Cancel the raise",
      scheduleCanceling: "Canceling…",
      scheduleCanceled: "Queued raise canceled.",
      scheduleCancelFailed: "Could not cancel it.",
      scheduleDuplicate:
        "This tier already has a raise queued. Cancel it before adding another.",
      scheduleForbidden: "Only staff accounts can schedule tier changes.",
      effectiveOn: (date: string) => `from ${date}`,
      percentileLabel: (pct: number) => `top ${pct}%`,
    },
    // The image uploader. Its own namespace, not part of `rewards` — the blog
    // will mount the same component.
    media: {
      upload: "Upload image",
      replace: "Replace image",
      uploading: "Uploading…",
      remove: "Remove",
      previewAlt: "Selected image",
      wrongType: "Only JPEG, PNG, WebP or AVIF images can be uploaded.",
      tooLarge: (mb: number) => `The image must be smaller than ${mb} MB.`,
      uploadFailed: "Upload failed.",
    },
    rewards: {
      metaTitle: "Gifts",
      title: "Gifts",
      helper:
        "Every gift in one place. Redeemable gifts go to the shop; wheel gifts go on the lucky wheel.",
      tabRedeem: "Redeemable",
      tabSpin: "Wheel slices",
      tabMilestone: "Milestones",
      redeemHelper: "Items customers can redeem with their available points.",
      name: "Name",
      description: "Description",
      pointsCost: "Points cost",
      pointsCostHelper: "Points deducted when a customer redeems this.",
      category: "Category",
      categoryHelper:
        "Groups the reward into a shop tab. Reuse an existing name or type a new one.",
      isExclusive: "Members-only",
      isExclusiveHelper: "Appears under the shop's “Exclusive” tab.",
      isFeatured: "Featured",
      isFeaturedHelper:
        "The hero card at the top of the shop. Only one active reward can hold it.",
      featuredConflict:
        "Another reward is already featured. Turn that one off first.",
      featuredChip: "Featured",
      exclusiveChip: "Exclusive",
      minTier: "Minimum tier",
      minTierHelper:
        "Only members at or above this tier can redeem. Leave unset for everyone.",
      noMinTier: "No restriction",
      minTierChip: (tierName: string) => `${tierName}+`,
      quantity: "Quantity",
      quantityHelper: "Stock left. 0 = out of stock.",
      imageUrl: "Image URL",
      status: "Status",
      statusHelper: "Inactive rewards are hidden from the shop.",
      cost: (points: number) => `${num(points)} pts`,
      stockOf: (left: number, max: number) => `Stock: ${left} / ${max}`,
      soldOut: "Out of stock",
      searchPlaceholder: "Search rewards…",
      noMatch: "No rewards match that search.",
      statTotal: "Total rewards",
      statActive: "Active",
      statLowStock: "Running low",
      statLowStockHint: (n: number) => `${n} or fewer left in stock`,
      statAvgCost: "Average points cost",
      addTitle: "Add a reward",
      empty:
        "No rewards yet — add one so customers have something to spend points on.",
      saved: "Reward saved.",
      saveFailed: "Save failed.",
      deleteFailed: "Delete failed.",
      // The wheel's slices are gifts too, so they are managed on this same
      // screen under their own tab (0022) — only the fields differ.
      // The spend ladder (0024). Configured on this screen's third tab; the
      // hand-over queue is a screen of its own, exactly like the wheel's.
      milestone: {
        helper:
          "Gifts a member unlocks by reaching a lifetime SPEND amount. Independent of the tier ladder — reaching a rung moves no tier.",
        addTitle: "Add a milestone",
        name: "Gift name",
        description: "Description",
        descriptionHelper:
          "One line under the name. A combined prize goes here rather than in a second rung.",
        spendThreshold: "Spend threshold (đ)",
        spendThresholdHelper:
          "Lifetime spend in đồng, measured against the member's spend — never their points.",
        imageUrl: "Image",
        status: "Status",
        statusHelper:
          "An inactive rung disappears from the roadmap. Prizes already claimed still show.",
        searchPlaceholder: "Search milestones",
        noMatch: "No milestone matches that search.",
        empty: "No milestones yet. Add the first rung of the ladder.",
        statMilestones: "Milestones",
        statMilestonesHint: "Rungs configured",
        statActive: "Active",
        statClaimed: "Claimed",
        statClaimedHint: "All time",
        statPending: "Gifts to hand over",
        statPendingHint: "Claimed but not yet given",
        viewAwards: "Claims",
        thresholdConflict:
          "Another active milestone already sits at that amount. Change the threshold or deactivate the other one.",
        saved: "Milestone saved.",
        saveFailed: "Save failed.",
        deleteFailed: "Delete failed.",
      },
      spin: {
        helper:
          "Every active slice becomes one wedge. Odds are weights, not percentages — a slice's chance is its weight divided by the total.",
        addTitle: "Add a slice",
        name: "Name",
        prizeType: "What winning grants",
        prizeTypeHelper:
          "Points are credited automatically. A gift is handed over at the counter. Blank grants nothing.",
        typePoints: "Points",
        typeGift: "Gift",
        typeNone: "Blank (no prize)",
        pointsAmount: "Points awarded",
        pointsAmountHelper: "Credited the moment the wheel stops.",
        weight: "Weight",
        weightHelper:
          "Relative odds. A slice with weight 10 is drawn ten times as often as one with weight 1. Set 0 to keep the slice off the wheel.",
        sortOrder: "Position",
        sortOrderHelper: "Lower numbers sit earlier on the wheel.",
        quantity: "Stock",
        quantityHelper:
          "How many are left to give away. A gift at 0 drops off the wheel until you restock it.",
        outOfStock: "Out of stock",
        imageUrl: "Image URL",
        status: "Status",
        statusHelper: "Inactive slices are removed from the wheel entirely.",
        odds: (percent: string) => `${percent} chance`,
        neverDrawn: "Never drawn",
        pointsChip: (points: number) => `+${num(points)} pts`,
        searchPlaceholder: "Search slices…",
        noMatch: "No slices match that search.",
        empty:
          "No slices yet — add a few so the wheel has something to land on.",
        statSlices: "Slices on the wheel",
        statSlicesHint: "Drawable right now",
        statTotalWeight: "Total weight",
        statTotalWeightHint: "The denominator behind every percentage",
        statOutOfStock: "Sold out",
        statOutOfStockHint: "Gift slices with no stock left",
        disabledWarning:
          "The wheel is off. Set “Spins per day” above zero in Settings to show it to members.",
        goToSettings: "Open settings",
        noWeightWarning:
          "No slice can be drawn right now. Give at least one active slice a weight — and restock any sold-out gift.",
        outOfStockWarning: (n: number) =>
          n === 1
            ? "1 gift slice is sold out and off the wheel until you restock it."
            : `${n} gift slices are sold out and off the wheel until you restock them.`,
        saved: "Slice saved.",
        saveFailed: "Save failed.",
        deleteFailed: "Delete failed.",
      },
    },
    // The spend ladder's hand-over queue. Mirrors admin.spin.winners
    // key-for-key: same screen, different ladder.
    milestones: {
      awards: {
        metaTitle: "Milestone claims",
        title: "Milestone Claims",
        subtitle:
          "Gifts claimed from the spend ladder, newest first. Mark each one once handed over.",
        backToMilestones: "Back to milestones",
        customer: "Member",
        milestone: "Milestone",
        threshold: "Threshold",
        claimedAt: "Claimed",
        status: "Status",
        statusPending: "Not handed over",
        statusFulfilled: "Handed over",
        fulfilledOn: (date: string) => `Handed over ${date}`,
        markFulfilled: "Mark as handed over",
        undoFulfilled: "Undo",
        filterLabel: "Show",
        filterPending: "Pending",
        filterAll: "All",
        empty: "No milestone has been claimed yet.",
        emptyPending: "Nothing waiting — every gift has been handed over.",
        marked: "Marked as handed over.",
        unmarked: "Marked as pending again.",
        updateFailed: "Could not update that claim.",
      },
    },
    spin: {
      metaTitle: "Spin wheel",
      title: "Spin Wheel",
      statPending: "Gifts to hand over",
      statPendingHint: "Won but not yet given",
      winners: {
        metaTitle: "Spin winners",
        title: "Spin Winners",
        subtitle:
          "Gifts won on the wheel, newest first. Mark each one once handed over.",
        backToPrizes: "Back to the wheel",
        viewWinners: "Winners",
        customer: "Member",
        prize: "Prize",
        wonAt: "Won",
        status: "Status",
        statusPending: "Not handed over",
        statusFulfilled: "Handed over",
        fulfilledOn: (date: string) => `Handed over ${date}`,
        markFulfilled: "Mark as handed over",
        undoFulfilled: "Undo",
        filterLabel: "Show",
        filterPending: "Pending",
        filterAll: "All",
        empty: "No gifts have been won yet.",
        emptyPending: "Nothing waiting — every gift has been handed over.",
        marked: "Marked as handed over.",
        unmarked: "Marked as pending again.",
        updateFailed: "Could not update that win.",
      },
    },
    blog: {
      metaTitle: "Blog",
      title: "Blog & Promotions",
      helper: "Articles and promotion announcements shown on the public site.",
      addTitle: "New post",
      titleLabel: "Title",
      slug: "Slug",
      slugHelper: "The post's URL: /blog/your-slug. Lowercase, hyphens only.",
      excerpt: "Excerpt",
      excerptHelper: "Short summary shown in listings. Optional.",
      content: "Content",
      coverImage: "Cover image",
      postType: "Type",
      typeArticle: "Article",
      typePromotion: "Promotion",
      isPublished: "Published",
      isPublishedHelper: "Unpublished posts are hidden from the public site.",
      publishedChip: "Published",
      draftChip: "Draft",
      searchPlaceholder: "Search posts…",
      noMatch: "No posts match that search.",
      empty: "No posts yet — write one for the public site.",
      statTotal: "Total posts",
      statPublished: "Published",
      saved: "Post saved.",
      saveFailed: "Save failed.",
      slugConflict: "That slug is already used by another post.",
      deleteFailed: "Delete failed.",
    },
    customers: {
      metaTitle: "Customers",
      title: "Customers",
      subtitle: "Look up and review customer records in the system.",
      name: "Name",
      phone: "Phone",
      tier: "Tier",
      currentPoints: "Available",
      currentPointsHint: "Points left to spend",
      lifetimePoints: "Lifetime",
      lifetimePointsHint: "Total points ever earned",
      lifetimeSpend: "Spend",
      lifetimeSpendHint: "Total money ever spent — decides the tier",
      empty: "No customers yet — they appear here once they sign up.",
      noMatch: "No customers match that search.",
      search: "Search by phone or name",
      totalMembers: "Total members",
      profileStatus: "Profile",
      profileComplete: "Completed",
      profileIncomplete: "Not filled in",
      detail: {
        metaTitle: "Customer",
        backToList: "Back to customers",
        statAvailable: "Available points",
        statLifetime: "Lifetime points",
        statSpend: "Lifetime spend",
        statTransactions: "Transactions",
        statMemberSince: "Member since",
        ownerTitle: "Owner",
        petTitle: "Pet",
        email: "Email",
        dob: "Date of birth",
        petName: "Name",
        petType: "Type",
        petDob: "Adoption or birth date",
        profileCompletedAt: "Profile completed",
        noProfile: "This customer hasn't filled in their profile yet.",
        tierTitle: "Tier progress",
        noTier: "No tier yet",
        topTier: "Top tier reached",
        toNext: (amount: string, tier: string) => `${amount} more to ${tier}`,
        grandfathered: (tier: string) =>
          `Kept at ${tier} on the threshold that applied when they reached it.`,
        multiplier: (value: number) => `×${value} on every order`,
        historyTitle: "Transaction history",
        historyEmpty: "No transactions yet.",
        supportTitle: "Support requests",
        supportEmpty: "No support requests from this customer.",
        adjust: {
          title: "Grant tier & points",
          helper:
            "For customers who shopped with us before the app existed. Pancake hides phone numbers, so their history can't be imported — grant it here instead.",
          grantTier: "Grant tier",
          grantTierHelper:
            "Assigns the tier outright and keeps it for good. No spend is invented, so the member's real spend figure stays honest. Only tiers above the one they hold are listed.",
          noTierGrant: "Don't change the tier",
          tierOption: (name: string, threshold: string) =>
            `${name} — normally ${threshold}`,
          currentDelta: "Spendable points",
          currentDeltaHelper:
            "Added to the balance they can redeem with. Use a minus sign to take points back.",
          lifetimeDelta: "Lifetime points",
          lifetimeDeltaHelper:
            "The running total shown on their profile. It no longer affects the tier — use “Grant tier” for that.",
          reason: "Reason",
          reasonHelper: "Stored on the ledger entry alongside your account.",
          preview: "After this change",
          submit: "Apply adjustment",
          confirmTitle: "Confirm this adjustment?",
          confirmBody:
            "This changes the customer's point balance and/or tier immediately and cannot be undone from here. Double-check the preview before confirming.",
          confirmCta: "Yes, apply it",
          saved: "Adjustment applied.",
          saveFailed: "Could not apply the adjustment.",
          insufficient: "That would push the balance below zero.",
          noChange:
            "Nothing to apply — this customer already holds that tier or higher.",
          forbidden: "Only staff accounts can adjust points.",
        },
      },
    },
    transactions: {
      metaTitle: "Transactions",
      title: "Transaction History",
      subtitle: "Every points movement, newest first.",
      date: "Date",
      customer: "Customer",
      order: "Order",
      type: "Type",
      source: "Source",
      amount: "Points",
      empty: "No transactions yet.",
      noMatch: "No transactions match these filters.",
      searchLabel: "Search",
      searchPlaceholder: "Order code or phone…",
      fromLabel: "From",
      toLabel: "To",
      typeAll: "All types",
      sourceAll: "All sources",
      filterCta: "Apply",
      resetCta: "Reset",
      statCount: "Movements",
      statCountHint: "Matching the current filters",
      statIssued: "Points issued",
      statRedeemed: "Points redeemed",
      types: {
        EARN: "Points earned",
        REDEEM: "Reward redeemed",
        ADJUST: "Manual adjustment",
      },
      sources: {
        // `claim` is written only by the proof order taken at signup — there is
        // no scan screen and no manual claim. See auth/actions.ts.
        claim: "Sign-up verification order",
        webhook: "Automatic from Pancake",
        admin: "Entered by staff",
        redeem: "Reward redemption",
        welcome: "Welcome gift",
        checkin: "Daily check-in",
        spin: "Lucky spin",
      },
      // ADJUST rows carry no order code — the staff note stands in for one.
      adjustBy: (who: string) => `by ${who}`,
      adjustLifetime: (points: number) =>
        `${points > 0 ? "+" : ""}${num(points)} lifetime`,
    },
    support: {
      metaTitle: "Support requests",
      title: "Support requests",
      subtitle: "Tickets customers filed from the help center, newest first.",
      statOpen: "Open",
      statOpenHint: "Still waiting for a reply",
      statClosed: "Closed",
      statTotal: "All requests",
      statWeek: "Last 7 days",
      date: "Received",
      customer: "Customer",
      topic: "Topic",
      message: "Message",
      status: "Status",
      statuses: {
        open: "Open",
        closed: "Closed",
      },
      filterLabel: "Show",
      filterAll: "All",
      empty: "No support requests yet.",
      emptyOpen: "No open requests — you're all caught up.",
      view: "Read",
      viewTitle: "Support request",
      replyTo: "Reply to",
      // The ticket keeps the name and email the customer typed, which may not
      // match their account — so a request can exist with no linked customer.
      guest: "No linked account",
      markClosed: "Mark as closed",
      reopen: "Reopen",
      closed: "Request closed.",
      reopened: "Request reopened.",
      updateFailed: "Could not update the request.",
    },
  },
  customer: {
    nav: {
      home: "Home",
      upgradeCta: "Upgrade tier",
      avatarLabel: "Your account",
      rewards: "Rewards",
      spin: "Spin & win",
      // The header wheel's badge dot has no text of its own; these are its
      // screen-reader equivalent. A waiting gift outranks an unused spin —
      // one is owed at the counter, the other only expires tonight.
      spinLeft: (n: number) =>
        n === 1 ? "1 spin left today" : `${n} spins left today`,
      spinPending: (n: number) =>
        n === 1
          ? "1 gift waiting at the counter"
          : `${n} gifts waiting at the counter`,
      roadmap: "Reward roadmap",
      tiers: "Tiers",
      history: "History",
      help: "Help",
      profile: "Profile",
      signOut: "Sign out",
      // Title of the phone-only account sheet behind the avatar, which is where
      // upgradeCta / profile / help / theme / signOut live below md.
      accountMenuTitle: "Account",
      pointsUnit: "points",
      mainLabel: "Main",
      bottomLabel: "Quick links",
    },
    login: {
      metaTitle: "Sign in",
      panelTitle: "Every visit earns something back.",
      panelBody:
        "Sign in to track your points, unlock member tiers and redeem rewards for you and your pet.",
      // The mockup's panel check-list. Shared by /register, which sells the
      // same programme — two copies would drift.
      //
      // The mockup's middle line reads "up to 1.4x". Deliberately not repeated:
      // `membership_tiers.multiplier` is admin data and 0023 already moved the
      // ladder, so a number baked into a translation becomes a false claim the
      // moment an admin edits a tier.
      benefits: [
        "Lifetime spend adds up — redeem rewards with no cap.",
        "Climb the tiers for a higher points multiplier.",
        "Track every order and offer in one place.",
      ],
      // The auth card's tab strip. Both pages render the same strip, so it
      // lives under `login` — a copy under `register` would drift.
      tabLogin: "Sign in",
      tabRegister: "Sign up",
      phone: "Phone number",
      phonePlaceholder: "0912345678",
      password: "Password",
      passwordPlaceholder: "••••••••",
      forgot: "Forgot your password?",
      forgotHint: "Contact support to reset your password.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      submit: "Sign in",
      submitting: "Signing in…",
    },
    register: {
      metaTitle: "Sign up",
      brandTagline: "Collect points and unlock member perks",
      fullName: "Full name",
      fullNamePlaceholder: "e.g. Nguyen Van A",
      email: "Email",
      emailPlaceholder: "you@email.com",
      emailHint: "We use it to reach you about your account and your requests.",
      dob: "Date of birth",
      dobHint:
        "So we can send our wishes and dress up your profile on the day.",
      orderCode: "Most recent order code",
      orderCodePlaceholder: "e.g. 8661",
      // The points half is conditional: signup only claims the order when its
      // status is already claimable, otherwise the webhook credits it later.
      orderCodeHint:
        "Enter the code of an order placed with this phone number. It confirms the number is yours and links your account to the shop — that order's points are added once it has been delivered.",
      terms: "I agree to the ",
      termsLink: "Terms",
      termsAnd: " and ",
      privacyLink: "Privacy policy",
      submit: "Sign up",
      submitting: "Processing…",
    },
    dashboard: {
      metaTitle: "My points",
      greeting: (name: string) => `Welcome back, ${name}`,
      /** Sits under the greeting once the profile names a pet. */
      petLine: (pet: string) => `${pet}'s human 🐾`,
      addPetCta: "Add your pet",
      balanceLabel: "Points available",
      lifetimeLabel: "Lifetime points",
      noTier: "Not a member yet",
      tierProgressLabel: "Progress to the next tier",
      topTier: "You're at the highest tier 🎉",
      /** The same fact at the end of the progress bar, where a sentence would
       *  be truncated to nonsense. */
      topTierShort: "MAX",
      lifetimeSpend: "Total spent",
      spendAway: (amount: string) => `${amount} more to go`,
      percentComplete: (pct: number) => `${pct}% complete`,
      recentTitle: "Recent activity",
      viewAll: "View all",
      emptyTitle: "No activity yet",
      emptyBody: "Place your first order — points land here on their own.",
      checkinTitle: "Daily check-in",
      checkinBody: (points: number) =>
        `Check in once a day for ${num(points)} points.`,
      checkinCta: "Check in",
      checkinPending: "Checking in…",
      checkinDone: "Checked in today",
      checkinSuccess: (points: number) => `+${num(points)} points`,
      // The milestone card. Deliberately NO second progress bar: the hero
      // above already shows one measured in đồng (spend towards the next tier),
      // and a second đồng bar right under it reads as the same journey twice.
      roadmapTitle: "Reward roadmap",
      roadmapReady: (n: number) =>
        n === 1
          ? "1 milestone ready to claim"
          : `${n} milestones ready to claim`,
      roadmapPending: (n: number) =>
        n === 1
          ? "1 prize waiting at the counter"
          : `${n} prizes waiting at the counter`,
      roadmapNext: (name: string, amount: string) =>
        `${amount} more to unlock ${name}.`,
      roadmapAllDone: "You've reached every milestone.",
      roadmapCta: "View roadmap",
      // The five figures the programme spec opens on, in one panel.
      summaryTitle: "Your account at a glance",
      summarySpend: "Total spent",
      summaryEarned: "Points earned all time",
      summaryUsed: "Points used",
      summaryBalance: "Points available",
      summaryTier: "Current tier",
      // Column heads for the recent-activity table.
      colOrder: "Reference",
      colDate: "Date",
      colTotal: "Order total",
      colPoints: "Points",
      /** A row with no money behind it — a redemption, or an order from before 0011. */
      noOrderTotal: "—",
      featuredTitle: "Featured reward",
      updatesTitle: "Latest updates",
      updatesViewAll: "See all posts",
    },
    spin: {
      // No metaTitle: the wheel is a dialog, so no route ever carries its name.
      title: "Spin & win",
      subtitle: "One tap, one prize. Free spins reset every day.",
      spinsLeft: (n: number) => (n === 1 ? "1 spin left" : `${n} spins left`),
      spinsLeftHint: "Resets at midnight",
      spin: "Spin",
      spinning: "Spinning…",
      noSpinsLeft: "No spins left today",
      wheelLabel: "Prize wheel",
      // Read out to screen readers in place of the animation.
      wheelSlice: (name: string, index: number, total: number) =>
        `Slice ${index} of ${total}: ${name}`,
      resultTitle: "You won!",
      resultGiftTitle: "You won a gift!",
      resultPoints: (points: number) =>
        `${num(points)} points have been added to your balance.`,
      resultGift: "Show this screen at the counter to collect your prize.",
      resultNone: "Better luck next time — you still have spins to use.",
      resultNoneDone:
        "Better luck next time. Come back tomorrow for more spins.",
      resultClose: "Nice",
      historyTitle: "Prizes you've won",
      historyEmpty: "Nothing yet — take your first spin.",
      pendingChip: "Not collected",
      collectedChip: "Collected",
      pointsChip: (points: number) => `+${num(points)} pts`,
      noPrizeLabel: "No prize",
      offTitle: "The wheel is taking a break",
      offBody: "There's no spin event running right now. Check back soon.",
    },
    // The spend-milestone ladder (0024). An INDEPENDENT ladder from the tiers:
    // it shares the unit (đồng of lifetime spend) and nothing else.
    roadmap: {
      metaTitle: "Reward roadmap",
      eyebrow: "Milestone programme",
      // Two-tone headline, per the mockup: the second half carries the accent.
      // Split in the catalogue rather than in JSX so a translator controls
      // where the colour break falls — it is not the same word in every
      // language. The trailing space on `title` is load-bearing.
      title: "Spend, ",
      titleAccent: "unlock, collect",
      subtitle:
        "Lifetime spend adds up for good. Reach a milestone and the gift is yours to claim.",
      // NOT "points": the mockup labels this figure as points, but the number
      // and the rungs it is measured against are both đồng of spend.
      spendLabel: "Lifetime spend",
      progressLabel: "Milestones reached",
      // The node's short label — 400k, 1,2tr. The suffix is language, so it
      // lives here rather than in the helper that computes the magnitude.
      thresholdShort: (value: number, unit: "thousand" | "million") =>
        unit === "million" ? `${value}M` : `${value}k`,
      newlyUnlocked: "Ready to claim",
      claimCta: "Claim now",
      claiming: "Claiming…",
      stateClaimed: "Claimed",
      shortfall: (amount: string) => `${amount} to go`,
      pendingChip: "Collect at the counter",
      collectedChip: "Collected",
      claimSuccess: (name: string) =>
        `${name} is yours — show this screen at the counter to collect it.`,
      emptyTitle: "No milestones yet",
      emptyBody:
        "There's no milestone ladder running right now. Check back soon.",
      backToRewards: "Back to the reward store",
    },
    rewards: {
      metaTitle: "Reward store",
      title: "Reward store",
      cost: (points: number) => `${num(points)} points`,
      allCategories: "All",
      exclusiveCategory: "Exclusive",
      exclusiveChip: "Exclusive",
      featuredChip: "Featured",
      hotChip: "Hot",
      lowStock: "Almost gone",
      /** Labels the points figure it sits above, not the page. */
      eyebrow: "Points available",
      earnMoreHint: "Points added automatically",
      historyCta: "Redemption history",
      roadmapCta: "Reward roadmap",
      filterLabel: "Filter by category",
      outOfStock: "Out of stock",
      notEnough: "Not enough points",
      /** Under the price when the balance falls short — the button alone
       *  says only that it cannot be pressed. */
      shortBy: (points: number) => `${num(points)} more points to go`,
      redeem: "Redeem",
      redeeming: "Redeeming…",
      /** Shown on a reward's lock chip and in place of the redeem button. */
      tierRequired: (tierName: string) => `Requires ${tierName}`,
      confirm: (name: string, points: number) =>
        `Redeem ${name} for ${num(points)} points?`,
      success: (name: string) => `Redeemed: ${name}`,
      emptyTitle: "No rewards yet",
      emptyBody: "New rewards are on the way — check back soon.",
    },
    history: {
      metaTitle: "Point history",
      title: "Point history",
      subtitle: "Everything you've earned and spent.",
      transaction: "Transaction",
      kind: "Type",
      time: "Time",
      amount: "Points",
      earn: (code: string | null) => (code ? `Order ${code}` : "Points earned"),
      redeem: "Reward redeemed",
      adjust: "Manual adjustment",
      // Mirrored from admin.transactions so the customer namespace is
      // self-contained.
      types: { EARN: "Earned", REDEEM: "Redeemed", ADJUST: "Adjusted" },
      emptyTitle: "No transactions yet",
      emptyBody: "Your orders will show up here on their own.",
      noMatchTitle: "Nothing matches",
      noMatchBody: "No transactions fit these filters.",
      rangeInvalid: "The start date is after the end date.",
      statCount: "Transactions",
      statEarned: "Points earned",
      statSpent: "Points spent",
      searchLabel: "Search",
      // The search runs against `order_code`, NOT the TXN-… reference in the
      // list, so the placeholder has to name the shop's code and the hint has
      // to rule the visible one out.
      searchPlaceholder: "Shop order code, e.g. 8661…",
      searchHint: "The shop's order code — not the TXN- reference shown below.",
      fromLabel: "From",
      toLabel: "To",
      filterCta: "Apply",
      resetCta: "Reset",
      status: "Status",
      // Every ledger row is already committed, so there is only one state.
      statusDone: "Completed",
    },
    tiers: {
      metaTitle: "Tiers & benefits",
      eyebrow: "Current tier",
      subtitle:
        "Every đồng you spend moves you up. Higher tiers earn points faster and unlock more.",
      noTier: "No tier yet",
      noTierBody: "Place your first order to join the program.",
      progressTitle: "Tier progress",
      maxLabel: "MAX",
      atTop: (name: string) => `You're at the top tier, ${name}.`,
      spendToNext: (amount: string, name: string) =>
        `${amount} more to reach ${name}`,
      spendLabel: "Total spent",
      // Shown when a raised threshold would otherwise read as a demotion.
      grandfathered: (name: string, date: string) =>
        `You reached ${name} in ${date} and it's yours to keep, whatever the requirement becomes.`,
      perksTitle: (name: string) => `${name} privileges`,
      noPerks: "Benefits for this tier are being finalized.",
      thresholdAt: (amount: string) => `From ${amount} spent`,
      cardCta: "View digital card",
      cardTitle: "Membership card",
      // No counter flow exists: points are credited from the phone number on
      // the order, and rewards are redeemed in the app.
      cardBody:
        "Your membership card. Points are credited automatically to this phone number.",
      memberSince: (date: string) => `Member since ${date}`,
      multiplier: (value: number) => `${value}× points`,
      pageTitle: "Tiers & privileges",
      // The mockup's medallion badge. Kept in the catalogue rather than inline
      // so it can be localised even though today both locales say VIP.
      vipChip: "VIP",
      // A PROGRAMME rule, not something the system enforces: customers.tier_id
      // only ever rises, so nothing here may promise a downgrade.
      retentionTitle: "Keeping your tier",
      retentionBody: (tierName: string) =>
        `Under the programme rules, ${tierName} is reviewed 365 days after your last promotion. Automatic downgrades are still being rolled out; for now we handle it by hand — talk to us if anything looks wrong.`,
      progressTo: (name: string) => `Progress to ${name}`,
      progressCaption: "Every đồng you spend counts towards the next tier.",
      benefitsTableTitle: "Tier benefits",
      colTier: "Tier",
      colCondition: "Requirement & earning",
      colBenefits: "Headline benefits",
      currentChip: "Current",
    },
    help: {
      metaTitle: "Support",
      title: "Support center",
      subtitle:
        "We're here to listen and solve any problem. Pick a channel or send us a request below.",
      formTitle: "Send a support request",
      name: "Your name",
      namePlaceholder: "Enter your name",
      email: "Your email",
      emailPlaceholder: "you@email.com",
      topic: "Topic",
      topicPlaceholder: "Choose a topic",
      topics: {
        points: "Points & membership tier",
        rewards: "Rewards & redemption",
        account: "Account & sign-in",
        bug: "App bug",
        feature: "Feature suggestion",
        other: "Something else",
      },
      message: "Details",
      messagePlaceholder: "Describe the problem you ran into…",
      submit: "Send request",
      submitting: "Sending…",
      charCount: (used: number, max: number) => `${num(used)} / ${num(max)}`,
      success: "Request sent. We'll get back to you shortly.",
      hotlineTitle: "Hotline",
      hotlineBadge: "24/7",
      hotlineBody: "Call our team directly.",
      hotlineNumber: "1900 1234",
      // No chat provider is wired up — this card points at the form on the
      // same page, so the copy must promise the form and nothing more.
      chatTitle: "Written request",
      chatBody: "Send us the details and we'll reply by email.",
      chatCta: "Go to the form",
    },
    profile: {
      metaTitle: "Profile",
      title: "Set up your profile",
      /** Once `profile_completed_at` is set, there is nothing left to set up. */
      titleEdit: "Your profile",
      panelTitle: "Welcome to the pack.",
      panelBody:
        "The more we know, the better we can tailor your perks to you and your pet.",
      // Phone only: the desktop rail already carries these, but the phone tab
      // bar has no room for them and the header cannot hold five children.
      settingsSection: "Settings",
      ownerSection: "Owner information",
      fullName: "Full name",
      fullNamePlaceholder: "Your full name",
      dob: "Date of birth",
      petSection: "Pet information",
      petName: "Pet's name",
      petNamePlaceholder: "Your pet's name",
      petType: "Pet type",
      petTypes: { dog: "Dog", cat: "Cat", other: "Other" },
      petDob: "Adoption or birth date",
      petDobHint: "So we remember your pet's big day.",
      orderSection: "Points arrive on their own",
      orderHint:
        "Every order placed with this phone number is added to your balance automatically once it is delivered.",
      submit: "Complete profile",
      submitEdit: "Save changes",
      submitting: "Saving…",
      success: "Profile saved.",
      failed: "Could not save your profile. Please try again.",
    },
    errors: {
      invalidCredentials: "Wrong phone number or password.",
      phoneTaken: "This phone number is already registered.",
      emailTaken: "This email is already used by another account.",
      signupFailed: "Sign-up failed. Please try again.",
      signInFailed: "Sign-in failed. Please try again.",
      rateLimited: "Too many attempts. Please try again in 15 minutes.",
      orderNotLinkable:
        "That order has no customer record in the shop system, so we cannot link your account. Try another order or contact support.",
      orderAlreadyLinked:
        "That order already belongs to a member account. Sign in with the phone number you used before, or contact support.",
      proofFailed: "That order code doesn't match this phone number.",
      // Deliberately distinct from proofFailed: our own outage must not be
      // reported as the customer's mistake, and it must not reveal anything
      // about whether the order or the phone number exists.
      serviceUnavailable:
        "Something went wrong on our side. Please try again in a few minutes.",
      sessionExpired: "Your session expired. Please sign in again.",
      // One per errcode claim_milestone_reward raises (0024). "Locked" and
      // "already claimed" are the two a member can actually hit by racing the
      // page against their own spend, so both name the real cause.
      milestoneLocked: "You haven't reached that milestone yet.",
      milestoneClaimed: "You've already claimed that milestone.",
      milestoneUnavailable: "That milestone is no longer available.",
      milestoneClaimFailed: "Couldn't claim that milestone. Please try again.",
      noCustomer:
        "This login has no loyalty profile yet. Please contact support.",
      rewardNotFound: "This reward is no longer available.",
      outOfStock: "This reward is out of stock.",
      insufficientPoints: "You don't have enough points for this reward.",
      tierTooLow: "Your current tier cannot redeem this reward yet.",
      alreadyCheckedIn: "You already checked in today.",
      checkinUnavailable: "Daily check-in is not available right now.",
      checkinFailed: "Check-in failed. Please try again.",
      noSpinsLeft: "You've used every spin today. Come back tomorrow.",
      spinUnavailable: "The spin wheel is not available right now.",
      spinFailed: "The spin failed. Please try again.",
      redeemFailed: "Redemption failed. Please try again.",
      supportFailed: "Could not send your request. Please try again.",
    },
  },
  // Public site — no login required, unlike everything under `customer`.
  blogSite: {
    metaTitle: "Blog",
    title: "Blog & Promotions",
    tabAll: "All",
    tabArticles: "Articles",
    tabPromotions: "Promotions",
    promotionChip: "Promotion",
    // The tile overlays a category chip on the cover, as the mockup does. The
    // mockup invents three categories the schema has no column for, so the two
    // real post_type values are what gets labelled.
    articleChip: "Guide",
    emptyTitle: "Nothing published yet",
    emptyBody: "Check back soon.",
    backToBlog: "Back to blog",
    notFoundTitle: "Post not found",
    notFoundBody: "This post may have been unpublished or removed.",
  },
  // Shared by the account shell, the public shell and the auth pages.
  footer: {
    label: "Site links",
    copyright: (year: number) => `© ${year} ChiCha Membership`,
    help: "Support",
    faq: "FAQ",
    terms: "Programme rules",
    blog: "Community",
  },
  // Public. Content lives here rather than in a table because the client spec
  // still has six of its seven answers blank — there is nothing for an admin to
  // edit yet. If CMS control is wanted later, reuse blog_posts with a new
  // post_type = 'faq' and the existing admin editor.
  //
  // HOUSE RULE: never describe a flow the code does not have. §9 of the spec
  // says members "enter an order code to convert it to points" — that is NOT
  // what happens. Points are credited by the Pancake webhook; an order code is
  // only used once, at signup, to prove the phone number.
  faq: {
    metaTitle: "FAQ",
    title: "Frequently asked questions",
    subtitle: "How earning, tiers and redeeming work.",
    groups: [
      {
        title: "Earning points",
        items: [
          {
            q: "How do I earn points?",
            a: "Once your account is linked, every order you place with your registered phone number earns points automatically. You do not need to enter anything — an order code is only asked for once, when you sign up, to prove the phone number is yours.",
          },
          {
            q: "How long until points appear?",
            a: "Points are credited once the order reaches a completed state at the shop — delivered, or paid for. Orders that are still being prepared or shipped have not earned yet.",
          },
          {
            q: "I bought something but got no points.",
            a: "The most common cause is that the order was placed with a different phone number than the one on your account. Check the number on the order, then contact support with the order code and we will look into it.",
          },
          {
            q: "Do points expire?",
            a: "No. Points stay in your account until you redeem them.",
          },
        ],
      },
      {
        title: "Products",
        items: [
          {
            q: "How long does ChiCha cassava litter last?",
            a: "We are updating this answer. Please contact support in the meantime.",
          },
          {
            q: "Can it be used in an automatic litter box?",
            a: "We are updating this answer. Please contact support in the meantime.",
          },
          {
            q: "Why does the litter not control odour for me?",
            a: "We are updating this answer. Please contact support in the meantime.",
          },
        ],
      },
    ],
    stillStuckTitle: "Still not answered?",
    stillStuckBody: "Send us the details and we will get back to you.",
    stillStuckCta: "Contact support",
  },
  // Public. Sections come from spec §7-§8, MINUS anything the system does not
  // actually enforce: the "1.000đ = 1 point" formula in §8.1 (points come from
  // the per-product table times the tier multiplier) and the voucher expiry
  // clauses in §8.3.5 (there is no voucher engine yet). Publishing either would
  // be an unenforceable promise. Open items for the client: the privacy policy
  // text, and whether §8.1's formula or the implementation is the one to change.
  terms: {
    metaTitle: "Programme rules",
    title: "ChiCha Membership rules",
    subtitle: "How the loyalty programme works.",
    tierTableTitle: "Membership tiers",
    colTier: "Tier",
    colCondition: "Lifetime spend",
    colMultiplier: "Earn rate",
    sections: [
      {
        id: "eligibility",
        title: "Who can join",
        paragraphs: [
          "Anyone who buys products or uses services at ChiCha. The programme is for retail customers; wholesale purchases do not earn points.",
          "Sign up with your phone number, name, your pet's date of birth and a recent order code. One phone number is one account — orders cannot be merged or split across accounts.",
        ],
      },
      {
        id: "earning",
        title: "Earning points",
        paragraphs: [
          "Points are worked out from the products in each order and multiplied by your tier's earn rate. Only the amount you actually paid counts — after any discounts or vouchers.",
          "An order earns once it is completed at the shop. If an order is cancelled or returned after points have been credited, ChiCha adjusts your balance — get in touch if a correction looks wrong.",
        ],
      },
      {
        id: "tiers",
        title: "Tiers",
        paragraphs: [
          "Your tier is set by your lifetime spend, not by your points balance. Points are the currency you redeem; spend is what moves you up.",
          "Your tier is reviewed 365 days after each promotion. Keep your spending up to hold your tier or move higher.",
        ],
      },
      {
        id: "redeeming",
        title: "Redeeming",
        paragraphs: [
          "Choose a reward in the Rewards section and confirm. Points are deducted at that moment.",
          "A confirmed redemption cannot be changed, cancelled or refunded in points. Please check before you confirm.",
          "Each reward has a limited quantity, and some are only available from a certain tier upwards.",
        ],
      },
      {
        id: "delivery",
        title: "Receiving physical rewards",
        paragraphs: [
          "For rewards that need shipping, ChiCha will contact you to confirm the delivery address. We will try to reach you up to three times.",
          "Delivery normally takes 3-7 working days from the day the redemption is confirmed. Please check the parcel before signing for it.",
          "If a reward is out of stock, ChiCha may substitute another of equivalent value.",
        ],
      },
      {
        id: "privacy",
        title: "Your data",
        paragraphs: [
          "We use your phone number, name and order history to run the programme, contact you about rewards, and provide support. We do not sell your data.",
          "To ask what we hold about you, or to have your account removed, contact support.",
        ],
      },
    ],
  },
  validation: {
    orderRequired: "Order code is required",
    nameRequired: "Name is required",
    emailRequired: "Email is required",
    invalidEmail: "Invalid email",
    phoneRequired: "Phone is required",
    invalidPhone: "Invalid phone number",
    nonNegative: "Cannot be less than 0",
    positive: "Must be greater than 0",
    tierNameRequired: "Tier name is required",
    rewardNameRequired: "Reward name is required",
    spinPrizeNameRequired: "Slice name is required",
    milestoneNameRequired: "Milestone name is required",
    milestoneThresholdRequired: "Spend threshold must be above zero",
    spinPointsRequired: "A points slice must award more than 0",
    invalidStatuses: "Enter comma-separated numbers",
    invalidUrl: "Invalid URL",
    passwordTooShort: "Password must be at least 8 characters",
    termsRequired: "Please accept the terms to continue",
    topicRequired: "Please choose a topic",
    messageRequired: "Please describe the problem",
    messageTooLong: "Please keep it under 2000 characters",
    invalidDate: "Invalid date",
    perkTitleRequired: "Perk title is required",
    tooManyPerks: "At most 6 perks",
    wholeNumber: "Must be a whole number",
    reasonRequired: "A reason is required",
    reasonTooLong: "Please keep it under 500 characters",
    adjustEmpty: "Enter a points change or pick a tier to grant",
    tierRequired: "Pick a tier",
    amountRequired: "Enter the new amount",
    percentileRequired: "Enter a percentage",
    percentileRange: "Must be between 0 and 100",
    effectiveAtRequired: "Pick a date and time",
    blogTitleRequired: "Title is required",
    blogSlugRequired: "Slug is required",
    invalidSlug: "Use lowercase letters, numbers and hyphens only",
    blogContentRequired: "Content is required",
  },
}

export type Messages = typeof en
