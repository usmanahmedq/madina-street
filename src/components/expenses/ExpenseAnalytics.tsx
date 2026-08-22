import React from 'react';
import { FinancialSummaryData } from '../../types/index';
import { useSettings } from '../../context/SettingsContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { PieChart as PieIcon, TrendingDown, Layers, Award, DollarSign } from 'lucide-react';

interface ExpenseAnalyticsProps {
  summary: FinancialSummaryData | null;
  loading: boolean;
}

const COLORS = ['#be123c', '#d97706', '#0284c7', '#059669', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];

export const ExpenseAnalytics: React.FC<ExpenseAnalyticsProps> = ({ summary, loading }) => {
  const { formatCurrency } = useSettings();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center animate-pulse">
        <p className="text-xs font-semibold text-slate-400">Loading financial analytics & charts...</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Outflow (All-Time)</p>
          <h3 className="text-xl font-black text-rose-700 mt-1">{formatCurrency(summary.totalExpenses)}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Operational expenses + payroll</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Current Month Outflow</p>
          <h3 className="text-xl font-black text-amber-600 mt-1">{formatCurrency(summary.monthlyExpenses)}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Expenses incurred this month</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Outflow</p>
          <h3 className="text-xl font-black text-slate-900 mt-1">{formatCurrency(summary.todayExpenses)}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Approved vouchers logged today</p>
        </div>

        <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Net Society Treasury Balance</p>
          <h3 className="text-xl font-black text-white mt-1">{formatCurrency(summary.currentBalance)}</h3>
          <p className="text-[10px] text-emerald-200/80 mt-0.5">Available liquidity balance</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown (Donut Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-rose-700" />
                Expenses by Category
              </h3>
              <p className="text-xs text-slate-500">Distribution of society expenses across operational heads</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="amount"
                  nameKey="category"
                >
                  {summary.expenseByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Total Outflow']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend
                  formatter={(value) => <span className="text-[11px] font-semibold text-slate-700">{value}</span>}
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses Comparison Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-teal-700" />
                Income vs Expense Monthly Comparison
              </h3>
              <p className="text-xs text-slate-500">Society monthly inflow vs operational outflows</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend formatter={(value) => <span className="text-[11px] font-semibold text-slate-700 capitalize">{value}</span>} />
                <Bar dataKey="income" name="Monthly Collections" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Total Expenses" fill="#be123c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Expense Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-amber-600" />
          Top Expense Operational Categories
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {summary.topCategories.map((cat, idx) => (
            <div key={cat.category} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Rank #{idx + 1}</span>
              <p className="text-xs font-bold text-slate-900 mt-1 truncate">{cat.category}</p>
              <p className="text-sm font-black text-rose-700 mt-1">{formatCurrency(cat.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
