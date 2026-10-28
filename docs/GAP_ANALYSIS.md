# Hardware Shop POS v1 Gap Analysis

**Branch:** `v1-foundation`  
**Updated:** 2026-10-29

The supplied handoff attachment is not present as a repository file. The
owner decisions in the latest task description and
`hardware_shop_pos_business_rules.md` were used as the controlling
requirements. Statuses below describe the code that is actually present and
tested; they do not imply real-device verification.

| Requirement area | Status | Evidence / remaining gap |
|---|---|---|
| Dexie offline database and versioned upgrade | Done | `src/lib/localDb.ts`; version 2 preserves version 1 data. |
| Transactional local sales and purchases | Partial | `src/lib/localServices.ts`, `local-services.test.ts`; store still has legacy optimistic cache paths that need full authoritative hydration. |
| Four sale modes and AMOUNT_EST rounding | Partial | `business.ts`, local services, sale-flow tests; PACK and measured WEIGHT UX are incomplete. |
| Stock blocking, movements, weighted cost, returns | Partial | Local service and ledger tests pass; local cancellation service is not complete. |
| Payments, partial credit, oldest-first allocation | Partial | Partial billing UI, local payment service, and store wiring exist; receipt UI is verified by build only, not browser automation. |
| Offline reports | Done | `localReports.ts`, `local-reports.test.ts`; print/share uses browser APIs. |
| English/Urdu dictionary and RTL foundation | Partial | `i18n.ts`, font, document direction, dashboard/report labels; all screens are not fully translated. |
| Offline PWA shell | Partial | `public/sw.js` caches shell/static assets discovered from `/`; installed Android airplane-mode behavior is not verified. |
| Backup/export/restore | Done | Versioned Dexie export/import and `backup-restore.test.ts`; real device file picker not tested. |
| Local low-stock/Udhaar notifications | Done | `localNotifications.ts`, `local-notifications.test.ts`; in-app only. |
| Server optional sync | Partial | Async sale/purchase sync exists; complete entity queue and last-write-wins reconciliation are incomplete. |
| PDF/report reconciliation | Partial | Offline calculations and print/share are present; no dedicated PDF renderer or Playwright verification. |
| Full catalogue variants/chips | Missing | Attribute types exist, but variant generation and chip-driven SKU workflow are not complete. |
| Migrations and fixed-point storage | Partial | Dexie migration is safe; money remains decimal-compatible at storage boundaries rather than a complete integer-paisa migration. |
| E2E airplane-mode flow | Missing | Playwright is not configured or run. |

## Acceptance-test coverage

| # | Area | Status | Evidence |
|---:|---|---|---|
| 1-4 | AMOUNT_EST examples | Done | `business-rules-acceptance.test.ts` |
| 5 | Insufficient stock blocks | Done | `local-services.test.ts`, `sale-flow.test.ts` |
| 6 | Below-cost warning | Done | `business-rules-acceptance.test.ts` |
| 7 | Idempotent sale retry | Done | `local-services.test.ts` |
| 8 | Transaction rollback | Done | `local-db.test.ts`, local service transaction tests |
| 9 | Weighted-average cost | Done | `purchase-flow.test.ts` |
| 10 | Return limits and stock | Partial | `return-cancel.test.ts`; cancellation remains legacy/store-backed |
| 11 | Double cancellation blocked | Partial | server coverage exists; local cancellation is not complete |
| 12 | Sale-time COGS snapshot | Done | `local-reports.test.ts` |
| 13 | Payment overage rejected | Done | local service payment tests |
| 14 | Partial payment allocation | Partial | service exists; no browser test |
| 15 | Supplier return credit type | Done | local service integration test |
| 16 | Inventory reconciliation | Partial | ledger tests cover movements; full dataset reconciliation test remains |
| 17 | Backup/restore IDs preserved | Done | `backup-restore.test.ts` |
| 18 | Offline reports | Done | `local-reports.test.ts` |
| 19 | Complete airplane-mode UI journey | Missing | Playwright setup and real PWA verification remain |

See `docs/DECISIONS.md` for assumptions and deliberate compatibility
decisions. Items not complete are not claimed as done in the final report.
