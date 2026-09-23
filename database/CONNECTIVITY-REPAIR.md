# Neon connectivity repair — 21 September 2026

The app now uses `@neondatabase/serverless` 1.1.0 Pool for its existing Neon
host. PostgreSQL TCP port 5432 stalled before SSL negotiation completed; verified
HTTPS and secure WebSockets on port 443 work. The exact upstream cause of the
port-5432 stall was not established. DATABASE_URL, credentials, database `neondb`,
schema `public`, and all business rules are unchanged.

The transport is **WSS on TLS port 443**, not independent HTTP queries. The
[official Neon Pool](https://github.com/neondatabase/serverless#pool-and-client)
preserves the existing interactive transaction boundary, advisory lock, snapshot
reads, atomic persistence, COMMIT and ROLLBACK. No transaction code was removed.
The current Node 24 runtime supplies native WebSocket support. Other database
hosts retain node-postgres; an explicit `DATABASE_TRANSPORT=postgres` override
can select the original TCP transport. No migration was run.

## Verification

- SELECT 1 through `server/database-pool.ts`: returned 1.
- Existing relational store read: correct 22-house September database confirmed
  before any test write.
- Live real Express API: POST created one temporary staff record, simultaneous
  identical retries returned the same ID, and subsequent GET requests found one
  record. A completely new server process and database pool still read the row.
- Temporary marker: `TEMP-CONNECTIVITY-71563355-cd89-44a3-b16f-66eb3a27cf16`.
  Exactly one matching test row was deleted using all three marker fields.
- Staff returned to 0. Every application record was deeply compared with the
  initial in-memory snapshot after cleanup: identical. No snapshot was copied
  to disk, and no salary, expense or ledger transaction was created by staff.
- Refresh persistence was verified with fresh API reads. Browser form clicking
  was not automated; the existing form and business logic were not changed in
  this transport repair.
- TypeScript: passed.
- Isolated staff checks: 27 passed.
- Staff PostgreSQL rollback checks: 29 passed.
- Collections read-only verification: 124 passed.
- Expense verification: 38 passed, including database duplicate rejection,
  rollback, and Dashboard/Reports/Financial Summary/Monthly Closing agreement.
- Production build: passed; existing large frontend chunk warning remains.

| September 2026 measure | Verified result |
| --- | ---: |
| Registered / active houses | 22 / 22 |
| Generated dues | 22 |
| Expected collection | Rs. 85,500 |
| Valid collection | Rs. 4,000 |
| Outstanding house dues | Rs. 81,500 |
| Paid / pending houses | 1 / 21 |
| Approved expenses | Rs. 86,000 |
| Ledger inflow | Rs. 4,000 |
| Ledger outflow | Rs. 86,000 |
| Net ledger balance | -Rs. 82,000 |
| Ledger transactions | 2 |
| Final staff count | 0 |

The approved expense `exp-1789805406010`, voucher `EV-406010`, remains unchanged
and has exactly one matching outflow: `ledger-expense-exp-1789805406010`.

## Files changed for connectivity

- `server/database-pool.ts` — shared transport selection and official Neon Pool.
- `server/db.ts` — use shared Pool; retain request transaction implementation.
- `package.json`, `package-lock.json` — add official driver and verification command.
- `.env.example`, `database/README.md` — document transport and verification.
- `scripts/verify-live-connectivity.ts` — guarded read-only/live temporary staff test.
- `scripts/verify-staff.ts`, `scripts/verify-collections.ts`,
  `scripts/verify-expenses.ts`, `scripts/verify-database.ts` — shared Pool.
- `scripts/inspect-database.ts`, `scripts/migrate-database.ts`,
  `scripts/reconcile-collections.ts`, `scripts/reconcile-expenses.ts` — shared Pool
  only; migration/reconciliation commands were not executed.
- `database/CONNECTIVITY-REPAIR.md` — this report.

The earlier staff repair also remains in the working tree: `server/staff-routes.ts`,
`server/database-errors.ts`, `server/module-routes.ts`, `server.ts`,
`src/pages/StaffManagement.tsx`, and the pre-existing staff script/package/db edits.
Those surviving changes were preserved. No authentication changes were made.

The old application process was replaced so the development app on port 3000
uses the new transport. Startup reports a successful Neon connection.
