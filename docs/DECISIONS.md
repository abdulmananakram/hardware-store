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
- Reports are generated from the server ledger and can be printed/shared as
  styled browser output. This avoids claiming Urdu PDF shaping support from a
  library that is not bundled.
- The server is an optional sync target. `SYNC_TOKEN` protects sync when
  configured; the local PWA remains the primary working store.

## M1 authentication choice — 2026-10-29

The owner PIN is stored on the device as a salted SHA-256 verifier. The salt
and verifier are stored in the local database, never in the JavaScript bundle.
The first run requires the owner to set a PIN. This is appropriate for the
single-owner, single-device threat model; a platform secure enclave is outside
the current web/PWA scope.
