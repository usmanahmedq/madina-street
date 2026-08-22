import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { StatsCard } from '../components/common/StatsCard';
import { Badge } from '../components/common/Badge';
import { PrintReceiptModal } from '../components/receipts/PrintReceiptModal';
import {
  Home, Banknote, Receipt, AlertTriangle, Users, TrendingUp,
  Printer, ArrowUpRight, ArrowDownRight, Layers, CheckCircle, Zap,
  ShieldAlert, Eye, MessageSquare, ChevronRight
} from 'lucide-react';
import { Collection, Expense } from '../types/index';

export const Dashboard: React.FC = () => {
  const { formatCurrency, settings } = useSettings();
  const { canManageFinances, canRecordCollection } = useAuth();

  const [stats, setStats] = useState<any>(null);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Collection | null>(null);

  const [bulkMonth, setBulkMonth] = useState('September 2026');
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await api.getDashboardStats();
      if (res.success) {
        setStats(res.stats);
        setRecentCollections(res.recentCollections);
        setRecentExpenses(res.recentExpenses);
      }
    } catch (e) {
      console.error('Error fetching dashboard stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleBulkGenerate = async () => {
    if (!confirm(`Are you sure you want to generate monthly dues for ALL active houses for ${bulkMonth}?`)) {
      return;
    }

    setIsBulkGenerating(true);
    try {
      const res = await api.bulkGenerateDues(bulkMonth);
      if (res.success) {
        alert(`Successfully generated dues for ${res.updatedCount} active houses!`);
        fetchDashboardData();
      }
    } catch (e) {
      alert('Failed to generate bulk dues');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner & Quick Dues Generator */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-teal-950 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-teal-700/80 text-teal-200 px-3 py-1 rounded-full border border-teal-600/50">
            ACTIVE SESSION • AUGUST 2026
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">{settings.mohallaName}</h1>
          <p className="text-xs text-teal-200/90 leading-relaxed">
            Welcome to the central executive control panel. Manage collections, track operational expenses, disburse staff salaries, and generate verified receipts.
          </p>
        </div>

        {canManageFinances && (
          <div className="bg-teal-950/70 backdrop-blur-sm border border-teal-700/60 p-4 rounded-xl space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-100">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Mass Dues Generator</span>
            </div>
            <p className="text-[11px] text-teal-300">Issue monthly contribution dues for all active houses with 1-click</p>
            <div className="flex items-center gap-2 pt-1">
              <select
                value={bulkMonth}
                onChange={e => setBulkMonth(e.target.value)}
                className="bg-teal-900 text-white text-xs px-2.5 py-1.5 rounded-lg border border-teal-700 font-semibold"
              >
                <option value="September 2026">September 2026</option>
                <option value="October 2026">October 2026</option>
              </select>
              <button
                onClick={handleBulkGenerate}
                disabled={isBulkGenerating}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg transition-colors shadow-sm"
              >
                {isBulkGenerating ? 'Generating...' : 'Issue Dues'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Total Houses Registered"
          value={stats?.totalHouses || 0}
          subtitle={`${stats?.activeHouses || 0} Active • ${stats?.defaulterCount || 0} Defaulter`}
          icon={Home}
          iconBgColor="bg-teal-50"
          iconTextColor="text-teal-700"
        />

        <StatsCard
          title="Collected This Month"
          value={formatCurrency(stats?.totalCollectedThisMonth || 0)}
          subtitle={`${stats?.collectionRatePercentage || 0}% Target Reached`}
          icon={Banknote}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-700"
          trend={{ value: '12%', isPositive: true }}
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
          title="Outstanding Dues"
          value={formatCurrency(stats?.outstandingDuesTotal || 0)}
          subtitle="Pending collection across sectors"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-700"
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
            <span className="font-extrabold text-teal-700 text-base">{stats?.collectionRatePercentage}%</span>
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
            {stats?.topDefaulters && stats.topDefaulters.length > 0 ? (
              stats.topDefaulters.slice(0, 3).map((item: any) => (
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
                    <p className="font-black text-rose-700">{formatCurrency(item.currentDues)}</p>
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
