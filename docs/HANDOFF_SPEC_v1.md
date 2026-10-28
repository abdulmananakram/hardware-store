# Hardware Shop App: Handoff Spec for the Next Agent (v1)

Read this file fully before touching code. It merges three sources:
1. `PRD_Hardware_Shop_App_v1.docx` (scope, users, NFRs)
2. `Hardware Shop POS: Complete Business Rules & Implementation Specification` (inventory/accounting rules)
3. `hardware-billing-mobile.html` (UI prototype of the billing screen, which defines the *speed and feel* to keep)

Rule of precedence: **owner decisions in section 1 > business rules > PRD > prototype**. Where the prototype is simpler than the rules, the rules win but the tap-count stays low.

Do not rewrite or assume a stack before inspecting the existing repo. Preserve working features.

---

## 1. Owner decisions (final)

| # | Decision |
|---|---|
| 1 | Implement the business rules fully for v1 scope, but billing must stay **2-3 taps** for the common case. |
| 2 | v1 = inventory managed properly + sales done properly + **reports on demand (PDF)**. |
| 3 | Amount-based estimated-weight sale (loose nails) is part of v1. |
| 4 | **Negative stock: never allowed.** Block the sale if stock is insufficient. |
| 5 | **No advances.** Payment greater than outstanding is rejected with a clear message. |
| 6 | **Purchases, supplier payable and weighted-average cost: in v1.** |
| 7 | **Cancellation (linked reversal) and physical stock-count adjustment: in v1.** Customer return, supplier return and damage/loss are also in v1 (assumption: "recommended" = the full set from the rules). |
| 8 | Reports: **4 reports**, exportable/shareable as **PDF** (see section 9). |
| 9 | Platform: **Android only, Samsung S21 (~7x4 in screen)**. No web dashboard in v1. |
| 10 | **Offline-first.** The app is used mostly offline; internet is occasional. Everything core must work with zero connectivity. |
| 11 | **One owner, one account, one device.** No staff logins, no roles in v1. |
| 12 | **No tax.** |
| 13 | UI languages: **English and Urdu**, switchable. Seller is weak in English, so UI is icon-led and visual. |
| 14 | Out of scope for v1: roles/staff, audit-by-user reports, barcode, super-admin/SaaS panel, WhatsApp/SMS notifications, multi-location, purchase orders, web dashboard. |

### Assumptions I made (owner did not answer; keep configurable and surface in Settings)
- A1. Money rounding: line amounts keep 2 decimals internally; the **bill total is rounded half-up to the nearest whole rupee** and the difference is stored as a `rounding_adjustment` on the bill. Setting: rounding on/off.
- A2. Quantity-type items (lock, hinge, tape roll): cashier edits quantity (default 1) and rate (prefilled with default price); total is calculated automatically. Loose-nail style items: cashier enters only the amount.
- A3. AI bulk import from supplier price-list photo/PDF (Gemini, in PRD) is **kept but optional and online-only**; it must never block offline use. Build it last.
- A4. Customer catalog (read-only photo/price list from PRD) is **low priority**; build only after core flows.
- A5. Because the phone holds the only copy of the data, add a **manual backup/export** (and optional cloud backup when online). Losing the phone must not lose the shop's books.

---

## 2. The core idea (do not violate)

**Frontend sells in the shop's natural units. Backend tracks everything in ONE base unit per product.**

- Frontend may show/sell: piece, pack, box, roll, kg, g, metre, sq ft, or "Rs. X worth".
- Every product has exactly one **canonical base unit** (e.g. nails = grams, tape = metre, lock = piece).
- Every sale line stores the entered unit/quantity **and** the base quantity deducted, plus a conversion snapshot.
- Stock changes only through the **inventory ledger** (`inventory_movements`). No silent overwrite of a stock number.
- Revenue = the **actual amount charged**. Stock deduction rounding never changes what the customer pays.

---

## 3. Product catalogue

Each SKU: unique code, name, brand (optional), category, size/spec, base unit, allowed sale/purchase units + conversion factors, default purchase cost, default selling price, minimum stock (low-stock threshold), sale mode (see section 4), active flag, optional image/notes.

- Different size/brand/spec that has separate stock or price = **separate SKU**.
- The prototype models a category as ordered attribute chips, e.g. Nails: Head -> Use -> Size. A SKU is one combination of chip values. Only combinations the shop actually stocks should exist as SKUs (do not auto-create the full cross-product as stocked items; allow "generate variants" then let the owner enable/disable).
- Categories in the prototype: Nails, Screws, Locks, Hinges, Bolts, Nuts. Full owner list (fasteners, hand tools, locks/door hardware, tapes/glues, wire mesh/wires) is in the business-rules source. The shop is small: **no** cement, bricks, sand, bajri, doors, heavy machinery.
- Names are bilingual (English + Urdu). Prototype already has Urdu category names.
- Categories/sub-categories/attributes are owner-editable.
- Price/rate history is logged when the default price changes. Changing a default never rewrites old bills.

---

## 4. Sale modes (per-SKU setting)

| Mode | Used for | Cashier enters | Revenue | Stock deduction (base unit) |
|---|---|---|---|---|
| `QTY` | locks, hinges, tapes, tubes, tools | quantity (default 1), rate (prefilled, editable) | qty x rate, minus explicit discount | quantity x conversion |
| `PACK` | box / packet / roll sold whole | number of packs (0.5 allowed only if fractional packs enabled for that SKU), pack price | packs x price | packs x configured base quantity (e.g. 1 box = 1000 g) |
| `WEIGHT` | measured weight (kg/g) | measured weight, rate per kg/g | weight x rate (round to whole rupee per A1) | weight converted to base. Flag **measured** |
| `AMOUNT_EST` | loose nails and similar | **amount charged**, confirm rate/kg for this sale | exactly the amount entered | estimated, see formula. Flag **estimated** |

### AMOUNT_EST formula (exact)
```
estimated_grams = (sale_amount / rate_per_kg) * 1000
rounded_grams   = round_half_up_to_nearest_10g(estimated_grams)
```
- Rate must be > 0. Rate is confirmed per transaction (prefilled from the SKU default).
- Stock deduction = `rounded_grams`. Revenue = `sale_amount`.
- Store on the sale line: amount, rate, **unrounded** estimate, **rounded** deduction, rounding-policy version (`v1_nearest_10g_half_up`).
- Examples (must pass as tests): Rs100 @450/kg -> 222.22g -> deduct 220g. Rs100 @350/kg -> 285.71g -> 290g. Rs100 @300/kg -> 333.33g -> 330g. Rs50 @450/kg -> 111.11g -> 110g. Revenue is always the amount entered.

### Other sale rules
- Each sale line stores: SKU, entered qty/unit, base qty deducted, sale mode, conversion snapshot, actual rate, discount, final line amount, **cost snapshot**, estimated flag, unrounded/rounded grams, policy version.
- **Negotiated price affects that sale only.** Never alter the SKU default or old bills.
- **Below-cost sale**: compare net line amount against the saved cost basis for the sold quantity (never against default price). Show a warning, **allow** the sale, and log it.
- **Insufficient stock: block** and show available quantity. No negative stock, no override in v1.
- Fractional quantity is allowed only for units configured as fractional (e.g. not for locks).
- "1 box = 1000 g" style conversions are **estimates**. Stock for such SKUs is labelled *estimated*. Box-equivalent display: full boxes = floor(stock / box_size), remainder in base units (10,850 g -> 10 boxes + 850 g; this is **not** proof of 10 sealed boxes).

---

## 5. Billing screen (frontend)

Keep the prototype's feel: sticky search bar at top, category rail on the left (photo/emoji thumbnails), attribute **chips** in the main area, big touch targets, bottom bar with item count + total + "View Bill".

Target flows (taps counted after the screen is open):
- **Loose nails:** category -> chips (Head/Use/Size) -> type amount (quick buttons 50/100/200/500/1000) -> Add. Rate/kg shows prefilled and editable on the same card (not a separate screen).
- **Lock/hinge (QTY):** category -> chips -> (qty stepper, default 1) -> Add. Rate prefilled and editable.
- **Pack:** same as QTY with a "box / half box" toggle if enabled.
- **Weight:** category -> chips -> weight -> Add.

Bill view: list of lines with editable quantity/rate/amount, delete, total, optional customer (name/phone/note), Save, Clear, Print. Save opens payment: **Cash / Credit(Udhaar) / Partial**, paid amount, change or remaining shown live. Confirm & Save posts everything atomically. Receipt shows **actual charged amounts**. Print (connected Bluetooth printer) and share (WhatsApp image/PDF) via native share sheet.

Search must match category, option and combination text, in both English and Urdu (the prototype already indexes them).

Warnings are shown inline on the card (estimated flag, below-cost, low stock, insufficient stock) and never add extra screens to the happy path.

UI rules: icons first, short labels, English/Urdu toggle, uncluttered, advanced fields hidden behind collapsible sections.

---

## 6. Inventory and purchases (backend + screens)

### Ledger
`inventory_movements` is the source of truth. Types: `PURCHASE_IN`, `SALE_OUT`, `CUSTOMER_RETURN_IN`, `SUPPLIER_RETURN_OUT`, `DAMAGE_OUT`, `ADJUSTMENT_IN/OUT`, `REVERSAL`, `OPENING`. Each row: SKU, base qty (signed), source document, timestamp, cost snapshot, note. A cached balance is allowed only if updated in the same transaction and reconcilable to the ledger. Only posted movements affect stock.

```
current_stock = opening + purchases_received + saleable_customer_returns
              - completed_sales - supplier_returns - damage_or_loss +/- adjustments
```

### Purchases
Select supplier, invoice ref, date, optional due date; add lines with received qty, unit, conversion snapshot, cost; optional discount/freight; post stock-in for **received** quantity only; record payment made; unpaid remainder = supplier payable. Example: 10 boxes x 1000 g -> +10,000 g; invoice Rs4,000, paid Rs2,500 -> payable Rs1,500.

### Costing: weighted average (default)
```
new_avg_cost = (old_stock_value + new_received_cost) / (old_base_qty + new_received_base_qty)
```
Same base unit for quantity and cost. Each sale line saves its own cost snapshot so later purchases never rewrite historical profit. Freight/landed cost inclusion is a setting (default: include).

### Corrections
- **Cancellation:** never delete. Create a linked reversal (reason, timestamp), prevent double reversal. Money received -> record refund (no credit balance, since no advances; refund is paid out or applied to the customer's outstanding).
- **Customer return:** linked to the original bill; cannot exceed unreturned portion; uses the **original** conversion and stock deduction (for AMOUNT_EST use the original rounded grams, partial returns allocate proportionally with the same rounding policy); saleable goods return to stock, damaged goods go to damage/write-off; reduces receivable or records refund.
- **Supplier return:** linked to the purchase; reduces stock and payable.
- **Damage/loss:** its own movement type, not a sale.
- **Physical count adjustment:** store system qty, counted qty, difference, reason, time -> posts an adjustment movement. This is how estimated stock is corrected over time.

---

## 7. Udhaar (credit), no advances

- **Customer:** each bill stores total, paid, outstanding. Later payments may be allocated to one or more bills (default: oldest first, owner can choose). Keep date, method, reference.
- **Supplier:** same for purchase invoices.
- A party can be both customer and supplier; reports must not double-count.
- Payment greater than outstanding -> **reject** with a clear message. No advance balances anywhere.
- Customer profile: name, phone, running balance, full transaction history (credits and repayments with date/time). Detect duplicate customers by name/phone.
- "Payment Received" quick action records a repayment without creating a bill.
- In-app notifications only: low-stock and udhaar reminders (no SMS/WhatsApp in v1).

---

## 8. Backend / data architecture

- **Offline-first.** The on-device database is the primary store (e.g. SQLite). Every core feature works with no internet. Cloud sync/backup is a background extra when connectivity appears, not a dependency.
- Single device and single owner, so conflict handling can be simple (last-write-wins on sync). Records created offline show a **"pending sync"** marker until confirmed in the cloud. Sync must be idempotent (use client-generated unique ids; no duplicate posting on retry).
- Tag every row with `shop_id` from day one (multi-tenant-ready even though v1 has one shop).
- Suggested entities (adapt to the existing repo): `products`, `categories`, `attributes`/`attribute_options`, `unit_conversions`, `customers`, `suppliers`, `sales`, `sale_items`, `purchases`, `purchase_items`, `inventory_movements`, `payments`, `payment_allocations`, `party_ledger`, `returns`, `return_items`, `stock_adjustments`, `settings`, `price_history`.
- Skip for v1: `users/roles`, `audit by user`, `cash_accounts` (keep a simple cash in/out view derived from payments). Still log price overrides, below-cost sales, cancellations, returns and adjustments with timestamp and reason in a simple `event_log` so a user/role audit can be added later.
- **Atomic posting:** a sale or purchase writes the document, lines, inventory movements, payments and ledger entries in **one DB transaction**. Duplicate-tap protection via unique document numbers and idempotency keys.
- Money and quantities: use decimal/fixed-point or integer minor units; never binary floats for currency. Quantities in base units (grams as decimal/integer with defined scale).
- Auth: single owner login/PIN protecting app access. Customer personal data (name, phone) protected at rest where practical.
- Backup: manual export of the database/file and optional cloud backup when online (assumption A5).

---

## 9. Reports (PDF, 4 reports)

All reports can be generated on demand, offline, as a PDF that can be saved/shared. State clearly what each includes (drafts: none; cancelled bills: excluded from sales but shown in a cancellations section; returns: deducted; credit sales: included in sales but not as cash).

1. **Sales report:** daily and monthly; gross sales, discounts, returns, net sales; by product/category; below-cost sales list.
2. **Stock report:** current stock per SKU in base unit, box-equivalent + loose remainder where configured, estimated-vs-measured indicator, valuation at weighted-average cost, low-stock/reorder list, plus movement history with opening/closing balance for a chosen period.
3. **Udhaar report:** customer outstanding and ledger; supplier payable and ledger (kept clearly separate).
4. **Profit report:** gross sales - returns = net sales; COGS from sale cost snapshots; gross profit; **mark as estimated** if any estimated-weight stock or incomplete cost input is involved. Expenses are out of v1 unless the owner adds them later, so label this "gross profit".

Report date range selectable. Numbers must reconcile with the ledgers (sales, stock ledger, payments, receivables, payables).

---

## 10. Validation and edge cases to handle
Zero/negative price or rate; negative quantity; AMOUNT_EST without a valid positive rate; missing/invalid unit conversion; insufficient stock; duplicate taps / repeated saves; partial and repeated returns; payment over outstanding; inactive products; conversion/price changes after old transactions (old transactions unaffected); rounding boundaries (x.5 g/10 g half-up, rupee rounding); fractional qty on whole-number units; app killed mid-save (transaction must roll back cleanly); offline records and sync retries.

---

## 11. Acceptance tests (must pass before release)
1. 3 locks @ Rs400 -> Rs1,200 revenue, stock -3 pieces.
2. Full nail box (1000 g config) -> stock -1000 g, revenue = actual box price.
3. Half box -> -500 g (only if fractional boxes enabled).
4. Rs100 @450/kg -> est 222.22 g, deduct 220 g, revenue Rs100.
5. Rs100 @350/kg -> 285.71 g, deduct 290 g, revenue Rs100.
6. Rs100 @300/kg -> 333.33 g, deduct 330 g, revenue Rs100.
7. Negotiated rate affects only that transaction; SKU default and history unchanged.
8. Below-cost sale shows a warning, is allowed, is logged.
9. Customer bill Rs2,000, paid Rs500 -> outstanding Rs1,500; later Rs1,000 -> Rs500.
10. Supplier invoice Rs10,000, paid Rs4,000 -> payable Rs6,000.
11. Customer return reverses stock and amount using original values; original sale is kept.
12. Cancellation keeps the original and posts a linked reversal; second cancel blocked.
13. Stock count difference creates an adjustment movement.
14. New purchase changes the current weighted average but not historical sale COGS.
15. Attempt to sell more than stock -> blocked; no negative stock.
16. Overpayment -> rejected with a clear message.
17. Whole flow works in airplane mode; records show "pending sync" then clear after sync; no duplicates after retry.
18. Reconciliation: ledger stock, sales, payments, receivables, payables all agree.
19. All four reports render to PDF offline and match the ledgers.

---

## 12. Suggested build order
1. Inspect the repo, stack, schema, screens; map against this file; keep what works.
2. Catalogue, attributes/variants, base units, conversions, bilingual names.
3. Inventory ledger + reconciliation.
4. Billing UI per prototype + the four sale modes + below-cost/low-stock/insufficient-stock handling + atomic save.
5. Payments, customer udhaar, receipts (print/share).
6. Purchases, supplier payable, weighted-average cost.
7. Returns, cancellation, damage, stock count.
8. Four PDF reports.
9. Offline/sync polish, backup/export, in-app notifications.
10. Optional: AI price-list import (online only), customer catalog.
11. Run acceptance tests; test migrations and backup/restore before real use.

Do not invent restrictive business rules for anything not listed here. Use a safe default, make it a setting, and show the assumption to the owner.
