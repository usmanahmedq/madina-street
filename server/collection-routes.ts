import type { Express, Request } from 'express';
import { randomUUID } from 'node:crypto';
import { db, type DatabaseSchema } from './db';
import { applicable, contribution, currentMonth, generateDues, houseSummary, localDate, money, monthKey, monthLabel, monthSummary, reconcile, validPayment, eligible } from './collection-finance';
import { reconcileExpenseLedger } from './expense-finance';
import type { Collection, User } from '../src/types';
export const financeData = (): DatabaseSchema => Object.fromEntries(['houses', 'collections', 'monthlyDues', 'ledger', 'expenses', 'salaries', 'staff'].map(k => [k, db.get(k as keyof DatabaseSchema)])) as unknown as DatabaseSchema;
function persist(data: DatabaseSchema) { db.set('monthlyDues', data.monthlyDues); db.save(); }
export function analytics(data: DatabaseSchema, month = currentMonth()) {
    const m = monthSummary(data, month), today = localDate();
    const valid = data.collections.filter(validPayment);
    const group = (key: 'paymentMethod' | 'collectorName') => [...new Set(m.collections.map(c => c[key]))].map(value => ({ [key === 'paymentMethod' ? 'method' : 'collectorName']: value, amount: money(m.collections.filter(c => c[key] === value).reduce((s, c) => s + c.totalPaid, 0)), count: m.collections.filter(c => c[key] === value).length }));
    const monthlyTrends = Array.from({ length: 12 }, (_, i) => { const date = new Date(m.month + '-01T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() - 11 + i); const summary = monthSummary(data, date.toISOString().slice(0, 7)); return { month: monthLabel(summary.month), collected: summary.collected, expected: summary.expected, receiptsCount: summary.collections.length }; });
    const sorted = [...monthlyTrends].sort((a, b) => a.collected - b.collected);
    const week = new Date(today + 'T00:00:00Z');
    week.setUTCDate(week.getUTCDate() - 6);
    return { success: true, month: m.month, stats: { expectedMonthlyCollection: m.expected, totalCollectedThisMonth: m.collected, remainingCollection: m.remaining, collectionPercentage: m.percentage, totalPaidHouses: m.paidHouses, totalPendingHouses: m.pendingHouses, totalDefaulters: data.houses.filter(h => houseSummary(data, h).statusClassification === 'Defaulter').length, todayCollection: money(valid.filter(c => c.paymentDate === today).reduce((s, c) => s + c.totalPaid, 0)), thisWeekCollection: money(valid.filter(c => c.paymentDate >= week.toISOString().slice(0, 10) && c.paymentDate <= today).reduce((s, c) => s + c.totalPaid, 0)), thisMonthCollection: m.collected }, byPaymentMethod: group('paymentMethod'), byCollector: group('collectorName'), monthlyTrends, highestMonth: { month: sorted.at(-1)!.month, amount: sorted.at(-1)!.collected }, lowestMonth: { month: sorted[0].month, amount: sorted[0].collected } };
}
export function reportSummary(data: DatabaseSchema) {
    const m = monthSummary(data), a = analytics(data);
    const sectors = [...new Set(data.houses.filter(h => !h.isDeleted).map(h => h.sector || 'Unassigned'))].map(sector => {
        const houses = data.houses.filter(h => (h.sector || 'Unassigned') === sector && !h.isDeleted), ids = new Set(houses.map(h => h.id)), dues = m.dues.filter(d => ids.has(d.houseId));
        const expected = money(dues.reduce((s, d) => s + d.amount, 0)), remaining = money(dues.reduce((s, d) => s + d.amount - d.paidAmount, 0));
        return { sector, houses: houses.length, expected, collected: money(m.collections.filter(c => ids.has(c.houseId)).reduce((s, c) => s + c.totalPaid, 0)), dues: remaining, recoveryRate: expected ? Math.round((expected - remaining) / expected * 100) : 0 };
    });
    const valid = data.collections.filter(validPayment), expenses = data.expenses.filter(e => e.status === 'Approved');
    return { success: true, stats: { ...a.stats, totalHouses: data.houses.filter(h => !h.isDeleted).length, activeHouses: data.houses.filter(eligible).length, totalIncome: money(valid.reduce((s, c) => s + c.totalPaid, 0)), totalExpenses: money(expenses.reduce((s, e) => s + e.amount, 0)), totalSalaries: money(data.salaries.reduce((s, e) => s + e.netPaid, 0)), outstanding: money(data.houses.filter(h => !h.isDeleted).reduce((s, h) => s + houseSummary(data, h).outstandingAmount, 0)) }, sectorRecoverySummary: sectors, monthlyTrends: a.monthlyTrends.map(t => { const key = monthKey(t.month); return { month: t.month, Income: t.collected, Expenses: money(expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0) + data.salaries.filter(s => monthKey(s.month, s.year) === key).reduce((s, e) => s + e.netPaid, 0)) }; }), collectionBySector: Object.fromEntries(sectors.map(s => [s.sector, s.collected])), expenseByCategory: Object.fromEntries([...new Set(expenses.map(e => e.category))].map(category => [category, money(expenses.filter(e => e.category === category).reduce((s, e) => s + e.amount, 0))])) };
}
export function registerCollectionRoutes(app: Express) {
    app.get('/api/collections/daily-closing', (req, res) => {
        const date = String(req.query.date || localDate());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            return res.status(400).json({ success: false, message: 'A valid date is required.' });
        const data = financeData(), valid = data.collections.filter(validPayment), approved = data.expenses.filter(e => e.status === 'Approved');
        const collections = valid.filter(c => c.paymentDate === date), expenses = approved.filter(e => e.date === date);
        const totalTodayCollections = money(collections.reduce((s, c) => s + c.totalPaid, 0)), totalTodayExpenses = money(expenses.reduce((s, e) => s + e.amount, 0));
        const openingBalance = money(valid.filter(c => c.paymentDate < date).reduce((s, c) => s + c.totalPaid, 0) - approved.filter(e => e.date < date).reduce((s, e) => s + e.amount, 0) - data.salaries.filter(s => s.paymentDate < date).reduce((s, e) => s + e.netPaid, 0));
        const salaryOutflow = data.salaries.filter(s => s.paymentDate === date).reduce((s, e) => s + e.netPaid, 0);
        const methodSummary: Record<string, number> = {}, collectorSummary: Record<string, {
            amount: number;
            count: number;
        }> = {};
        for (const c of collections) {
            methodSummary[c.paymentMethod] = money((methodSummary[c.paymentMethod] || 0) + c.totalPaid);
            const group = collectorSummary[c.collectorName] ||= { amount: 0, count: 0 };
            group.amount = money(group.amount + c.totalPaid);
            group.count++;
        }
        res.json({ success: true, date, closingReport: { openingBalance, totalTodayCollections, totalTodayExpenses: money(totalTodayExpenses + salaryOutflow), netCash: money(openingBalance + totalTodayCollections - totalTodayExpenses - salaryOutflow), collectionsCount: collections.length, expensesCount: expenses.length, methodSummary, collectorSummary, collections, expenses } });
    });
    app.get('/api/collections/dashboard', (req, res) => { try {
        res.json(analytics(financeData(), req.query.month ? monthKey(String(req.query.month)) : currentMonth()));
    }
    catch (e: any) {
        res.status(400).json({ success: false, message: e.message });
    } });
    app.get('/api/reports/summary', (_req, res) => res.json(reportSummary(financeData())));
    app.get('/api/collections/dues', (req, res) => { try {
        const data = financeData();
        res.json({ success: true, ...monthSummary(data, req.query.month ? monthKey(String(req.query.month)) : currentMonth()) });
    }
    catch (e: any) {
        res.status(400).json({ success: false, message: e.message });
    } });
    app.post('/api/collections/bulk-generate', (req, res) => { try {
        const data = financeData(), month = monthKey(req.body.targetMonth);
        const updatedCount = generateDues(data, month);
        persist(data);
        res.json({ success: true, updatedCount, targetMonth: monthLabel(month) });
    }
    catch (e: any) {
        res.status(400).json({ success: false, message: e.message });
    } });
    app.post('/api/ledger/reconcile', (_req, res) => { try {
        const data = financeData(), result = reconcile(data);
        const expenseResult = reconcileExpenseLedger(data);
        persist(data);
        res.json({ success: true, ...result, ledgerAdded: result.ledgerAdded + expenseResult.added, expenses: expenseResult });
    }
    catch (e: any) {
        res.status(409).json({ success: false, message: e.message });
    } });
    app.post('/api/collections', (req: Request & {
        user?: User;
    }, res) => {
        try {
            const data = financeData(), body = req.body, month = monthKey(body.month, Number(body.year));
            const house = data.houses.find(h => h.id === body.houseId || h.houseNo.toUpperCase() === String(body.houseId).toUpperCase());
            if (!house || !applicable(house, month))
                throw new Error('Select an active, non-exempt house and a contribution month on or after registration.');
            const amount = Number(body.amount), lateFee = Number(body.lateFee || 0);
            if (![amount, lateFee].every(n => Number.isFinite(n) && n >= 0 && money(n) === n) || amount <= 0)
                throw new Error('Payment amounts must be positive monetary values with at most two decimal places.');
            const due = monthSummary(data, month).dues.find(d => d.houseId === house.id)!;
            const remaining = money(due.amount - due.paidAmount);
            if (remaining <= 0)
                return res.status(409).json({ success: false, message: 'This contribution month is already paid.' });
            if (amount !== remaining)
                throw new Error('The payment must equal the outstanding monthly principal: Rs. ' + remaining);
            if (!['Cash', 'Bank Transfer', 'Online Transfer', 'Mobile Wallet', 'JazzCash', 'EasyPaisa', 'JazzCash / EasyPaisa', 'Online', 'Cheque'].includes(body.paymentMethod || 'Cash'))
                throw new Error('Invalid payment method.');
            const stamp = new Date().toISOString(), uuid = randomUUID();
            const collection: Collection = { id: 'col-' + uuid, receiptNo: 'REC-' + month.replace('-', '') + '-' + uuid.toUpperCase(), houseId: house.id, houseNo: house.houseNo, headName: house.headName, sector: house.sector, street: house.street, month: monthLabel(month), year: Number(month.slice(0, 4)), amount, lateFee, totalPaid: money(amount + lateFee), paymentDate: localDate(), paymentMethod: body.paymentMethod || 'Cash', referenceNo: body.referenceNo || '', collectorId: req.user!.id, collectorName: req.user!.name, remarks: body.remarks || '', notes: body.remarks || '', status: 'Paid', createdAt: stamp };
            generateDues(data, month, house);
            data.collections.unshift(collection);
            reconcile(data);
            persist(data);
            res.json({ success: true, collection, message: 'Payment received! Receipt #' + collection.receiptNo });
        }
        catch (e: any) {
            res.status(400).json({ success: false, message: e.message });
        }
    });
    app.get('/api/reports/monthly-closing', (req, res) => {
        try {
            const data = financeData(), m = monthSummary(data, req.query.month ? monthKey(String(req.query.month)) : currentMonth());
            const expenses = data.expenses.filter(e => e.status === 'Approved' && e.date.startsWith(m.month));
            const salaries = data.salaries.filter(s => monthKey(s.month, s.year) === m.month);
            const totalExpenses = money(expenses.reduce((s, e) => s + e.amount, 0)), totalSalaries = money(salaries.reduce((s, e) => s + e.netPaid, 0));
            const unpaid = m.dues.filter(d => d.status !== 'Paid').map(d => ({ ...data.houses.find(h => h.id === d.houseId), currentDues: money(d.amount - d.paidAmount) }));
            res.json({ success: true, month: monthLabel(m.month), summary: { totalCollected: m.collected, totalExpenses, totalSalaries, netClosingBalance: money(m.collected - totalExpenses - totalSalaries), paidHousesCount: m.paidHouses, unpaidHousesCount: m.pendingHouses, expectedTarget: m.expected, remainingDues: m.remaining }, paidCollections: m.collections, expensesList: expenses, salaryPayments: salaries, unpaidHousesList: unpaid });
        }
        catch (e: any) {
            res.status(400).json({ success: false, message: e.message });
        }
    });
}
