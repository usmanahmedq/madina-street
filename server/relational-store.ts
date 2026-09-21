import type { PoolClient } from 'pg';
import type { DatabaseSchema } from './db';

// Dependency order: parent records are written before their children.
export const TABLES = {
  roles: 'roles', users: 'users', houses: 'houses',
  expenseCategories: 'expense_categories', designations: 'designations', staff: 'staff',
  monthlyDues: 'monthly_dues', collections: 'collections', expenses: 'expenses', salaries: 'salaries',
  attendance: 'attendance', ledger: 'ledger', settings: 'settings',
  notifications: 'notifications', backupHistory: 'backup_history',
  loginHistory: 'login_history', auditLogs: 'audit_logs',
} as const satisfies Record<keyof DatabaseSchema, string>;

export const MIGRATION_ID = '20260915_relational_storage_v1';
export const STORAGE_LOCK = 73159015;
type Row = Record<string, any>;
type Column = { column_name: string; data_type: string; is_nullable: string };
const camel = (value: string) => value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
const entries = Object.entries(TABLES) as [keyof DatabaseSchema, string][];
const rowsFor = (data: DatabaseSchema, key: keyof DatabaseSchema): Row[] =>
  key === 'settings' ? (data.settings ? [{ ...data.settings, id: 1 }] : []) : ((data[key] || []) as Row[]);

export class RelationalStore {
  private columns = new Map<string, Column[]>();

  async initialize(client: PoolClient) {
    const result = await client.query<Column & { table_name: string }>(
      `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY ordinal_position`,
      [Object.values(TABLES)],
    );
    for (const table of Object.values(TABLES)) {
      const columns = result.rows.filter(r => r.table_name === table);
      if (!columns.some(c => c.column_name === 'sort_order') || !columns.some(c => c.column_name === 'extra_data')) {
        throw new Error(`Relational schema missing for ${table}. Run npm run db:migrate.`);
      }
      this.columns.set(table, columns);
    }
  }

  async load(client: PoolClient): Promise<DatabaseSchema> {
    // One round trip; JSON conversion retains SQL DATE strings without timezone shifts.
    const query = entries.map(([key, table]) =>
      `SELECT '${key}' AS key, COALESCE(jsonb_agg(to_jsonb(t) ORDER BY sort_order, id), '[]'::jsonb) AS records FROM public.${quote(table)} t`,
    ).join(' UNION ALL ');
    const result = await client.query(query);
    const data: Row = {};
    for (const { key, records } of result.rows) {
      const converted = records.map((record: Row) => {
        const row: Row = { ...record.extra_data };
        for (const [column, value] of Object.entries(record)) {
          if (column === 'sort_order' || column === 'extra_data' || (key === 'settings' && column === 'id')) continue;
          if (value !== null) row[camel(column)] = value;
        }
        return row;
      });
      data[key] = key === 'settings' ? converted[0] : converted;
    }
    if (!data.settings) throw new Error('Settings record missing. Run the database migration.');
    return data as DatabaseSchema;
  }

  async persist(client: PoolClient, data: DatabaseSchema, previous?: DatabaseSchema) {
    for (const [key, table] of entries) {
      const oldRows = rowsFor(previous || {} as DatabaseSchema, key);
      const oldById = new Map(oldRows.map((r, index) => [r.id, { row: r, index }]));
      const rows = rowsFor(data, key);
      const seen = new Set();
      for (const [index, row] of rows.entries()) {
        if (row.id === undefined || seen.has(row.id)) throw new Error(`Missing or duplicate record ID in ${table}`);
        seen.add(row.id);
        const old = oldById.get(row.id);
        if (old && old.index === index && JSON.stringify(old.row) === JSON.stringify(row)) continue;
        await this.upsert(client, table, row, index);
      }
    }
    // Delete only records explicitly removed by this request, in child-first order.
    if (previous) for (const [key, table] of [...entries].reverse()) {
      const ids = new Set(rowsFor(data, key).map(r => r.id));
      const removed = rowsFor(previous, key).filter(r => !ids.has(r.id)).map(r => r.id);
      if (removed.length) await client.query(`DELETE FROM public.${quote(table)} WHERE id = ANY($1)`, [removed]);
    }
  }

  private async upsert(client: PoolClient, table: string, row: Row, index: number) {
    const columns = this.columns.get(table)!;
    const known = new Set(columns.map(c => camel(c.column_name)));
    const extras = Object.fromEntries(Object.entries(row).filter(([key]) => !known.has(key)));
    const supplied = columns.filter(c => !['sort_order', 'extra_data'].includes(c.column_name) && (row[camel(c.column_name)] !== undefined || c.is_nullable === 'YES'));
    const names = [...supplied.map(c => c.column_name), 'sort_order', 'extra_data'];
    const values = supplied.map(c => {
      const value = row[camel(c.column_name)] ?? null;
      if (c.data_type === 'jsonb') return JSON.stringify(value);
      if (value === '' && ['date', 'timestamp with time zone'].includes(c.data_type)) return null;
      return value;
    });
    values.push(index, JSON.stringify(extras));
    await client.query(
      `INSERT INTO public.${quote(table)} (${names.map(quote).join(',')})
       VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')})
       ON CONFLICT (id) DO UPDATE SET ${names.filter(n => n !== 'id').map(n => `${quote(n)} = EXCLUDED.${quote(n)}`).join(',')}`,
      values,
    );
  }
}
