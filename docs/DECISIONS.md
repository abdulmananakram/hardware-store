# Architecture Decisions

## M1 storage choice — 2026-10-29

Use **IndexedDB through Dexie** as the primary on-device database for the
Android Chrome/PWA target.

Why:

- IndexedDB is available offline in Android Chrome without a WebAssembly
  runtime or OPFS feature dependency.
- Dexie provides typed tables and atomic read/write transactions while keeping
  the SQL/server Prisma layer independent.
- The existing Next.js application can load the client database without
  native platform code.
- SQLite-WASM/OPFS remains a possible later optimization if measured data size
  or query performance requires it.

Money and quantities remain decimal values at the application boundary for
this migration. Existing `round2` and business-rule helpers are retained;
fixed-point storage will be finalized with the M2/M4 sale and payment models.

## M5-M9 operational defaults — 2026-10-29

- Partial payments are allocated oldest outstanding bill first unless explicit
  bill allocations are supplied. Overpayment is rejected; advances are not
  created.
- Purchase freight is included in landed cost and discounts reduce landed
  cost. The API stores both the subtotal and adjustment components.
- Reports are generated from the local Dexie ledger and can be
  printed/shared as styled browser output. This avoids claiming Urdu PDF
  shaping support from a library that is not bundled.
- The server is an optional sync target. `SYNC_TOKEN` protects sync when
  configured; the local PWA remains the primary working store.

## M1 authentication choice — 2026-10-29

The owner PIN is stored on the device as a salted SHA-256 verifier. The salt
and verifier are stored in the local database, never in the JavaScript bundle.
The first run requires the owner to set a PIN. This is appropriate for the
single-owner, single-device threat model; a platform secure enclave is outside
the current web/PWA scope.

## Task 1 offline authority — 2026-10-29

- Dexie/IndexedDB is the device source of truth. Domain transaction functions
 live in `src/lib/localServices.ts` and do not import React or call `fetch`.
- Dexie schema version 2 adds payments and idempotency indexes without clearing
 version 1 data.
- Local services round monetary values to paisa precision with the existing
 `round2` helper and keep estimated stock deductions in integer grams.
- Server hydration remains compatibility-only; local mutations do not wait for
 server availability. Background sync uses asynchronous `fetch`, never
 synchronous XHR.
- The supplied handoff is stored as `docs/HANDOFF_SPEC_v1.md`; its owner
 decisions are treated as authoritative.

## Task 6 backup policy — 2026-10-29

- Dexie exports use file version 2 and preserve client UUIDs and sync status.
- Restore requires an explicit `confirmed` argument; this is the confirmation
 boundary used by a future settings UI.
- A seven-day local reminder default is stored as `backupReminderDays`; the
 last successful export is recorded as `lastBackupAt`.

## Task 8 payment UX — 2026-10-29

- Billing supports cash, full credit, and partial payment. Credit and partial
 payment require a customer; payment above the bill total is rejected.
- Customer payments use the transactional local payment service and allocate
 oldest outstanding bills first. The store refreshes its read cache after the
 transaction succeeds.
- Receipt data exposes the charged total, paid amount, outstanding amount, and
 stored rounding adjustment. Native browser print/share remains the offline
 delivery mechanism.

## Verification boundary — 2026-10-29

- Jest, lint, TypeScript, and production build are automated and currently
 green. Real Android Chrome installation, airplane mode, browser file
 pickers, and native share/print have not been executed in this environment.
- A complete integer-paisa migration and complete local cancellation service
 remain follow-up work; existing decimal-compatible business helpers are
 intentionally preserved to avoid changing established behavior.

## Demo data — 2026-10-29

- `npm run seed:demo` uses `src/lib/demoSeed.ts` and the same Dexie client
 services used by the app for catalogue, opening stock, purchases, sales,
 payments, returns, cancellation, and stock counts.
- Demo records carry `isDemo`; demo seeding is development-only and is not
 exposed in the production UI. Illustrative prices are not market-rate data.
- `tsx` is a development-only script runner required because the repository
 executes TypeScript service modules directly from the seed command.
