# Hardware Shop POS v1 Gap Analysis

**Prepared:** 2026-10-29  
**Branch inspected:** `cleanup-db`  
**Scope:** Handoff sections 3-10 and acceptance tests 1-19.

## Source precedence and repository note

The requested `docs/HANDOFF_SPEC_v1.md` and `docs/PRD_v1.md` do not exist in
the repository. This analysis uses the attached `HARDWARE_POS_HANDOFF (1).md`
as the owner-decision handoff, the repository
`hardware_shop_pos_business_rules.md`, the attached PRD snapshot, and
`docs/hardware-billing-mobile.html`. The attached files were read-only and
were not modified.

Statuses:

- **Done:** implemented and supported by current code/tests.
- **Partial:** some behavior or data exists, but it does not meet the full v1
  requirement.
- **Missing:** no adequate implementation found.

## Requirements gap table

| Handoff section / requirement | Status | Evidence / files | Gap to close |
|---|---|---|---|
| 3. SKU identity, code, brand, size/spec, notes | Partial | [src/lib/types.ts](../src/lib/types.ts), [prisma/schema.prisma](../prisma/schema.prisma), [src/components/screens/ItemAddEditScreen.tsx](../src/components/screens/ItemAddEditScreen.tsx) | Basic item name/category/unit/price/stock exists; SKU code, brand, size/spec, notes, and explicit uniqueness are absent. |
| 3. Categories and sub-categories | Partial | [prisma/schema.prisma](../prisma/schema.prisma), [src/app/api/categories/route.ts](../src/app/api/categories/route.ts) | Parent ID exists, but editable sub-category/attribute model and UI workflow are absent. |
| 3. Editable ordered attributes/options and variant generation | Missing | [src/lib/types.ts](../src/lib/types.ts), [src/lib/store.ts](../src/lib/store.ts) | No attribute, option, SKU-combination, generate-variants, or enable/disable model. |
| 3. Bilingual SKU/category names | Partial | [src/lib/types.ts](../src/lib/types.ts), [src/components/screens/ItemAddEditScreen.tsx](../src/components/screens/ItemAddEditScreen.tsx) | English/Urdu fields exist for some records; no complete bilingual catalogue/search model. |
| 3. Base unit, allowed units, conversion factors | Partial | [prisma/schema.prisma](../prisma/schema.prisma), [src/lib/business.ts](../src/lib/business.ts) | Unit conversion exists, but allowed-unit/fractional policy and sale-mode configuration are missing. |
| 3. Default cost/price, min stock, active flag, image | Partial | [prisma/schema.prisma](../prisma/schema.prisma), [src/server/services/itemService.ts](../src/server/services/itemService.ts) | Core fields exist; catalogue completeness and offline primary persistence are not complete. |
| 3. Price history on default-price change | Partial | [prisma/schema.prisma](../prisma/schema.prisma), [src/lib/store.ts](../src/lib/store.ts) | Local fallback records history; server update route does not transactionally record price history. |
| 3. Search by category, option, combination in English/Urdu | Partial | [src/components/screens/InventoryScreen.tsx](../src/components/screens/InventoryScreen.tsx), [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx) | Name/category/Urdu search is partial; option and combination indexing is absent. |
| 4. QTY sale mode | Partial | [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx), [src/server/services/salesService.ts](../src/server/services/salesService.ts) | Quantity sales work, but model uses legacy `quantity`/`qty` terminology rather than the full per-SKU mode/configuration. |
| 4. PACK sale mode and fractional-pack setting | Missing | [src/lib/types.ts](../src/lib/types.ts), [src/server/services/salesService.ts](../src/server/services/salesService.ts) | No explicit PACK mode or fractional-pack setting. |
| 4. WEIGHT sale mode and measured flag | Missing | [src/lib/types.ts](../src/lib/types.ts), [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx) | No measured-weight workflow/model. |
| 4. AMOUNT_EST formula and snapshots | Partial | [src/lib/business.ts](../src/lib/business.ts), [src/server/services/salesService.ts](../src/server/services/salesService.ts) | Formula and examples exist; full per-SKU mode, exact policy/version handling, and complete client flow are incomplete. |
| 4. Below-cost warning and event log | Partial | [src/lib/business.ts](../src/lib/business.ts), [src/server/services/salesService.ts](../src/server/services/salesService.ts), [prisma/schema.prisma](../prisma/schema.prisma) | Server audit exists; required simple `event_log` semantics and complete UI warning path need verification/completion. |
| 4. Insufficient stock blocks sale | Partial | [src/server/services/salesService.ts](../src/server/services/salesService.ts), [src/lib/store.ts](../src/lib/store.ts) | Server rule exists; offline-primary transaction path is not yet the source of truth. |
| 4. Bill rounding setting and rounding adjustment | Missing | [prisma/schema.prisma](../prisma/schema.prisma), [src/lib/types.ts](../src/lib/types.ts) | No setting or bill `rounding_adjustment`. |
| 4. Atomic save, idempotency, duplicate-tap protection | Partial | [src/server/services/salesService.ts](../src/server/services/salesService.ts), [src/lib/store.ts](../src/lib/store.ts) | Server transaction/idempotency exists; client-local atomic transaction and offline-first duplicate protection are missing. |
| 5. Prototype billing speed/feel | Partial | [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx), [docs/hardware-billing-mobile.html](../docs/hardware-billing-mobile.html) | Existing screen has a related mobile flow; chip-driven prototype parity, four modes, and payment UX are incomplete. |
| 5. Sticky search/category rail/chips/bottom bar | Partial | [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx) | Some search and mobile card UI exists; full prototype interaction and attribute chips are absent. |
| 5. Receipt actual prices, print/share | Partial | [src/components/screens/SaleNewScreen.tsx](../src/components/screens/SaleNewScreen.tsx) | Receipt/print behavior is not verified as native offline share/PDF; no robust share implementation found. |
| 6. Inventory movement ledger as source of truth | Partial | [prisma/schema.prisma](../prisma/schema.prisma), [src/server/services/inventoryService.ts](../src/server/services/inventoryService.ts) | Server ledger exists; all required canonical movement types, cost snapshots, opening handling, and client DB authority are incomplete. |
| 6. Cached balance atomically reconcilable | Partial | [src/server/services/inventoryService.ts](../src/server/services/inventoryService.ts), [src/lib/types.ts](../src/lib/types.ts) | Cached quantity is maintained, but no production reconcile function/test against the complete ledger. |
| 6. Box-equivalent display and estimated-stock label | Partial | [src/lib/business.ts](../src/lib/business.ts) | Box/remainder formatting exists; explicit estimated-stock metadata/labels are incomplete. |
| 6. Purchases received quantity, invoice/date/due date | Partial | [src/server/services/purchaseService.ts](../src/server/services/purchaseService.ts), [src/components/screens/PurchaseNewScreen.tsx](../src/components/screens/PurchaseNewScreen.tsx) | Purchase posting exists; invoice reference, due date, received-vs-ordered fields need completion. |
| 6. Discount/freight and landed-cost setting | Missing | [prisma/schema.prisma](../prisma/schema.prisma) | No purchase discount/freight fields or setting. |
| 6. Weighted-average cost and cost snapshots | Partial | [src/lib/business.ts](../src/lib/business.ts), [src/server/services/purchaseService.ts](../src/server/services/purchaseService.ts) | Weighted average exists server-side; complete immutable COGS/reporting coverage is missing. |
| 7. Customer/supplier returns, damage/loss, physical count | Partial | [src/server/services/returnService.ts](../src/server/services/returnService.ts), [src/server/services/cancelService.ts](../src/server/services/cancelService.ts), [src/lib/store.ts](../src/lib/store.ts) | Customer return/cancellation exist; supplier return, dedicated damage/loss, original conversion/AMOUNT_EST proportional return, and physical counted quantity are incomplete. |
| 7. Cancellation linked reversal/no double reversal/refund | Partial | [src/server/services/cancelService.ts](../src/server/services/cancelService.ts) | Core cancellation exists; no-advance refund/payment allocation semantics need completion and offline transaction coverage. |
| 7. No advances and overpayment rejection | Missing | [src/server/services/khataService.ts](../src/server/services/khataService.ts), [src/app/api/khata/route.ts](../src/app/api/khata/route.ts) | Payment allocations/outstanding enforcement is not implemented. |
| 8. On-device SQLite-WASM/OPFS or Dexie primary DB | Missing | [src/lib/store.ts](../src/lib/store.ts), [package.json](../package.json) | Current primary state is Zustand with persisted localStorage; no spike or chosen local DB. |
| 8. Pure client services and one local DB transaction | Missing | [src/server/services/](../src/server/services/), [src/lib/store.ts](../src/lib/store.ts) | Business services are server-side; client domain transaction layer is absent. |
| 8. Optional idempotent `/api/sync` | Missing | [src/app/api/](../src/app/api/) | No `/api/sync` route or sync protocol for local records. |
| 8. `shop_id` on every table | Partial | [prisma/schema.prisma](../prisma/schema.prisma) | Many top-level models have `shopId`; child/ledger/payment models and future entities are not uniformly covered. |
| 8. Decimal-safe money/quantity policy | Partial | [src/lib/business.ts](../src/lib/business.ts), [prisma/schema.prisma](../prisma/schema.prisma) | `round2` is used, but Prisma stores monetary/quantity values as binary `Float`; no documented fixed-point policy. |
| 8. Hashed first-run owner PIN offline | Missing | [src/lib/store.ts](../src/lib/store.ts), [src/server/auth.ts](../src/server/auth.ts), [src/components/screens/LoginScreen.tsx](../src/components/screens/LoginScreen.tsx) | Current login calls server API/APP_PIN; no device hash, first-run setup, or offline login. |
| 8. PWA manifest/service worker/offline app shell | Missing | [src/app/](../src/app/), [public/](../public/) | No manifest/service worker/offline install path found. |
| 8. Backup/export/import | Partial | [scripts/backup.cjs](../scripts/backup.cjs), [README.md](../README.md) | Server SQLite backup script exists; no on-device JSON/DB export/import flow or restore verification. |
| 9. Sales PDF report | Missing | [src/](../src/) | No report query, date range UI, PDF generation, or offline sharing. |
| 9. Stock PDF report/reconciliation | Missing | [src/](../src/) | No report implementation. |
| 9. Udhaar PDF report | Missing | [src/](../src/) | No report implementation. |
| 9. Gross-profit PDF report with estimated marker | Missing | [src/](../src/) | No report implementation. |
| 9. Urdu PDF shaping/RTL verification | Missing | [package.json](../package.json), [src/](../src/) | No PDF/Urdu shaping strategy. |
| 10. English/Urdu switch, dictionary, RTL, bundled font | Missing | [src/components/](../src/components/), [src/lib/store.ts](../src/lib/store.ts) | Some Urdu data/labels exist; no application-wide language setting, `t()`, RTL, or bundled font. |
| 10. In-app low-stock and udhaar notifications | Partial | [src/server/services/salesService.ts](../src/server/services/salesService.ts), [src/app/api/notifications/route.ts](../src/app/api/notifications/route.ts), [src/lib/store.ts](../src/lib/store.ts) | Notification records/actions exist; offline-primary generation and complete reminder settings are incomplete. |
| 10. Pending-sync markers and backup polish | Partial | [src/lib/types.ts](../src/lib/types.ts), [src/lib/store.ts](../src/lib/store.ts) | Legacy sync statuses exist; no local DB queue or `/api/sync` confirmation workflow. |

## Acceptance-test gap table

| # | Acceptance test | Status | Evidence / gap |
|---:|---|---|---|
| 1 | 3 locks at Rs400; revenue and stock | Partial | Existing sale tests cover quantity sales, but not the v1 service against the local primary DB. |
| 2 | Full 1000 g nail box | Partial | Conversion/business logic exists; no complete PACK-mode local service test. |
| 3 | Half box only when enabled | Missing | No fractional-pack configuration or test. |
| 4 | Rs100 at Rs450/kg -> 220 g | Done | [src/lib/business.ts](../src/lib/business.ts), [src/__tests__/unit/business.test.ts](../src/__tests__/unit/business.test.ts). |
| 5 | Rs100 at Rs350/kg -> 290 g | Done | [src/lib/business.ts](../src/lib/business.ts), [src/__tests__/unit/business.test.ts](../src/__tests__/unit/business.test.ts). |
| 6 | Rs100 at Rs300/kg -> 330 g | Done | [src/lib/business.ts](../src/lib/business.ts), [src/__tests__/unit/business.test.ts](../src/__tests__/unit/business.test.ts). |
| 7 | Negotiated rate affects only that transaction | Partial | Sale-line snapshot exists; full immutable default/history test is absent. |
| 8 | Below-cost warns, allows, logs | Partial | Pure rule/server audit exist; end-to-end local flow is absent. |
| 9 | Rs2000 bill, paid Rs500 -> Rs1500 outstanding | Partial | Server has amount fields; no partial-payment allocation model or complete test. |
| 10 | Rs10000 supplier invoice, paid Rs4000 -> Rs6000 payable | Partial | Purchase payable exists; no payment allocation/overpayment test. |
| 11 | Customer return uses original values and keeps sale | Partial | Customer return service exists; original conversion/AMOUNT_EST proportional behavior is incomplete. |
| 12 | Cancellation linked reversal and second cancel blocked | Partial | Cancellation service exists; local transaction and refund/no-advance coverage absent. |
| 13 | Stock count creates adjustment movement | Partial | Adjustment route exists; counted/system quantity model and acceptance test absent. |
| 14 | Purchase changes WAC, not historical COGS | Partial | WAC helper/service exists; immutable report/COGS test absent. |
| 15 | Oversell blocked/no negative stock | Partial | Server sale validation exists; local DB/e2e airplane-mode test absent. |
| 16 | Overpayment rejected | Missing | No complete outstanding allocation enforcement. |
| 17 | Airplane-mode flow, pending sync, retry without duplicates | Missing | Current app depends on localStorage/server APIs; no local DB, PWA, or `/api/sync`. |
| 18 | Full ledger/financial reconciliation | Missing | No complete reconcile service spanning stock, sales, payments, receivables, payables. |
| 19 | Four offline PDF reports reconcile | Missing | Reports and offline PDF pipeline are absent. |

## Confirmed assumptions to carry into implementation

The handoff specifies A1-A5. They should become visible settings or documented
defaults:

1. Bill total half-up rounding to whole rupees, with stored
   `rounding_adjustment`, enabled by default.
2. Quantity-type items default to quantity 1 and editable rate; estimated
   loose-nail items use amount entry.
3. AI import remains optional and online-only.
4. Customer catalogue is lower priority than core operations.
5. Manual on-device backup/export is required because the phone is the
   primary copy.

Additional implementation assumption: use a local database abstraction with a
small repository/service API so the UI cache can later switch between
SQLite-WASM/OPFS and IndexedDB without changing screens. The choice must be
recorded in `docs/DECISIONS.md` after the spike, before M1 implementation.

## Proposed milestone order

1. M1: local DB spike and abstraction, migrations, PIN, PWA shell, backup.
2. M2: catalogue attributes/variants and sale modes.
3. M3: canonical inventory ledger and reconciliation.
4. M4-M5: billing, payments, allocations, receipts/share.
5. M6-M7: purchases, returns, corrections, supplier flows.
6. M8: offline PDF reports.
7. M9: language, notifications, sync, backup polish.
8. M10: optional AI import and customer catalogue only after M1-M9.
