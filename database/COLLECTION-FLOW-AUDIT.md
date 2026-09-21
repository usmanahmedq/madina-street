# Collection flow audit — 19 September 2026

## Original paths and root causes

| Area | Source and fault |
| --- | --- |
| Payment Register | GET /api/collections in server.ts correctly read the relational collections table. |
| Collection Dashboard | Requested /api/collections/dashboard, which had no route. Errors rendered zero-valued cards. |
| Generate Dues | Requested /api/collections/bulk-generate, which had no route. No monthly dues table existed. |
| Payment write | Saved a receipt without allocating a due or creating a ledger inflow. |
| Ledger | Read the empty ledger table. Sync Ledger only repeated the read. |
| House status | Used a fixed 2026 month array, omitted the current month, and counted cancelled receipts as paid. |
| Main Dashboard | Filtered collections and expenses to August 2026. |
| Reports | Recomputed incompatible totals, counted cancellations, filtered monthly income by payment date, included fabricated chart values, and used a localhost URL for monthly closing. |

## Repair

`server/collection-finance.ts` centralizes month normalization, eligibility, due allocation, balances and reconciliation. `server/collection-routes.ts` supplies the missing endpoints and transactional payment flow. `monthly_dues` stores fee snapshots with a unique house/month constraint.

Payment receipt, due allocation and ledger entry commit in the existing serialized PostgreSQL request transaction before success is returned. Duplicate paid-month submissions are rejected. Existing partial receipts are allocated by principal; late fees do not settle unrelated principal. Remaining dues cannot become negative. Stored fee snapshots take precedence over current house fees.

Ledger inflows have unique collection IDs. Reconciliation recognizes legacy receipt-linked entries and adds only missing entries. Cancellation retains receipt history, reopens dues and creates a single compensating outflow when a ledger inflow exists. Reconciliation is repeatable. Local JSON writes also commit once per request with atomic file replacement.

Monthly reporting uses contribution month; daily cash reports use payment date. Targets for ungenerated months are read-only projections from applicable house fees. Inactive, exempt, vacant, suspended, closed and deleted houses do not receive new dues. Existing generated obligations are retained.

No retrospective unpaid August obligations were invented. The repair generated September dues and can reconstruct historical obligations evidenced by valid receipts. Original house and receipt records were checked unchanged before commit and after persistence. Authentication and visual layout remain unchanged.

## Actual September 2026 results

| Metric | Value |
| --- | ---: |
| Registered houses | 22 |
| Active houses | 22 |
| Generated dues | 22 |
| Expected target | Rs. 85,500 |
| Existing receipts | 2 |
| Valid payments | 1 |
| Cancelled receipts retained | 1 |
| Collected | Rs. 4,000 |
| Remaining dues | Rs. 81,500 |
| Paid houses | 1 |
| Pending houses | 21 |
| Ledger inflow | Rs. 4,000 |
| Ledger transactions | 1 |

## Verification and operation

- `npm run collections:reconcile`: dry run; rolls back the complete transaction.
- `npm run collections:reconcile -- --apply`: applies the additive schema and idempotent backfill under the application lock.
- `npm run collections:verify`: checks the real dataset through the application API handlers without inserting payment fixtures.
- `npm run lint` and `npm run build`: TypeScript and production compilation.

The dedicated suite checks both dashboards, Payment Register, all 22 house profiles, Ledger, Reports, Financial Summary, duplicate payment rejection, concurrent duplicate due generation and repeated reconciliation. Cancellation, partial principal, late fees and differing payment dates are checked on in-memory copies only. The older `db:verify` fixture suite was not run against the real database because it creates synthetic records.

Restart/redeploy frontend and backend together to load the updated code. The real database backfill is applied. No external hosting deployment was performed. Browser rendering was not automated; verification covers API handlers, data invariants, TypeScript and production compilation.
