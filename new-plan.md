# MASTER PROJECT PLAN DOCUMENT

**Project:** Loyalty & CRM System (Points, Membership Tiers, Reward Redemption)
**Platform Integration:** Pancake POS

---

## 1. TECH STACK & INTEGRATION ENVIRONMENT

- **Framework:** Next.js (App Router), React Server Components, Server Actions.
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth with Google Login).
- **UI/UX:** Tailwind CSS + shadcn/ui. (Clean & Minimalist approach).
- **State & Validation:** React Hook Form, Zod, SWR / React Query (for real-time data fetching on the form).
- **Dev Tools:** Bruno (for mocking APIs), ClickUp (for task management).

---

## 2. DATABASE ARCHITECTURE (SUPABASE)

- **`customers`**:
  - `id` (UUID, Foreign Key to `auth.users.id`, nullable initially).
  - `phone` (Primary identifier), `email` (Optional), `full_name`.
  - `pancake_customer_id` (Used to map data with Pancake POS).
  - `current_points` (Available points for redeeming rewards).
  - `lifetime_points` (Used for tier calculation, never deducted).
  - `tier_id` (Mapped to `membership_tiers`).
- **`membership_tiers`**: `name`, `threshold` (Minimum points required to upgrade), `multiplier` (Point multiplier: x1.5, x2).
- **`product_points`**: `product_code`, `points_awarded`.
- **`rewards`**: `id`, `name`, `points_cost`, `quantity`, `image_url`.
- **`transactions`**: `id`, `phone`, `type` (EARN/REDEEM), `amount`, **`order_code` (UNIQUE constraint)**.

---

## 3. USER & SYSTEM FLOWS

### Flow 1: Interactive Point Claiming (`/claim` page)

_Goal: Smooth, real-time experience with zero login friction._

1. **Access:** Customer scans the QR code and opens the `/claim` form.
2. **Interaction 1 - Enter Order Code:**
   - Once the user finishes typing (onBlur or length met), the UI enters a `loading` state.
   - Frontend calls the Server Action -> Pancake POS API.
   - **UI Display:** Returns an order summary card _(e.g., Order #12345 - Items: T-Shirt x1, Jeans x1 - Estimated Points: 100)_.
3. **Interaction 2 - Enter Phone Number:**
   - Once the phone number is entered, the Backend cross-checks this number with the masked phone number returned from the order in Step 2.
   - **Security Check:** The system will ONLY query the DB for point data if the entered phone number **matches** the order's masked phone number.
   - **UI Display:** Renders a Progress Bar showing current points, current tier (e.g., Gold/Silver), and a prompt like _"Only X points away from redeeming [Reward Y]"_ or _"Almost at Diamond Tier!"_.
4. **Completion:** Customer clicks **"Claim Points Now"**. The system formally adds the points and displays a _"Log in to redeem rewards"_ button.

### Flow 2: Viewing Points & Redeeming Rewards (`/user` page)

_Goal: 1-click login with zero OTP cost, strict anti-hijacking verification._

1. Customer clicks redeem -> Prompts **Google Login**.
2. **Ownership Verification (First time only):**
   - If the Google account has no linked phone number, the form asks for: **Phone Number + 1 Previous Order Code** purchased with that number.
   - The system verifies the order code. If correct -> permanently maps `auth.users.id` to `customers.phone`.
3. **Dashboard UI:**
   - Tab 1: Membership Card, tier progress bar, current available points.
   - Tab 2: Reward Store (Click to redeem, automatically deducts `current_points`).
   - Tab 3: Transaction history (Points earned/redeemed).

### Flow 3: Automated Webhook (Auto-claim for returning customers)

_Goal: No QR scanning required from the 2nd purchase onwards._

1. A returning customer makes a new purchase.
2. Pancake POS updates the order status to "Success" -> Fires a Webhook to our system's `/api/webhooks/pancake` endpoint.
3. Next.js Route Handler processes the payload:
   - Extracts `customerId` and `orderCode`.
   - Checks **Idempotency** (Does this order code already exist in the `transactions` table?).
   - If not: Automatically calculates points (Base Points \* Tier Multiplier) and adds them to the DB.

---

## 4. CORE SECURITY MECHANISMS

1. **Idempotency Check:** The `UNIQUE` constraint on `order_code` in the `transactions` table strictly prevents double-claiming for a single order (whether via the manual form or webhook).
2. **Masked Phone Matching:** Prevents point hijacking by using Regex to match the phone number inputted on the UI against the masked phone number (e.g., `098****321`) returned by Pancake's API.
3. **Privacy Data Check:** The `/claim` page will only render real-time UI data containing personal point balances if the inputted phone number successfully passes the Masked Phone Matching test for that specific order.
4. **Rate Limiting:** Restricts attempts (e.g., max 5 failed submissions / 15 minutes) per IP address to prevent brute-force order code guessing.

---

## 5. ADMIN PORTAL FEATURES (`/admin`)

1. **Dashboard Overview:** Statistics on user count, total points issued/redeemed, and system-wide transaction history.
2. **Rule Configuration:**
   - Membership Tiers (Tier names, Point thresholds, Multipliers).
   - Product Points (Assign specific point values to specific Pancake SKUs).
3. **Reward Store:** Add/Edit/Delete rewards, set point costs, and manage inventory quantities.
4. **CRM Users:** Lookup customers by phone number. Admins have the authority to manually add/deduct points for customer service resolutions.

---

## 6. IMPLEMENTATION MILESTONES

- **Phase 1: DB & Admin Core**
  - Initialize Next.js, configure Supabase (Auth, RLS, Triggers).
  - Create database tables and basic CRUD modules for Admin (Tiers, Rewards).
- **Phase 2: Frontend Interaction & APIs (`/claim` page)**
  - Build the QR claim form UI.
  - Write Server Actions to call Pancake APIs and handle real-time data streaming (Order info, Progress bar) back to the form.
  - Implement Rate Limiting and point addition logic (Insert into transactions).
- **Phase 3: Webhook Gateway & Automation**
  - Open the `/api/webhooks/pancake` endpoint.
  - Write logic to process automated webhooks and handle Idempotency.
- **Phase 4: Redemption Gateway (Customer Dashboard)**
  - Integrate Google Login.
  - Build the "Ownership Verification" flow (Phone + Old Order Code).
  - Develop the Membership Card UI and the point deduction logic for redeeming rewards.

Here is the simplified Project Master Plan using the Phone/Password authentication approach. You can send this version to your colleague to align on the project scope and technical approach.

PROJECT MASTER PLAN (SIMPLIFIED VERSION)
Project: Loyalty & CRM System (Points, Membership Tiers, Reward Redemption)
Integration: Pancake POS

1. CORE AUTHENTICATION STRATEGY
   Authentication: Using Phone Number + Password (via Supabase Auth).

Why: This allows us to launch quickly without complex OAuth (Google/Zalo) setups or SMS OTP costs in the MVP phase.

Future-proofing: OAuth (Google, Zalo) and OTP can be added as a seamless upgrade in later phases.

2. KEY USER FLOWS
   A. Point Claiming (/claim) - No Login Required
   Scan QR: Customer scans the QR code on the order package.

Input: Simple form with Order Code and Phone Number.

Real-time Preview: System fetches data from Pancake POS and instantly displays the order summary and points to be earned.

Confirm: Click "Claim Points" to save points to that phone number.

B. Account & Redemption (/dashboard) - Login Required
Registration/Login: Customer creates an account using their Phone Number + Password.

Auto-Link: Upon registration, the system automatically links the account to any points previously earned via the QR flow using the same phone number.

Dashboard:

Membership Card: View current points, tier progress (e.g., Silver/Gold), and benefits.

Reward Store: Browse and redeem points for rewards.

History: Track earned points and reward redemption logs.

C. Automated Processing (Webhook)
For returning customers, no action is needed. When an order on Pancake POS is marked as "Success", a webhook automatically triggers the system to calculate and add points to the customer’s phone number.

3. MAIN FEATURES
   Customer Portal:

Quick-claim QR form with real-time order data.

Membership Dashboard (Tier progress & Point balance).

Reward Redemption Store.

Transaction History.

Admin Portal (/admin):

Dashboard: Statistics on new users, total points, and redemptions.

Config: Define membership tiers (thresholds, multipliers) and link products to points.

Inventory: Manage gift items and redemption costs.

CRM: Manual adjustment of points and customer support tools.

4. SECURITY & ANTI-SPAM (CORE LOGIC)
   Idempotency: Unique constraint on order_code prevents double-claiming (QR manual or Webhook automated).

Ownership Check: Matching the inputted phone number against the masked phone number returned by Pancake API ensures only the actual buyer gets the points.

Rate Limiting: Protects the system against automated bots attempting to guess order codes.

5. IMPLEMENTATION ROADMAP
   Phase 1: Setup & Core Auth

Setup Next.js, Supabase, and DB tables.

Build "Register" and "Login" (Phone/Password) forms.

Phase 2: QR Claiming Logic

Build /claim UI.

Integrate Pancake POS API for real-time order/point preview.

Implement anti-spam security logic.

Phase 3: Customer Dashboard

Build the Tier/Reward Dashboard.

Implement point deduction logic.

Phase 4: Admin Portal & Webhooks

Build the Admin management dashboard.

Setup POST /api/webhooks/pancake for automated background syncing.

Note: This plan focuses on getting the core value (Tying orders to points and driving customer retention) to market as fast as possible. Future enhancements like social logins or SMS OTPs will be modular additions.
