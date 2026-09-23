import 'dotenv/config';
import { createDatabasePool } from '../server/database-pool';

const pool = createDatabasePool();
try {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Tables:', tables.rows.map(r => r.table_name));
  const legacy = await pool.query('SELECT data FROM public.madina_street_state WHERE id = 1');
  const data = legacy.rows[0]?.data;
  if (data) {
    console.log('Legacy counts:', Object.fromEntries(Object.entries(data).map(([k,v]) => [k, Array.isArray(v) ? v.length : 1])));
    console.log('Legacy fields:', Object.fromEntries(Object.entries(data).map(([k,v]) => [k, [...new Set((Array.isArray(v) ? v : [v]).flatMap(x => Object.keys(x as object)))]])));
    for (const [key, parent, field] of [['collections','houses','houseId'], ['collections','users','collectorId'], ['salaries','staff','staffId'], ['attendance','staff','staffId'], ['loginHistory','users','userId']]) {
      const ids = new Set((data[parent] || []).map((r: any) => r.id));
      console.log(`${key}.${field} missing parents:`, (data[key] || []).filter((r: any) => r[field] && !ids.has(r[field])).length);
    }
  }
  for (const { table_name } of tables.rows) {
    if (/^[a-z_]+$/.test(table_name) && table_name !== 'madina_street_state') {
      const result = await pool.query(`SELECT count(*)::int AS count FROM public."${table_name}"`);
      console.log(table_name, result.rows[0].count);
    }
  }
} catch (error: any) {
  console.error('Inspection failed:', error.code || error.name);
  process.exitCode = 1;
} finally { await pool.end(); }
