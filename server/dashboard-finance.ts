import type { DatabaseSchema } from './db';
import { applicable, currentMonth, eligible, houseSummary, money, monthSummary, validPayment } from './collection-finance';

export function dashboardPosition(expected: number, applied: number) {
  const signedAmount = money(expected - applied);
  return {
    signedAmount,
    amount: Math.abs(signedAmount),
    state: signedAmount > 0 ? 'outstanding' as const : signedAmount < 0 ? 'advance' as const : 'settled' as const,
  };
}

// Read-only dashboard projection. Payment acceptance, allocation and ledger rules stay unchanged.
export function mainDashboardSummary(data: DatabaseSchema) {
  const month = currentMonth();
  const monthly = monthSummary(data, month);
  const houses = data.houses.filter(h => !h.isDeleted);
  const summaries = houses.map(house => ({ house, summary: houseSummary(data, house) }));
  const collections = data.collections.filter(validPayment);
  const appliedCollections = money(monthly.dues.reduce((sum, due) => sum + due.paidAmount, 0));
  // Only allocated principal reduces dues. Late fees and other months are not advances.
  // There is currently no authorized advance-credit source and overpayments are rejected.
  const collectionPosition = dashboardPosition(monthly.expected, appliedCollections);
  const collectionRatePercentage = monthly.expected > 0 ? monthly.collected / monthly.expected * 100 : 0;
  const totalExpensesThisMonth = money(data.expenses
    .filter(e => e.status === 'Approved' && e.date.startsWith(month))
    .reduce((sum, e) => sum + Number(e.amount), 0));
  const topDefaulters = summaries
    .filter(s => s.summary.statusClassification === 'Defaulter')
    .sort((a, b) => b.summary.outstandingAmount - a.summary.outstandingAmount)
    .slice(0, 5)
    .map(({ house, summary }) => ({
      houseId: house.id, houseNo: house.houseNo, headName: house.headName, phone: house.phone,
      monthlyFee: house.monthlyFee, pendingMonthsCount: summary.pendingMonthsCount,
      outstandingAmount: summary.outstandingAmount, status: summary.statusClassification,
    }));

  return {
    success: true,
    stats: {
      contributionMonth: month,
      totalHouses: houses.length,
      activeHouses: houses.filter(eligible).length,
      applicableHouses: houses.filter(h => applicable(h, month)).length,
      totalCollectedThisMonth: monthly.collected,
      totalExpensesThisMonth,
      netMonthlyBalance: money(monthly.collected - totalExpensesThisMonth),
      expectedMonthlyIncome: monthly.expected,
      outstandingDuesTotal: monthly.remaining,
      pendingCollectionAmount: monthly.remaining,
      pendingCollectionPercentage: monthly.expected > 0 ? monthly.remaining / monthly.expected * 100 : 0,
      collectionPosition,
      appliedCollections,
      collectionRatePercentage,
      totalActiveStaff: data.staff.filter(s => s.status === 'Active').length,
      paidHouses: monthly.paidHouses,
      pendingHouses: monthly.pendingHouses,
      goodStandingCount: monthly.paidHouses,
      warningCount: summaries.filter(s => s.summary.statusClassification === 'Warning').length,
      defaulterCount: summaries.filter(s => s.summary.statusClassification === 'Defaulter').length,
    },
    topDefaulters,
    recentlyPaidHouses: collections.slice(0, 5),
    recentCollections: collections.slice(0, 5),
    recentExpenses: data.expenses.slice(0, 5),
  };
}
