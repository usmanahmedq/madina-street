import type { DatabaseSchema } from './db';
import type { Expense, LedgerEntry } from '../src/types';
import { money } from './collection-finance';

export const validExpense = (expense: Expense) => expense.status === 'Approved';
export const activeLedger = (ledger: LedgerEntry[]) => ledger.filter(entry => entry.status !== 'Voided');

export function rebuildLedgerBalances(ledger: LedgerEntry[]) {
  ledger.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let balance = 0;
  for (const entry of ledger) {
    if (entry.status !== 'Voided') balance = money(balance + Number(entry.credit) - Number(entry.debit));
    entry.runningBalance = balance;
  }
}

// Only ledger records are changed. Source expenses are never edited by reconciliation.
export function reconcileExpenseLedger(data: Pick<DatabaseSchema, 'expenses' | 'ledger'>, expenseIds?: string[], allowUpdate = false) {
  let added = 0;
  let linked = 0;
  let voided = 0;
  for (const expense of data.expenses.filter(e => !expenseIds || expenseIds.includes(e.id))) {
    const matches = data.ledger.filter(entry => entry.expenseId === expense.id ||
      (entry.referenceType === 'EXPENSE' && entry.referenceNo === expense.voucherNo));
    if (matches.length > 1) throw new Error('Duplicate expense ledger references require review: ' + expense.voucherNo);
    const existing = matches[0];
    if (existing?.expenseId && existing.expenseId !== expense.id) throw new Error('Expense voucher links to a different source.');
    if (!validExpense(expense)) {
      if (existing && existing.status !== 'Voided') {
        existing.status = 'Voided';
        existing.expenseId = expense.id;
        existing.voidedAt = expense.voidedAt || new Date().toISOString();
        voided++;
      }
      continue;
    }
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0 || money(amount) !== amount) throw new Error('Invalid approved expense amount: ' + expense.voucherNo);
    if (existing?.status === 'Voided') throw new Error('A voided ledger expense cannot be reposted.');
    if (existing && !allowUpdate && (Number(existing.debit) !== amount || Number(existing.credit) !== 0 || existing.date !== expense.date || existing.type !== 'EXPENSE')) {
      throw new Error('Expense ledger amount/date conflict requires review: ' + expense.voucherNo);
    }
    if (existing) {
      if (!existing.expenseId) { existing.expenseId = expense.id; linked++; }
      if (allowUpdate) Object.assign(existing, { date: expense.date, debit: amount, credit: 0, accountHead: expense.category, description: expense.title });
    } else {
      data.ledger.push({
        id: 'ledger-expense-' + expense.id,
        expenseId: expense.id, referenceNo: expense.voucherNo, referenceType: 'EXPENSE',
        status: 'Posted', type: 'EXPENSE', date: expense.date,
        accountHead: expense.category, description: expense.title,
        debit: amount, credit: 0, runningBalance: 0, performedBy: expense.createdBy,
      });
      added++;
    }
  }
  rebuildLedgerBalances(data.ledger);
  return { added, linked, voided };
}
