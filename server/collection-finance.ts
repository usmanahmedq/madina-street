import { randomUUID } from 'node:crypto';
import type { DatabaseSchema } from './db';
import type { Collection, House, MonthlyDue } from '../src/types';
import { currentMonth, localDate, monthKey, monthLabel } from '../src/utils/contributionMonth';
export { currentMonth, localDate, monthKey, monthLabel };
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const validPayment = (c: Collection) => (!c.status || c.status === 'Paid') && Number.isFinite(Number(c.totalPaid)) && Number(c.totalPaid) > 0;
export const eligible = (h: House) => !h.isDeleted && !['Vacant', 'Exempted', 'Closed', 'Suspended', 'Inactive'].includes(h.status);
export const contribution = (c: Collection) => monthKey(c.month, c.year);
const belongs = (c: Collection, h: House) => c.houseId === h.id;
export function applicable(h: House, month: string) {
    const start = h.registrationMonth ? monthKey(h.registrationMonth) : h.joinedDate?.slice(0, 7);
    return eligible(h) && (!start || start <= month);
}
export function generateDues(data: DatabaseSchema, month: string, onlyHouse?: House) {
    month = monthKey(month);
    const dues = data.monthlyDues ||= [];
    let added = 0;
    for (const h of onlyHouse ? [onlyHouse] : data.houses) {
        if (!applicable(h, month) || dues.some(d => d.houseId === h.id && d.month === month))
            continue;
        dues.push({ id: 'due-' + randomUUID(), houseId: h.id, month, amount: money(Number(h.monthlyFee)), paidAmount: 0, status: 'Pending', createdAt: new Date().toISOString() });
        added++;
    }
    refreshDues(data);
    return added;
}
export function refreshDues(data: DatabaseSchema) {
    const valid = data.collections.filter(validPayment);
    for (const due of data.monthlyDues || []) {
        const paid = money(valid.filter(c => c.houseId === due.houseId && contribution(c) === due.month).reduce((s, c) => s + Number(c.amount), 0));
        due.paidAmount = Math.min(due.amount, Math.max(0, paid));
        due.status = due.paidAmount >= due.amount ? 'Paid' : due.paidAmount > 0 ? 'Partial' : 'Pending';
    }
}
// Projection is read-only: an ungenerated month still has a target based on applicable houses.
export function monthSummary(data: DatabaseSchema, month = currentMonth()) {
    month = monthKey(month);
    const dues: MonthlyDue[] = (data.monthlyDues || []).filter(d => d.month === month).map(d => ({ ...d }));
    for (const h of data.houses.filter(h => applicable(h, month)))
        if (!dues.some(d => d.houseId === h.id))
            dues.push({ id: '', houseId: h.id, month, amount: Number(h.monthlyFee), paidAmount: 0, status: 'Pending', createdAt: '' });
    const collections = data.collections.filter(c => validPayment(c) && contribution(c) === month);
    for (const d of dues) {
        d.paidAmount = Math.min(d.amount, Math.max(0, money(collections.filter(c => c.houseId === d.houseId).reduce((s, c) => s + Number(c.amount), 0))));
        d.status = d.paidAmount >= d.amount ? 'Paid' : d.paidAmount > 0 ? 'Partial' : 'Pending';
    }
    const expected = money(dues.reduce((s, d) => s + d.amount, 0));
    const remaining = money(dues.reduce((s, d) => s + Math.max(0, d.amount - d.paidAmount), 0));
    return { month, dues, collections, expected, remaining, collected: money(collections.reduce((s, c) => s + Number(c.totalPaid), 0)), paidHouses: dues.filter(d => d.status === 'Paid').length, pendingHouses: dues.filter(d => d.status !== 'Paid').length, percentage: expected ? Math.round((expected - remaining) / expected * 100) : 0 };
}
export function houseSummary(data: DatabaseSchema, house: House) {
    const history = data.collections.filter(c => belongs(c, house)).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    const valid = history.filter(validPayment);
    const dues = [
        ...(data.monthlyDues || []).filter(d => d.houseId === house.id && d.month < currentMonth()),
        ...monthSummary(data).dues.filter(d => d.houseId === house.id),
    ];
    const pending = dues.filter(d => d.paidAmount < d.amount);
    const paid = dues.filter(d => d.paidAmount >= d.amount);
    const expected = money(dues.reduce((s, d) => s + d.amount, 0));
    const outstanding = money(pending.reduce((s, d) => s + d.amount - d.paidAmount, 0));
    return { totalPaidAmount: money(valid.reduce((s, c) => s + Number(c.totalPaid), 0)), totalExpectedAmount: expected, outstandingAmount: outstanding,
        paidMonthsCount: paid.length, pendingMonthsCount: pending.length, paidMonthsList: paid.map(d => monthLabel(d.month)), pendingMonthsList: pending.map(d => monthLabel(d.month)),
        collectionPercentage: expected ? Math.round((expected - outstanding) / expected * 100) : 0, lastPaymentDate: valid[0]?.paymentDate, lastReceiptNo: valid[0]?.receiptNo,
        statusClassification: !eligible(house) ? house.status : pending.length > 1 ? 'Defaulter' : pending.length ? 'Warning' : 'Good Standing', houseCols: history };
}
export function reconcile(data: DatabaseSchema, month = currentMonth()) {
    const before = data.ledger.length;
    const duesAdded = generateDues(data, month);
    for (const c of data.collections.filter(validPayment)) {
        const h = data.houses.find(h => h.id === c.houseId);
        if (!h)
            throw new Error('Payment references a missing house: ' + c.id);
        const key = contribution(c);
        if (!(data.monthlyDues || []).some(d => d.houseId === h.id && d.month === key)) {
            // A historical receipt is evidence of a due, even if the house is now inactive.
            data.monthlyDues!.push({ id: 'due-' + randomUUID(), houseId: h.id, month: key, amount: Number(c.amount), paidAmount: 0, status: 'Pending', createdAt: new Date().toISOString() });
        }
        const matches = data.ledger.filter(e => e.collectionId === c.id || (!e.reversalOf && e.referenceType === 'COLLECTION' && e.referenceNo === c.receiptNo));
        if (matches.length > 1)
            throw new Error('Duplicate ledger sources require review: ' + c.receiptNo);
        if (matches.length && (Number(matches[0].credit) !== Number(c.totalPaid) || Number(matches[0].debit) !== 0))
            throw new Error('Ledger amount requires review: ' + c.receiptNo);
        if (matches.length) {
            matches[0].collectionId = c.id;
            matches[0].contributionMonth = key;
            continue;
        }
        data.ledger.push({ id: 'ledger-' + randomUUID(), collectionId: c.id, contributionMonth: key, date: c.paymentDate, referenceNo: c.receiptNo, referenceType: 'COLLECTION', type: 'INCOME', accountHead: 'Monthly Contributions', description: 'Contribution for ' + monthLabel(key) + ' - ' + c.houseNo, debit: 0, credit: Number(c.totalPaid), runningBalance: 0, performedBy: c.collectorName });
    }
    for (const c of data.collections.filter(c => c.status === 'Cancelled')) {
        const entry = data.ledger.find(e => e.collectionId === c.id || (!e.reversalOf && e.referenceType === 'COLLECTION' && e.referenceNo === c.receiptNo));
        if (entry && !data.ledger.some(e => e.reversalOf === entry.id))
            data.ledger.push({ ...entry, id: 'reversal-' + randomUUID(), collectionId: undefined, reversalOf: entry.id, type: 'EXPENSE', date: c.cancelledAt?.slice(0, 10) || localDate(), credit: 0, debit: entry.credit, description: 'Cancelled receipt reversal: ' + c.receiptNo });
    }
    refreshDues(data);
    data.ledger.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let balance = 0;
    for (const entry of data.ledger)
        entry.runningBalance = balance = money(balance + (entry.status === 'Voided' ? 0 : Number(entry.credit) - Number(entry.debit)));
    return { duesAdded, ledgerAdded: data.ledger.length - before };
}
