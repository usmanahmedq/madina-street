import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { RelationalStore, STORAGE_LOCK } from '../server/relational-store';
import { reconcile, monthSummary, eligible, currentMonth, validPayment } from '../server/collection-finance';
const apply = process.argv.includes('--apply');
if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is required; this command never substitutes local demo data.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
    await client.query(fs.readFileSync('database/collection-flow.sql', 'utf8'));
    const store = new RelationalStore();
    await store.initialize(client);
    const data = await store.load(client), before = structuredClone(data);
    const result = reconcile(data);
    assert.deepEqual(data.houses, before.houses, 'House records must remain unchanged');
    assert.deepEqual(data.collections, before.collections, 'Original receipts must remain unchanged');
    const once = structuredClone(data);
    assert.deepEqual(reconcile(data), { duesAdded: 0, ledgerAdded: 0 });
    assert.deepEqual(data, once, 'Reconciliation must be idempotent');
    const m = monthSummary(data);
    const report = { mode: apply ? 'APPLY' : 'DRY RUN', contributionMonth: currentMonth(), totalRegisteredHouses: data.houses.filter(h => !h.isDeleted).length, activeHouses: data.houses.filter(eligible).length, generatedDues: m.dues.filter(d => d.id).length, expectedTarget: m.expected, existingReceiptRecords: data.collections.length, existingValidPayments: data.collections.filter(validPayment).length, totalCollected: m.collected, remainingDues: m.remaining, paidHouses: m.paidHouses, pendingHouses: m.pendingHouses, ledgerInflow: data.ledger.reduce((s, e) => s + e.credit, 0), ledgerTransactionCount: data.ledger.length, ...result };
    if (apply) {
        await store.persist(client, data, before);
        const saved = await store.load(client);
        assert.deepEqual(saved.collections, before.collections);
        assert.deepEqual(saved.houses, before.houses);
        assert.equal(monthSummary(saved).collected, m.collected);
        await client.query('COMMIT');
    }
    else
        await client.query('ROLLBACK');
    console.log(JSON.stringify(report, null, 2));
}
catch (error) {
    await client.query('ROLLBACK');
    throw error;
}
finally {
    client.release();
    await pool.end();
}
