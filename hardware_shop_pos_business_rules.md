# Hardware Shop POS --- Complete Business Rules & Implementation Specification

**Purpose:** A single source of truth for a developer or coding agent
implementing the hardware-shop POS and inventory-management system.

**Status:** Confirmed decisions are separated from recommendations and
unresolved assumptions. Inspect the existing repository and preserve
working features before making changes.

## 1. Product goal

This is primarily an inventory-management system with POS billing. It
must track what stock came in, what went out, purchase cost, actual sale
revenue, estimated remaining stock, profit, customer udhaar, supplier
payable, returns, damage, and adjustments.

**Critical rule:** Estimated-weight rounding changes inventory deduction
only. It must never change the amount actually charged to the customer.

## 2. Confirmed business decisions

1.  Track udhaar for both customers and suppliers.
2.  Sales below cost are allowed, but show a warning and record the
    action.
3.  Amount-based estimated-weight sales round the stock deduction to the
    nearest **10 grams**.
4.  Customers may receive different negotiated prices. Save the actual
    price on each transaction; changing the default price must not
    rewrite old bills.
5.  Most listed products sell by piece, pack, box, roll, length, or
    area. Cashier enters quantity and actual agreed price.
6.  Selected loose products (especially nails and similar fasteners) may
    use estimated-weight/amount-based sales.
7.  Each product has one canonical inventory base unit. Front end can
    display box, piece, kg, g, roll, metre, square foot, etc.
8.  Keep permanent inventory and financial ledgers; do not silently
    overwrite or delete completed transactions.
9.  Support purchases, customer/supplier returns, cancellations, partial
    payments, expenses, physical stock adjustments, and reports.
10. Label estimated quantities as estimates. Estimated stock cannot
    prove exact unopened-box count without physical box tracking or
    stock counts.

## 3. Product catalogue

Every SKU should have: unique code, name, optional brand, category,
size/specification, base unit, allowed purchase/sale units, conversion
factors, default purchase cost, default selling price, minimum stock,
active status, and optional barcode/image/notes.

Different sizes, brands, or specifications must be separate SKUs
whenever they have separately tracked stock or prices.

### Product categories supplied by the owner

**Fasteners & General Hardware** - Nails: wood nails, headless/lost-head
nails, concrete/masonry nails, roofing nails, wall/panel pins. - Screws:
wood, self-tapping, drywall, self-drilling, machine screws. - Nut bolts:
various sizes, high-tension bolts, machine bolts. - Rawl bolts/plugs:
expansion bolts, plastic wall anchors/plugs. - Washers: metal and
rubber. - Hooks: ceiling and utility wall hooks.

**Hand Tools, Cutting & Measuring** - Hammers: iron claw, wooden
mallets, rubber mallets. - Screwdrivers/testers: flat-head,
Phillips/cross-head, test screwdrivers. - Saws/blades: wood handsaws,
hacksaw frames, metal-cutting blades. - Scissors/cutters: tin snips,
wire cutters, utility/paper knives. - Pliers/wrenches: combination,
cutting, long-nose pliers, adjustable wrenches/spanners. -
Measuring/levelling: 3 m, 5 m, 8 m tapes; steel rulers/straight edges;
spirit levels/water balancers; try squares; chalk/string lines.

**Locks & Door Hardware** - Mortise, padlock, and knob locks. - Brass,
iron, silver/decorative handles and lever sets. - Sliding door bolts,
hasps and staples. - Butt and spring hinges. - Hydraulic door closers. -
Cam locks for drawers/cabinets. - Cabinet handles and knobs.

**Tapes, Glues & Adhesives** - Instant/super glue (Elfy-type). -
Masking, duct/cloth, double-sided, clear/brown packing tape. - Contact
adhesive/Formica gum (Samad Bond-type), epoxy (Araldite-type), PVA/wood
glue, rubber solution. - Silicone sealant tubes.

**Wire Mesh & Wires** - Plastic, fiberglass, and wire mosquito mesh. -
Chicken wire and welded mesh. - Binding wire. - Barbed wire.

### Suggested default units (configure per SKU; not universal)

-   Nails/loose fasteners: grams for approximate loose stock, plus
    box/packet/piece if actually sold that way.
-   Screws/nuts/bolts/washers/hooks: pieces, packets, or boxes.
-   Hand tools, locks, handles, hinges, latches, glue tubes and silicone
    tubes: pieces/sets.
-   Tape: rolls, or metres when cut from a roll.
-   Mesh: metres, square feet/square metres, or rolls based on the
    shop's real practice.
-   Binding wire: kg/g or coil.
-   Barbed wire: metres, kg, or roll. Do not force all products into
    grams. Select units matching the shop's actual sales method.

## 4. Units, conversions, and inventory

### Base-unit model

Each product has one canonical base unit. Purchase and sale units
convert to it using configurable factors.

Examples: - Nail SKU: base unit g; 1 kg = 1,000 g; configured 1
box-equivalent = approximately 1,000 g. - Tape SKU: base unit metre; a
roll converts to its configured length. - Lock SKU: base unit piece; 1
lock = 1 piece.

The 1,000 g box-equivalent is an estimate/configuration, not a guarantee
that every physical box weighs exactly 1 kg. Different nail types/sizes
may need different conversions.

### Stock movements

Stock increases on confirmed received purchases and saleable customer
returns. Stock decreases on completed sales, supplier returns,
damage/loss, and negative adjustments. Positive adjustments increase
stock. Only posted/confirmed movements affect current stock.

Record every movement in an `inventory_movements` ledger. A cached
balance is acceptable only if updated atomically and reconcilable to the
ledger. Do not manage stock by overwriting one number without history.

### Box-equivalent display

For a 1,000 g configured box-equivalent and 10,850 g stock: - Full
box-equivalents = floor(10,850 / 1,000) = 10. - Remainder = 850 g. -
Total equivalent = 10.85 boxes.

This is an equivalent estimate, not proof that 10 physical unopened
boxes exist. Track box opening/repacking or count physically if that
distinction matters.

### Stock availability

Recommended default: prevent negative stock and show available quantity.
If the owner later explicitly enables negative stock, make it a separate
permission/configuration and audit it. Never silently allow negative
stock.

## 5. Sales and billing

### Sale workflow

1.  Select product/SKU.
2.  Select sale mode and unit.
3.  Enter quantity or amount.
4.  Show default price; allow actual agreed transaction price.
5.  Calculate line amount, discount, and base-unit deduction.
6.  Check stock and show relevant warnings.
7.  If below cost, show a warning but allow the sale.
8.  Choose payment status/method: paid, partial, or credit.
9.  Save bill, sale lines, inventory movement, cost snapshot, payment,
    and party-ledger entries atomically.
10. Print/show receipt using actual charged prices.

### Quantity-based sale

`line subtotal = quantity × actual price per selected unit` Apply
explicit discounts, then deduct the equivalent base quantity. Example: 3
locks at Rs. 400 each = Rs. 1,200 before discount; stock decreases by 3
pieces.

### Box/package sale

Use that SKU's configured box/packet/roll conversion. Full box deducts
its configured base quantity; half-box deducts half if fractional
package sales are enabled. Package price may differ by customer. Revenue
is the actual amount charged.

### Weight-based sale

Cashier enters measured weight and price per kg (or selected weight
unit). Deduct measured weight converted to base units. Example: 250 g at
Rs. 450/kg = Rs. 112.50 before any explicitly configured money
rounding/discount. Mark it measured, not estimated.

### Amount-based estimated-weight sale

Use only for SKUs configured for this method (e.g., loose nails): -
Cashier enters the amount actually charged. - Cashier confirms the rate
for this transaction (e.g., Rs. 450/kg, Rs. 350/kg, or Rs. 300/kg). -
Exact estimated grams = `sale_amount / rate_per_kg × 1000`. - Stock
deduction = exact estimate rounded to nearest 10 g. - Revenue remains
the actual amount charged. - Save amount, rate, unrounded estimate,
rounded deduction, and rounding-policy version.

Formula:

``` text
estimated_grams = (sale_amount / rate_per_kg) * 1000
rounded_grams = round_to_nearest_10g(estimated_grams)
```

Examples: - Rs. 100 at Rs. 450/kg -\> 222.22 g estimated -\> 220 g
deducted; revenue Rs. 100. - Rs. 100 at Rs. 350/kg -\> 285.71 g
estimated -\> 290 g deducted; revenue Rs. 100. - Rs. 100 at Rs. 300/kg
-\> 333.33 g estimated -\> 330 g deducted; revenue Rs. 100. - Rs. 50 at
Rs. 450/kg -\> 111.11 g estimated -\> 110 g deducted; revenue Rs. 50.

Rate must be greater than zero. Choose a deterministic halfway rule such
as half-up. Each transaction uses its own actual rate. Changing default
price must not rewrite old sales or deductions.

### Price overrides and below-cost warning

-   Save actual price, discount, and final line amount on each sale
    line.
-   Negotiated price must not alter the product default.
-   Compare net sale amount against the saved cost basis for the sold
    quantity.
-   If below cost, show warning, allow sale, and log user/time.
-   Never use the default price to decide whether an overridden
    transaction was below cost.

### Revenue versus payment

Revenue means the amount charged/sold; payment means money actually
received. - Cash sale: revenue and cash receipt. - Credit sale: revenue
and customer receivable, not cash. - Partial payment: record payment and
remaining balance. - Track payment method and date separately. -
Returns/discounts affect net sales according to the defined accounting
treatment.

## 6. Purchases and supplier accounts

Purchase workflow: 1. Select supplier; enter invoice/reference, purchase
date, optional due date. 2. Add products, received quantities, purchase
units, conversion snapshots, and costs. 3. Enter line discounts and
applicable freight/landed costs. 4. Confirm quantities actually
received. 5. Convert each line into base units and post stock-in. 6.
Record purchase liability and payment made. 7. Keep unpaid amount as
supplier payable.

Example: 10 boxes at configured 1,000 g each -\> 10,000 g stock-in.
Invoice Rs. 4,000, payment Rs. 2,500 -\> payable Rs. 1,500.

Do not add stock for merely ordered but not received goods. If purchase
orders are added later, track ordered and received separately.

### Costing

Recommended starting policy: weighted-average cost, applied
consistently.
`new average cost = (old inventory value + new received inventory cost) / (old base quantity + new received base quantity)`

Use same base unit for quantities and costs. Include freight/landed
costs only according to the configured policy. Save the cost basis used
by each sale so future purchases do not rewrite historical profit.
Handle supplier returns/corrections through linked entries.

Example: a nail box costs Rs. 400 and is configured as 1,000 g -\>
equivalent cost Rs. 0.40/g before landed costs.

## 7. Customer and supplier credit (udhaar)

### Customer

For each sale, record bill total, amount paid, and outstanding. Allow
later partial payments to be allocated to one or multiple bills. Keep
receipt date, method, reference, and user. Optionally support customer
advances.

Example: bill Rs. 2,000, paid Rs. 500 -\> outstanding Rs. 1,500; later
payment Rs. 1,000 -\> outstanding Rs. 500.

### Supplier

For each purchase, record invoice total, amount paid, and payable. Allow
later payments to be allocated to one or multiple purchase invoices.
Optionally support supplier advances/credits.

Example: invoice Rs. 10,000, paid Rs. 4,000 -\> payable Rs. 6,000.

Keep customer receivables and supplier payables separately
understandable. One business/person may have both roles, but do not
double-count balances in reports. Handle payment greater than
outstanding explicitly as an advance or reject it with a clear message;
never silently misallocate.

## 8. Returns, cancellations, damage, and corrections

### Customer return

-   Link to original bill.
-   Returned quantity/amount cannot exceed the eligible unreturned
    portion.
-   Use original saved conversion and stock deduction; do not
    recalculate using today's price or conversion.
-   Saleable goods return to saleable stock; damaged goods go to a
    damage/quarantine state or are written off.
-   Record refund, customer credit, or receivable reduction.
-   Preserve original sale and create linked return/credit note.

For full return of amount-based estimated-weight sale, use the original
rounded stock deduction. For partial returns, define a consistent
proportional allocation and rounding policy.

### Supplier return

Link to original purchase where possible; reduce stock; create supplier
credit/reduce payable; preserve original purchase and create linked
supplier-return record.

### Cancellation

Do not hard-delete completed bills, purchases, payments, or movements.
Create linked reversal entries with reason, user, and timestamp. Prevent
duplicate reversals. If money was received, record refund/customer
credit rather than erasing receipt.

### Damage and stock adjustment

Record damage/loss separately from sales. Physical counts must store
system quantity, counted quantity, difference, reason, user, and time.
Adjust stock through a ledger movement, not by editing balance silently.

## 9. Inventory reports

Current stock:

``` text
opening_stock
+ purchases_received
+ saleable_customer_returns
- completed_sales
- supplier_returns
- damage_or_loss
+/- stock_adjustments
= current_stock
```

Required reports: - Current stock by product and base unit. -
Box-equivalent and loose remainder where configured. - Inventory
valuation. - Stock movement history with opening and closing balance. -
Low-stock/reorder list. - Purchase history by supplier/product. -
Damage, adjustment, and return history. - Estimated versus measured
stock indicator.

Minimum stock threshold is configured per SKU in a consistent unit. Only
posted movements affect current stock.

## 10. Financial reports

### Sales and profit

-   Gross sales, discounts, returns, net sales.
-   Cost of goods sold (COGS) according to chosen costing policy.
-   Gross profit = net sales − COGS.
-   Net profit = gross profit − operating expenses, with other
    income/expenses handled explicitly.
-   Mark profit as estimated if stock/cost inputs are estimated or
    incomplete.

### Cash and balances

-   Cash balance = opening cash + actual cash receipts − actual cash
    payments/withdrawals/refunds and other outflows.
-   Keep bank balance separate if bank transactions are tracked.
-   Customer receivables and supplier payables are not cash.
-   Credit sales are not cash received.

### Required reports

1.  Daily/monthly sales.
2.  Sales by product, category, and customer.
3.  Discounts and below-cost sales.
4.  Purchases by supplier/product.
5.  Inventory on hand and valuation.
6.  Stock movements, damages, and adjustments.
7.  Low-stock products.
8.  Customer outstanding and ledger.
9.  Supplier payable and ledger.
10. Cashbook/bankbook and expenses.
11. Gross profit, COGS, and estimated net profit.
12. Returns, cancellations, and refunds.
13. User activity/audit report.

Define consistently whether each report includes drafts, voids, returns,
tax, discounts, and credit transactions.

## 11. Database/entity recommendations

Fit these entities to the existing stack/database; do not assume a
framework before inspecting the repository.

Suggested tables/entities: - `products` - `categories` - `product_units`
/ `unit_conversions` - `customers` - `suppliers` - `sales` -
`sale_items` - `purchases` - `purchase_items` - `inventory_movements` -
`payments` - `payment_allocations` - `party_ledger` (or clearly
separated customer/supplier ledgers) - `expenses` - `returns` and
`return_items` - `stock_adjustments` - `audit_logs` - Optional:
`cash_accounts`, `cash_movements`, `users`, `roles`, `locations`,
`stock_reservations`

Sale-line fields should include product ID, entered quantity/unit, base
quantity deducted, sale mode, conversion snapshot, actual rate, line
amount, discount, cost snapshot, estimated-weight flag, unrounded grams,
rounded grams, and rounding-policy version.

Use database transactions to post a sale/purchase so the document, stock
movement, financial ledger, and payment cannot partially save. Use
unique document numbers and duplicate-submit protection. Use
decimal/fixed precision for money and quantities where appropriate;
avoid binary floating-point for currency.

## 12. Permissions and audit

Suggested roles (can be simplified for a one-person shop): -
Owner/admin: settings, reports, reversals, adjustments, user
management. - Cashier: sales and receipts; price overrides according to
configured permission. - Stock/purchase operator: receive purchases and
allowed stock actions. - Reports-only user: read-only reports.

Log user, timestamp, action, record reference, old/new values where
appropriate, and reason for sensitive actions. Audit price overrides,
default price changes, below-cost sales, cancellations, returns,
adjustments, and permission changes.

## 13. Validation and edge cases

Handle: - Zero/negative rates or prices. - Invalid/negative
quantities. - Amount-based sale without a valid positive rate. -
Missing/invalid unit conversions. - Insufficient stock. - Duplicate
button clicks/repeated API requests. - Concurrent sales against the same
stock. - Partial/repeated returns. - Payment greater than outstanding. -
Inactive products. - Conversion/price changes after old transactions. -
Rounding boundaries. - Refunds after partial/full payment allocation. -
Session interruption during save. - Fractional quantities for units that
should be whole numbers. - Negative stock only if explicitly enabled and
audited.

## 14. Acceptance tests before launch

1.  **Piece sale:** 3 locks at Rs. 400 -\> Rs. 1,200 revenue and stock
    decreases by 3 pieces.
2.  **Full nail box:** configured 1,000 g box sold -\> stock decreases
    by 1,000 g; revenue equals actual box price.
3.  **Half box:** deduct 500 g if fractional box sale is enabled.
4.  **Amount sale at Rs. 450/kg:** Rs. 100 -\> estimate 222.22 g, deduct
    220 g, revenue Rs. 100.
5.  **Amount sale at Rs. 350/kg:** Rs. 100 -\> estimate 285.71 g, deduct
    290 g, revenue Rs. 100.
6.  **Amount sale at Rs. 300/kg:** Rs. 100 -\> estimate 333.33 g, deduct
    330 g, revenue Rs. 100.
7.  **Negotiated rate:** changes this transaction only; does not change
    defaults/history.
8.  **Below-cost sale:** warning appears, sale is allowed, action is
    audited.
9.  **Customer credit:** Rs. 2,000 bill, Rs. 500 paid -\> outstanding
    Rs. 1,500.
10. **Supplier credit:** Rs. 10,000 purchase, Rs. 4,000 paid -\> payable
    Rs. 6,000.
11. **Customer return:** correct original stock and financial amount
    reversed/credited without deleting sale.
12. **Cancellation:** original document retained; linked reversal
    restores stock/accounts.
13. **Stock adjustment:** difference creates an auditable movement.
14. **Cost history:** new purchases change current weighted average but
    do not rewrite historical sale COGS.
15. **Concurrent sale:** no inconsistent stock or duplicate posting.
16. **Reconciliation:** sales, stock ledger, payments, receivables,
    payables, and cashbook reconcile.

## 15. Implementation order for the coding agent

1.  Inspect the current repository, stack, database schema, existing
    screens, and workflows.
2.  Map current implementation against this specification; preserve
    working features.
3.  Implement catalogue, base units, conversion factors, and SKU rules.
4.  Implement inventory ledger and balance reconciliation.
5.  Implement sales modes, negotiated prices, estimated-weight rounding,
    and below-cost warnings.
6.  Implement purchases and weighted-average costing.
7.  Implement customer/supplier credit, payments, and allocations.
8.  Implement returns, cancellations, damages, and stock adjustments.
9.  Implement reports, audit trail, and permissions.
10. Run acceptance tests and reconcile stock, sales, and accounts.
11. Back up data and test migrations before production deployment.

Do not rewrite the application or assume a particular framework/database
before inspecting the existing project.

## 16. Decisions still needing owner confirmation

These were not fully decided; keep configurable or ask before
implementing irreversible choices: - Existing tech stack and database. -
Whether negative stock is ever allowed. - Currency rounding for
fractional rupees (separate from 10 g stock rounding). - Applicable tax
and how to report it. - Exact selling units for each mesh/wire/tape
SKU. - Whether cashier price overrides have a maximum discount or only
an audit log. - Handling of customer/supplier advances. - Whether
physical box opening/repacking needs tracking. - Multiple locations,
warehouses, or cash drawers. - Whether returns require receipt/owner
approval. - How opening stock and initial costs will be imported.

Do not invent restrictive business rules for unresolved items. Use safe
defaults, make appropriate settings configurable, and clearly show
assumptions to the owner.

------------------------------------------------------------------------

**End of specification.**
