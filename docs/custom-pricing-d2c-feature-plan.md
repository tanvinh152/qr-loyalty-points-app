# Feature Specification: Personalized D2C Pricing & Direct Checkout

## 1. Overview
**Business Goal:** Drive customers from third-party marketplaces (Shopee, TikTok) to the proprietary D2C (Direct-to-Consumer) web platform to improve profit margins and customer retention.
**Mechanism:** Offer personalized, user-specific pricing for specific SKUs. Customers who register via QR code will receive exclusive prices set manually or in bulk by the Admin.
**Fulfillment:** Initial phase supports only Cash on Delivery (COD). Orders will be directly synced to the Pancake POS system.

## 2. Admin Interface: Pricing Management Modal
A new modal will be added to the Admin Dashboard (`/admin/customers`) to manage user-specific pricing. It will feature two distinct tabs to accommodate both ad-hoc operations and bulk workflows.

### Tab 1: Manual Assignment (Ad-hoc)
Designed for immediate, one-on-one customer support scenarios.
* **Select Customer:** Autocomplete search input (debounced) searching by Phone Number or Name.
* **Select Product (SKU):** Autocomplete search input for active products.
* **Custom Price:** Numeric input with auto-formatting (e.g., `100,000`).
* **Valid Until (Optional):** Expiration date for the special price.
* **Action:** Submits via Next.js Server Action (`setSingleCustomPrice`).

### Tab 2: Bulk Excel Import (Batch Operations)
Designed for processing lists of converted customers from marketplaces.
* **File Upload:** Drag-and-drop zone for `.xlsx` files.
* **Required Columns:** `phone`, `sku`, `custom_price`, `valid_until` (optional).
* **Client-Side Validation:** Parses the Excel file in the browser using the `xlsx` library. Displays a preview table. Any formatting errors (e.g., negative prices, empty SKUs, invalid phone formats) are highlighted in red immediately before server submission.
* **Action:** Submits a validated JSON array to a Next.js Server Action, which then calls a Supabase RPC for bulk upsert.

## 3. Customer Interface & Checkout Flow
* **Product Display:** If an authenticated user has an active, non-expired record in `customer_special_prices` for a viewed SKU, the UI will cross out the standard price and prominently display the "Exclusive Custom Price" (with highlighted UI to emphasize privilege).
* **Checkout:** 
  * Payment method restricted to **COD (Cash on Delivery)** only.
  * Server-side cart validation ensures the custom price is still valid (not expired) at the time of checkout.
* **Pancake POS Sync:**
  * Upon order placement, an order record is created with `PENDING_SYNC` status.
  * System calls Pancake API (`POST /orders`). 
  * **Pricing Strategy for Pancake:** The standard SKU price is sent in the payload, accompanied by a `discount` parameter representing the difference between the standard price and the custom price. This ensures Pancake's revenue reports remain accurate and the admin can see the applied discount.
  * Upon successful creation, the local order status is updated to `SYNCED` with the `pancake_order_id`.

## 4. Database Architecture & Migrations
A new migration file (e.g., `0023_custom_pricing.sql`) will be created.

### 4.1. Table: `customer_special_prices`
```sql
CREATE TABLE customer_special_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    custom_price NUMERIC NOT NULL CHECK (custom_price >= 0),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, sku)
);
```

### 4.2. Supabase RPC: `bulk_import_special_prices`
A function utilizing `jsonb_to_recordset` to iterate through the uploaded JSON payload. It matches customers via `phone` and performs an `UPSERT` (`ON CONFLICT DO UPDATE`) to ensure idempotency. If a phone number in the Excel file does not match any registered user, that row is safely skipped.

## 5. Defensive Programming & Edge Cases
* **Rate Limiting & Debounce:** Search inputs in the Admin modal must be debounced (300-500ms) to prevent Supabase API spam and respect the rate limit budgets.
* **Pancake Order Sync Failure:** If the Pancake API is down or times out, the local order remains `PENDING_SYNC`. A background job or an Admin "Retry Sync" button is required to ensure no lost orders.
* **Webhook Duplication Prevention:** The system must ensure that when Pancake fires a webhook back for this newly created order, the `claim_points` RPC correctly recognizes the `order_code` and avoids applying loyalty points twice (idempotency rule in `0011_claim_spend.sql`).
