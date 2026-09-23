import 'dotenv/config';
import fs from 'node:fs';
import { createDatabasePool } from '../server/database-pool';
import { RelationalStore, TABLES, MIGRATION_ID, STORAGE_LOCK } from '../server/relational-store';
import type { DatabaseSchema } from '../server/db';
import { isDeepStrictEqual } from 'node:util';

const pool = createDatabasePool({ enableChannelBinding: true });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
  await client.query(fs.readFileSync('database/collection-flow.sql', 'utf8'));
  await client.query(fs.readFileSync('database/expense-flow.sql', 'utf8'));
  await client.query(`CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
    id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), record_counts jsonb NOT NULL
  )`);
  const applied = await client.query('SELECT id FROM public.app_schema_migrations WHERE id = $1', [MIGRATION_ID]);
  if (applied.rowCount) {
    console.log('Relational migration already applied; existing records preserved.');
  } else {
    // This row lock also coordinates with the previous JSONB backend.
    const legacy = await client.query('SELECT data FROM public.madina_street_state WHERE id = 1 FOR UPDATE');
    if (!legacy.rowCount) throw new Error('Original database snapshot missing; migration stopped.');
    const source = legacy.rows[0].data as DatabaseSchema;
    const knownKeys = new Set(Object.keys(TABLES));
    for (const key of Object.keys(source)) if (!knownKeys.has(key)) throw new Error(`Unmapped source dataset: ${key}`);

    for (const table of Object.values(TABLES)) {
      const existing = await client.query(`SELECT count(*)::int AS count FROM public."${table}"`);
      if (existing.rows[0].count) throw new Error(`Table ${table} already contains data; refusing to overwrite it.`);
      await client.query(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS extra_data jsonb NOT NULL DEFAULT '{}'::jsonb`);
    }
    const store = new RelationalStore();
    await store.initialize(client);
    await store.persist(client, source);
    const migrated = await store.load(client);
    const counts: Record<string, number> = {};
    // Verify every original field, including permissions and financial values.
    for (const key of Object.keys(TABLES) as (keyof DatabaseSchema)[]) {
      const before: any[] = key === 'settings' ? [source.settings] : (source[key] || []) as any[];
      const after: any[] = key === 'settings' ? [migrated.settings] : (migrated[key] || []) as any[];
      if (before.length !== after.length) throw new Error(`Record count mismatch: ${key}`);
      counts[key] = after.length;
      for (const [index, record] of before.entries()) {
        for (const [field, value] of Object.entries(record)) {
          const actual = after[index][field];
          const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
          if (timestamp ? Date.parse(value as string) !== Date.parse(actual) : !isDeepStrictEqual(value, actual)) {
            throw new Error(`Field verification failed: ${key}[${index}].${field}`);
          }
        }
      }
    }
    await client.query('INSERT INTO public.app_schema_migrations (id, record_counts) VALUES ($1, $2)', [MIGRATION_ID, JSON.stringify(counts)]);
    // Keep the source intact and prevent an older running server from diverging.
    await client.query(`CREATE OR REPLACE FUNCTION public.guard_legacy_madina_storage() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'Legacy storage is archived. Restart the server using relational storage.';
      END $$`);
    await client.query(`CREATE TRIGGER madina_legacy_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
      ON public.madina_street_state FOR EACH STATEMENT EXECUTE FUNCTION public.guard_legacy_madina_storage()`);
    console.log('Verified migration record counts:', counts);
  }
  await client.query('COMMIT');
  console.log('Migration completed. Original JSONB snapshot retained as read-only backup.');
} catch (error: any) {
  await client.query('ROLLBACK');
  console.error('Migration rolled back:', error.code || '', error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
