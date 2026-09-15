# Madina Street PostgreSQL storage

The backend uses the 16 relational tables in `create-tables.sql`. Each normal
field is stored in its named SQL column. `extra_data` retains additional fields
without losing them, and `sort_order` preserves the application's record order.
Financial values use SQL `numeric`; dates return as strings and amounts as numbers.

## Existing Neon database

The migration was applied using `npm.cmd run db:migrate`. It:

1. Locks the original `madina_street_state` snapshot and checks destination tables are empty.
2. Inserts data in foreign-key dependency order inside one transaction.
3. Checks every original field and record count before committing.
4. Records completion in `app_schema_migrations`.
5. Keeps `madina_street_state` intact as a read-only pre-migration backup.

Rerunning the migration after completion preserves the current relational data.
If a check fails, the entire migration rolls back. Nonempty destination tables
without a migration marker require reconciliation; the script will not overwrite them.
The archived snapshot is not a current backup of later changes.

## Running

Set the server-only `DATABASE_URL` in the ignored `.env` file, then run:

```powershell
npm.cmd run dev
```

The database must already have the schema and completed migration. Restart older
server processes after migration; writes from the previous JSONB backend are blocked.
Without `DATABASE_URL`, the existing local JSON development mode remains available.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run db:verify
```

`db:verify` tests all 16 tables inside a rolled-back transaction, including foreign
keys, numeric amounts, dates, permissions and extra fields. It also commits a uniquely
identified temporary notification to verify HTTP persistence, concurrent updates,
failed-write rollback and cleanup. Run this against a development database.

Writes complete before the API returns success. Failed SQL writes roll back the
whole request; constraint violations return HTTP 409. Only changed records are
written, and only explicitly removed records are deleted. Writes from application
instances share a transaction lock; reads use consistent read-only snapshots.
SQL Editor writes should be made during maintenance, since they do not acquire
the application's advisory lock.
