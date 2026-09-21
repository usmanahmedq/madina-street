import 'dotenv/config';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { dashboardPosition, mainDashboardSummary } from '../server/dashboard-finance';
const readOnly = process.argv.includes('--read-only');
import { Pool } from 'pg';
import { RelationalStore } from '../server/relational-store';
import { contribution, currentMonth, generateDues, houseSummary, monthKey, monthSummary, reconcile, refreshDues, validPayment } from '../server/collection-finance';
if (!process.env.DATABASE_URL)
    throw new Error('Existing PostgreSQL data is required.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
let checks = 0;
try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const store = new RelationalStore();
    await store.initialize(client);
    const data = await store.load(client);
    await client.query('ROLLBACK');
    const original = structuredClone(data), m = monthSummary(data), payment = data.collections.find(validPayment);
    assert.ok(payment, 'Verification requires an existing valid receipt');
    assert.equal(monthKey('September', 2026), '2026-09');
    assert.equal(monthKey('September 2026'), '2026-09');
    assert.throws(() => monthKey('2026-13'));
    checks += 3;
    assert.deepEqual(reconcile(data), { duesAdded: 0, ledgerAdded: 0 });
    assert.deepEqual(reconcile(data), { duesAdded: 0, ledgerAdded: 0 });
    assert.equal(generateDues(data, currentMonth()), 0);
    checks += 3;
    assert.deepEqual(data.collections, original.collections);
    assert.deepEqual(data.houses, original.houses);
    checks += 2;
    for (const c of data.collections.filter(validPayment)) {
        assert.equal(data.ledger.filter(e => e.collectionId === c.id).length, 1);
        const due = data.monthlyDues!.find(d => d.houseId === c.houseId && d.month === contribution(c));
        assert.ok(due);
        checks += 2;
    }
    // Exercise cancellation, partial allocation, late fees and date rules on copies only.
    const cancelled = structuredClone(data);
    cancelled.collections.find(c => c.id === payment.id)!.status = 'Cancelled';
    reconcile(cancelled);
    const once = structuredClone(cancelled);
    reconcile(cancelled);
    assert.deepEqual(cancelled, once);
    assert.equal(cancelled.ledger.filter(e => e.reversalOf).length, data.ledger.filter(e => e.reversalOf).length + 1);
    assert.equal(monthSummary(cancelled, contribution(payment)).collected, monthSummary(data, contribution(payment)).collected - payment.totalPaid);
    checks += 3;
    const dated = structuredClone(data);
    dated.collections.find(c => c.id === payment.id)!.paymentDate = '2000-01-01';
    assert.equal(monthSummary(dated).collected, m.collected);
    checks++;
    const partial = structuredClone(data);
    const pc = partial.collections.find(c => c.id === payment.id)!;
    pc.amount = payment.amount / 2;
    pc.lateFee = 200;
    pc.totalPaid = pc.amount + 200;
    refreshDues(partial);
    const pd = partial.monthlyDues!.find(d => d.houseId === payment.houseId && d.month === contribution(payment))!;
    assert.equal(pd.status, 'Partial');
    assert.equal(pd.paidAmount, pc.amount);
    assert.ok(monthSummary(partial).remaining >= 0);
    checks += 3;
    const excluded = structuredClone(data);
    excluded.houses.forEach(h => { h.status = 'Exempted'; });
    assert.equal(generateDues(excluded, '2099-01'), 0);
    checks++;
    process.env.MADINA_TEST_MODE = '1';
    const { app } = await import('../server');
    const { db } = await import('../server/db');
    await db.initialize();
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(r => server.once('listening', r));
    const address = server.address() as {
        port: number;
    };
    const request = async (path: string, body?: unknown) => { const response = await fetch('http://127.0.0.1:' + address.port + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() as any }; };
    try {
        const [dashboard, register, main, ledger, reports, closing, financial] = await Promise.all(['/api/collections/dashboard', '/api/collections', '/api/dashboard/stats', '/api/ledger', '/api/reports/summary', '/api/reports/monthly-closing?month=' + currentMonth(), '/api/financial-summary'].map(p => request(p)));
        for (const r of [dashboard, register, main, ledger, reports, closing, financial]) {
            assert.equal(r.status, 200);
            assert.equal(r.data.success, true);
            checks++;
        }
        assert.equal(dashboard.data.stats.totalCollectedThisMonth, m.collected);
        assert.equal(main.data.stats.totalCollectedThisMonth, m.collected);
        assert.equal(closing.data.summary.totalCollected, m.collected);
        assert.equal(reports.data.stats.totalCollectedThisMonth, m.collected);
        assert.equal(financial.data.summary.monthlyIncome, m.collected);
        assert.deepEqual(register.data.collections, original.collections);
        assert.equal(dashboard.data.stats.remainingCollection, m.remaining);
        assert.equal(main.data.stats.expectedMonthlyIncome, m.expected);
        checks += 8;
        const expectedDashboard = mainDashboardSummary(original);
        assert.ok(isDeepStrictEqual(main.data.stats, expectedDashboard.stats), 'Dashboard API must match the shared backend projection');
        assert.equal(main.data.stats.collectionRatePercentage, m.expected > 0 ? m.collected / m.expected * 100 : 0);
        assert.equal(main.data.stats.paidHouses, m.paidHouses);
        assert.equal(main.data.stats.pendingHouses, m.pendingHouses);
        assert.equal(main.data.stats.collectionPosition.signedAmount, m.remaining);
        assert.equal(main.data.stats.collectionPosition.amount, m.remaining);
        assert.equal(main.data.stats.goodStandingCount, m.paidHouses);
        assert.ok(main.data.topDefaulters.every((d: any) => d.pendingMonthsCount >= 2));
        assert.ok(isDeepStrictEqual(dashboardPosition(100, 40), {signedAmount:60,amount:60,state:'outstanding'}));
        assert.ok(isDeepStrictEqual(dashboardPosition(100, 100), {signedAmount:0,amount:0,state:'settled'}));
        assert.ok(isDeepStrictEqual(dashboardPosition(100, 120), {signedAmount:-20,amount:20,state:'advance'}));
        // These arithmetic cases do not authorize or create advance payments.
        const empty = structuredClone(original);
        empty.houses = []; empty.monthlyDues = []; empty.collections = [];
        assert.equal(mainDashboardSummary(empty).stats.collectionRatePercentage, 0);
        assert.equal(mainDashboardSummary(empty).stats.collectionPosition.state, 'settled');
        const lateFees = structuredClone(original);
        const latePayment = lateFees.collections.find(c => c.id === payment.id)!;
        latePayment.lateFee += 100; latePayment.totalPaid += 100;
        assert.equal(mainDashboardSummary(lateFees).stats.collectionPosition.signedAmount, expectedDashboard.stats.collectionPosition.signedAmount);
        const cancelledDashboard = mainDashboardSummary(cancelled);
        assert.equal(cancelledDashboard.stats.totalCollectedThisMonth, monthSummary(cancelled).collected);
        assert.notEqual(cancelledDashboard.stats.collectionPosition.state, 'advance');
        assert.ok(isDeepStrictEqual(original, data), 'Dashboard calculations must not mutate the loaded real data');
        checks += 17;

        for (const h of data.houses) {
            const profile = await request('/api/houses/' + h.id + '/profile');
            assert.equal(profile.status, 200);
            assert.equal(profile.data.profile.financialSummary.totalPaidAmount, houseSummary(data, h).totalPaidAmount);
            assert.equal(profile.data.profile.financialSummary.outstandingAmount, houseSummary(data, h).outstandingAmount);
            checks += 3;
        }
        if (!readOnly) {
        const retry = await request('/api/collections', { houseId: payment.houseId, month: payment.month, year: payment.year, amount: payment.amount, paymentMethod: payment.paymentMethod });
        assert.equal(retry.status, 409);
        checks++;
        const invalid = await request('/api/collections', { houseId: payment.houseId, month: 'invalid', amount: 4000 });
        assert.equal(invalid.status, 400);
        checks++;
        const generations = await Promise.all([request('/api/collections/bulk-generate', { targetMonth: currentMonth() }), request('/api/collections/bulk-generate', { targetMonth: currentMonth() })]);
        for (const r of generations) {
            assert.equal(r.status, 200);
            assert.equal(r.data.updatedCount, 0);
            checks++;
        }
        const sync = await request('/api/ledger/reconcile', {});
        assert.equal(sync.status, 200);
        assert.equal(sync.data.ledgerAdded, 0);
        checks++;
        }
        const after = (await request('/api/collections')).data.collections;
        assert.deepEqual(after, original.collections);
        checks++;
        const afterLedger = (await request('/api/ledger')).data.ledger;
        assert.equal(afterLedger.length, original.ledger.length);
        checks++;
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const finalData = await store.load(client);
        await client.query('ROLLBACK');
        for (const key of ['houses', 'collections', 'monthlyDues', 'expenses', 'ledger', 'salaries'] as const) {
            assert.ok(isDeepStrictEqual(finalData[key], original[key]), 'Real records changed during verification: ' + key);
            checks++;
        }
        console.log(JSON.stringify({
            checksPassed: checks, readOnly, contributionMonth: currentMonth(),
            registeredHouses: main.data.stats.totalHouses,
            activeHouses: main.data.stats.activeHouses,
            applicableHouses: main.data.stats.applicableHouses,
            expected: m.expected, collected: m.collected, position: main.data.stats.collectionPosition,
            monthlyExpenses: main.data.stats.totalExpensesThisMonth,
            efficiencyPercent: main.data.stats.collectionRatePercentage,
            displayedEfficiency: main.data.stats.collectionRatePercentage.toFixed(1) + '%',
            paidHouses: m.paidHouses, pendingHouses: m.pendingHouses,
            warningHouses: main.data.stats.warningCount, defaulters: main.data.stats.defaulterCount,
            receiptRecords: after.length, ledgerTransactions: afterLedger.length,
            realFinancialRecordsUnchanged: true,
            verified: ['Main Dashboard', 'Collection Dashboard', 'Payment Register', 'All House Profiles', 'Ledger', 'Reports', 'Financial Summary', 'Signed position states', 'Zero target', 'Cancellation and late fees', 'Calculation immutability']
        }, null, 2));
    }
    finally {
        await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
        await db.close();
    }
}
finally {
    client.release();
    await pool.end();
}
