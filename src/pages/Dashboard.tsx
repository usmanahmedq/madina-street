import { currentMonth, monthLabel } from '../utils/contributionMonth';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { StatsCard } from '../components/common/StatsCard';
import { PrintReceiptModal } from '../components/receipts/PrintReceiptModal';
import {
  Home, Banknote, Receipt, AlertTriangle, TrendingUp,
  Printer, Layers, CheckCircle, ShieldAlert, ChevronRight
} from 'lucide-react';
import { Collection, Expense } from '../types/index';

export const Dashboard: React.FC = () => {
  const { formatCurrency } = useSettings();

  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getDashboardStats>>['stats'] | null>(null);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Collection | null>(null);

  const [topDefaulters, setTopDefaulters] = useState<Awaited<ReturnType<typeof api.getDashboardStats>>['topDefaulters']>([]);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      const res = await api.getDashboardStats();
      if (res.success) {
        setStats(res.stats);
        setTopDefaulters(res.topDefaulters);
        setError('');
        setRecentCollections(res.recentCollections);
        setRecentExpenses(res.recentExpenses);
      }
    } catch (e) {
      console.error('Error fetching dashboard stats', e);
      setError('Dashboard data could not be refreshed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const refresh = () => { if (!document.hidden) fetchDashboardData(); };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, []);

  const position = stats?.collectionPosition;
  const positionView = position?.state === 'advance'
    ? { title: 'Advance Balance', subtitle: 'Collection above current dues', icon: TrendingUp, bg: 'bg-teal-50', color: 'text-teal-700' }
    : position?.state === 'settled'
      ? { title: 'Outstanding Dues', subtitle: 'Monthly target fully collected', icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-700' }
      : { title: 'Outstanding Dues', subtitle: 'Still to collect this month', icon: AlertTriangle, bg: 'bg-amber-50', color: 'text-amber-700' };
  const efficiency = (stats?.collectionRatePercentage ?? 0).toFixed(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) return <p role="alert" className="text-sm text-amber-700">{error || 'Dashboard data is unavailable.'}</p>;

  return (
    <div className="space-y-8 animate-fade-in">
      {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
      {/* Main dashboard product banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-teal-950 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="space-y-2 max-w-3xl">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-teal-700/80 text-teal-200 px-3 py-1 rounded-full border border-teal-600/50">
            ACTIVE SESSION • {monthLabel(stats?.contributionMonth || currentMonth()).toUpperCase()}
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Madina Street ERP</h1>
          <p className="text-xs text-teal-200/90 leading-relaxed">
            Centralized management for monthly collections, expenses, staff operations, accounts and financial reporting.
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-5">
        <StatsCard
          title="Total Houses Registered"
          value={stats?.totalHouses || 0}
          subtitle={`${stats?.activeHouses || 0} Active • ${stats?.defaulterCount || 0} Defaulter`}
          icon={Home}
          iconBgColor="bg-teal-50"
          iconTextColor="text-teal-700"
        />

        <StatsCard
          title="Expected This Month"
          value={formatCurrency(stats?.expectedMonthlyIncome || 0)}
          subtitle={`${stats?.applicableHouses || 0} Active Houses`}
          icon={Layers}
          iconBgColor="bg-teal-50"
          iconTextColor="text-teal-700"
        />

        <StatsCard
          title="Collected This Month"
          value={formatCurrency(stats?.totalCollectedThisMonth || 0)}
          subtitle={`${efficiency}% Target Reached`}
          icon={Banknote}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-700"
        />

        <StatsCard
          title="Monthly Expenses"
          value={formatCurrency(stats?.totalExpensesThisMonth || 0)}
          subtitle="Sanitation, Lighting & Security"
          icon={Receipt}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-700"
        />

        <StatsCard
          title={positionView.title}
          value={formatCurrency(position?.amount ?? 0)}
          subtitle={positionView.subtitle}
          icon={positionView.icon}
          iconBgColor={positionView.bg}
          iconTextColor={positionView.color}
        />
      </div>

      {/* Collection Efficiency Progress Bar & Top Defaulters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Collection Efficiency Rate</h3>
              <p className="text-slate-500 text-xs">Expected Target: {formatCurrency(stats?.expectedMonthlyIncome || 0)}</p>
            </div>
            <span className="font-extrabold text-teal-700 text-base">{efficiency}%</span>
          </div>

          <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="bg-gradient-to-r from-teal-600 to-teal-800 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats?.collectionRatePercentage || 0)}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Good Standing</span>
              <p className="font-black text-emerald-700 text-sm">{stats?.goodStandingCount || 0}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Warning (1 Mo)</span>
              <p className="font-black text-amber-700 text-sm">{stats?.warningCount || 0}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Defaulter (2+ Mo)</span>
              <p className="font-black text-rose-700 text-sm">{stats?.defaulterCount || 0}</p>
            </div>
          </div>
        </div>

        {/* Top Defaulters Widget */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-sm">Top Defaulter Dues</h3>
            </div>
            <Link to="/defaulters" className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5">
              Report <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2 text-xs">
            {topDefaulters.length > 0 ? (
              topDefaulters.slice(0, 3).map((item) => (
                <div key={item.houseId} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 border border-rose-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to={`/houses/${item.houseId}`} className="font-extrabold text-slate-900 hover:text-teal-800">
                        {item.houseNo}
                      </Link>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                        {item.pendingMonthsCount} Mo
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{item.headName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-rose-700">{formatCurrency(item.outstandingAmount)}</p>
                    <Link to={`/houses/${item.houseId}`} className="text-[10px] text-teal-700 font-bold hover:underline">
                      View Profile
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-xs italic py-4 text-center">No defaulter houses recorded!</p>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Collections & Expenses Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Collections Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Recent Collections</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{recentCollections.length} records</span>
          </div>

          <div className="space-y-3">
            {recentCollections.map(col => (
              <div
                key={col.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{col.houseNo}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{col.headName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{col.month} • {col.paymentMethod}</p>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="font-extrabold text-xs text-emerald-700">{formatCurrency(col.totalPaid)}</p>
                    <p className="text-[10px] text-slate-400">{col.receiptNo}</p>
                  </div>
                  <button
                    onClick={() => setSelectedReceipt(col)}
                    className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Expenses Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-sm">Recent Expenses</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{recentExpenses.length} records</span>
          </div>

          <div className="space-y-3">
            {recentExpenses.map(exp => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-900 text-xs">{exp.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{exp.category} • {exp.paidTo}</p>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-xs text-rose-700">{formatCurrency(exp.amount)}</p>
                  <p className="text-[10px] text-slate-400">{exp.voucherNo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print Receipt Modal */}
      <PrintReceiptModal
        isOpen={!!selectedReceipt}
        collection={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
