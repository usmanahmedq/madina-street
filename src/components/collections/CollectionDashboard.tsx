import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import {
  Banknote, CalendarCheck, TrendingUp, TrendingDown, Clock, CheckCircle2,
  AlertTriangle, ShieldAlert, Zap, Layers, BarChart3, PieChart
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart as RePieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

interface CollectionDashboardProps {
  refreshKey?: unknown;
  onOpenReceivePayment: () => void;
  onOpenDailyClosing: () => void;
}

export const CollectionDashboard: React.FC<CollectionDashboardProps> = ({
  refreshKey,
  onOpenReceivePayment,
  onOpenDailyClosing,
}) => {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getCollectionDashboardStats();
      if (res.success) {
        setData(res);
      }
    } catch (e) {
      console.error('Error loading collection dashboard stats', e);
      setError('Collection analytics could not be loaded. Please refresh to retry.');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0f766e', '#0284c7', '#7c3aed', '#d97706', '#e11d48', '#059669'];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 font-semibold animate-pulse">
        Loading Collection Dashboard Analytics...
      </div>
    );
  }

  if (error) return <div role="alert" className="p-6 text-rose-700">{error}</div>;
  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Expected Collection */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Expected Target</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-lg font-black text-slate-900">{formatCurrency(stats.expectedMonthlyCollection || 0)}</p>
          <p className="text-[10px] text-slate-400 font-medium">All Active Houses</p>
        </div>

        {/* Collected Month */}
        <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          </div>
          <p className="text-xl font-black text-white">{formatCurrency(stats.totalCollectedThisMonth || 0)}</p>
          <div className="flex items-center justify-between text-[10px] text-emerald-200">
            <span>Progress</span>
            <span className="font-extrabold">{stats.collectionPercentage || 0}%</span>
          </div>
        </div>

        {/* Remaining Collection */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Remaining Dues</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-black text-amber-800">{formatCurrency(stats.remainingCollection || 0)}</p>
          <p className="text-[10px] text-slate-400 font-medium">{stats.totalPendingHouses || 0} Houses Pending</p>
        </div>

        {/* Paid vs Pending House Counts */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">House Status</span>
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Paid ({stats.totalPaidHouses || 0})
            </span>
            <span className="text-rose-700 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Pending ({stats.totalPendingHouses || 0})
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-600 h-full"
              style={{ width: `${Math.min(100, (stats.totalPaidHouses / ((stats.totalPaidHouses + stats.totalPendingHouses) || 1)) * 100)}%` }}
            ></div>
            <div
              className="bg-rose-500 h-full"
              style={{ width: `${Math.min(100, (stats.totalPendingHouses / ((stats.totalPaidHouses + stats.totalPendingHouses) || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Defaulter Count */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Defaulters</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-700">{stats.totalDefaulters || 0} Houses</p>
          <p className="text-[10px] text-rose-600 font-semibold">2+ Months Overdue</p>
        </div>
      </div>

      {/* Time Horizon Receipts Row (Today, This Week, This Month) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Today's Collections</span>
            <h3 className="text-xl font-black text-teal-900 mt-0.5">{formatCurrency(stats.todayCollection || 0)}</h3>
            <p className="text-[10px] text-teal-700 font-medium">Real-time daily cash inflow</p>
          </div>
          <button
            onClick={onOpenDailyClosing}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            Daily Cash Closing
          </button>
        </div>

        <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">This Week Collection</span>
            <h3 className="text-xl font-black text-sky-900 mt-0.5">{formatCurrency(stats.thisWeekCollection || 0)}</h3>
            <p className="text-[10px] text-sky-700 font-medium">Last 7 calendar days</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-800">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">This Month Total</span>
            <h3 className="text-xl font-black text-emerald-900 mt-0.5">{formatCurrency(stats.thisMonthCollection || 0)}</h3>
            <p className="text-[10px] text-emerald-700 font-medium">Monthly collection log</p>
          </div>
          <button
            onClick={onOpenReceivePayment}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            + Receive Payment
          </button>
        </div>
      </div>

      {/* Interactive Recharts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Collection Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Collection Trend (2026)</h3>
              <p className="text-[11px] text-slate-500">Historical monthly fee inflow vs expected monthly targets</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-teal-800">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-700"></span> Collected
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyTrends || []}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Total Collected']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="collected" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Highest & Lowest Month Badges */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">Highest Month</span>
                <span className="font-extrabold text-slate-900">{data?.highestMonth?.month || 'August 2026'}</span>
              </div>
              <span className="font-black text-emerald-800 text-sm">{formatCurrency(data?.highestMonth?.amount || 0)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Lowest Month</span>
                <span className="font-extrabold text-slate-900">{data?.lowestMonth?.month || 'January 2026'}</span>
              </div>
              <span className="font-black text-slate-700 text-sm">{formatCurrency(data?.lowestMonth?.amount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Collection by Payment Method</h3>
            <p className="text-[11px] text-slate-500">Distribution of Cash vs Digital Wallets & Bank</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data?.byPaymentMethod || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="amount"
                  nameKey="method"
                >
                  {(data?.byPaymentMethod || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Amount']} />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {(data?.byPaymentMethod || []).map((item: any, idx: number) => (
              <div key={item.method} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  {item.method} ({item.count} receipts)
                </span>
                <span className="font-extrabold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
