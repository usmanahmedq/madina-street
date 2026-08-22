import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { House, Collection, Expense, Staff, SalaryPayment, AttendanceRecord, LedgerEntry } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { ExportButton } from '../components/common/ExportButton';
import { Badge } from '../components/common/Badge';
import { generatePdfTable, generateHouseStatementPdf } from '../utils/pdfGenerator';
import {
  BarChart3, FileText, AlertTriangle, TrendingUp, Users,
  Printer, DollarSign, CheckCircle2, Building, Search,
  Calendar, Filter, Download, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, ShieldCheck, Wallet, ChevronRight,
  TrendingDown, FileSpreadsheet, UserCheck, Clock, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

export const Reports: React.FC = () => {
  const { formatCurrency, settings } = useSettings();

  // Top level active tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'closing' | 'houses' | 'collections' | 'defaulters' | 'financial' | 'payroll'
  >('dashboard');

  // Sub-tab selectors
  const [houseSubTab, setHouseSubTab] = useState<'directory' | 'statement' | 'sector'>('directory');
  const [financialSubTab, setFinancialSubTab] = useState<'pnl' | 'categories' | 'ledger'>('pnl');

  // Monthly Closing State
  const [selectedClosingMonth, setSelectedClosingMonth] = useState('August 2026');
  const [closingReport, setClosingReport] = useState<any>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingActiveTab, setClosingActiveTab] = useState<'paid' | 'unpaid' | 'expenses' | 'salaries'>('paid');

  const monthsList = [
    'January 2026', 'February 2026', 'March 2026', 'April 2026',
    'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026'
  ];

  // Master State
  const [houses, setHouses] = useState<House[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [selectedHouseId, setSelectedHouseId] = useState<string>('');
  const [duesThreshold, setDuesThreshold] = useState<number>(0);
  const [collectionTimeframe, setCollectionTimeframe] = useState<'ALL' | 'TODAY' | 'MONTH' | 'YEAR'>('ALL');

  // Data Fetching
  const fetchData = async () => {
    setLoading(true);
    try {
      const [hRes, cRes, eRes, sRes, stRes, aRes, lRes] = await Promise.all([
        api.getHouses(),
        api.getCollections(),
        api.getExpenses(),
        api.getSalaries(),
        api.getStaff(),
        api.getAttendance(),
        api.getLedger(),
      ]);

      if (hRes.success) setHouses(hRes.houses);
      if (cRes.success) setCollections(cRes.collections);
      if (eRes.success) setExpenses(eRes.expenses);
      if (sRes.success) setSalaries(sRes.salaries);
      if (stRes.success) setStaff(stRes.staff);
      if (aRes.success) setAttendance(aRes.attendance);
      if (lRes.success) setLedger(lRes.ledger);

      if (hRes.houses && hRes.houses.length > 0 && !selectedHouseId) {
        setSelectedHouseId(hRes.houses[0].id);
      }
    } catch (e) {
      console.error('Error loading reports data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyClosing = async (month: string) => {
    setClosingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/reports/monthly-closing?month=${encodeURIComponent(month)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setClosingReport(data);
      }
    } catch (err) {
      console.error('Failed to load monthly closing data', err);
    } finally {
      setClosingLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'closing') {
      fetchMonthlyClosing(selectedClosingMonth);
    }
  }, [activeTab, selectedClosingMonth]);

  // Log report access audit
  useEffect(() => {
    api.logAction('VIEW', 'Reports & Analytics', `Accessed ${activeTab.toUpperCase()} report tab`).catch(() => {});
  }, [activeTab]);

  // CALCULATED METRICS
  const totalHouses = houses.length;
  const activeHouses = houses.filter(h => h.status === 'Active').length;
  const closedHouses = houses.filter(h => h.status === 'Closed' || h.status === 'Suspended').length;

  const expectedMonthlyCollection = houses.reduce((s, h) => s + (h.monthlyFee || 0), 0);
  const totalCollections = collections.reduce((s, c) => s + c.totalPaid, 0);
  const totalPendingDues = houses.reduce((s, h) => s + (h.currentDues || 0), 0);
  const collectionPercentage = expectedMonthlyCollection > 0
    ? Math.round((totalCollections / (totalCollections + totalPendingDues)) * 100)
    : 100;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSalaries = salaries.reduce((s, sal) => s + sal.netPaid, 0);
  const totalOutflow = totalExpenses + totalSalaries;
  const netSurplus = totalCollections - totalOutflow;

  const defaultersList = useMemo(() => {
    return houses.filter(h => h.status === 'Defaulter' || (h.currentDues && h.currentDues > 0));
  }, [houses]);

  const defaulterTotalDues = defaultersList.reduce((s, h) => s + h.currentDues, 0);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    houses.forEach(h => {
      if (h.sector) set.add(h.sector);
    });
    return Array.from(set);
  }, [houses]);

  const selectedHouseProfile = useMemo(() => {
    if (!selectedHouseId) return null;
    const h = houses.find(house => house.id === selectedHouseId);
    if (!h) return null;

    const houseCollections = collections.filter(c => c.houseId === h.id || c.houseNo === h.houseNo);
    const totalPaid = houseCollections.reduce((s, c) => s + c.totalPaid, 0);

    return {
      house: h,
      collections: houseCollections,
      totalPaid,
      outstanding: h.currentDues || 0,
    };
  }, [selectedHouseId, houses, collections]);

  const filteredDefaulters = useMemo(() => {
    return defaultersList.filter(h => {
      const matchSearch =
        h.houseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.phone && h.phone.includes(searchQuery));
      const matchSector = sectorFilter === 'ALL' || h.sector === sectorFilter;
      const matchThreshold = h.currentDues >= duesThreshold;
      return matchSearch && matchSector && matchThreshold;
    });
  }, [defaultersList, searchQuery, sectorFilter, duesThreshold]);

  const filteredCollections = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.slice(0, 7);
    const currentYearStr = todayStr.slice(0, 4);

    return collections.filter(c => {
      const dateStr = c.paymentDate || c.createdAt.split('T')[0];
      let matchTime = true;
      if (collectionTimeframe === 'TODAY') matchTime = dateStr === todayStr;
      if (collectionTimeframe === 'MONTH') matchTime = dateStr.startsWith(currentMonthStr);
      if (collectionTimeframe === 'YEAR') matchTime = dateStr.startsWith(currentYearStr);

      const matchSearch =
        c.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.houseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.collectorName && c.collectorName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchTime && matchSearch;
    });
  }, [collections, collectionTimeframe, searchQuery]);

  const collectorSummary = useMemo(() => {
    const map: Record<string, { count: number; total: number; cash: number; bank: number; online: number }> = {};
    filteredCollections.forEach(c => {
      const name = c.collectorName || 'Unassigned';
      if (!map[name]) map[name] = { count: 0, total: 0, cash: 0, bank: 0, online: 0 };
      map[name].count += 1;
      map[name].total += c.totalPaid;
      if (c.paymentMethod === 'Cash') map[name].cash += c.totalPaid;
      else if (c.paymentMethod === 'Bank Transfer') map[name].bank += c.totalPaid;
      else map[name].online += c.totalPaid;
    });

    return Object.entries(map).map(([name, stats]) => ({
      collectorName: name,
      ...stats,
    })).sort((a, b) => b.total - a.total);
  }, [filteredCollections]);

  const paymentMethodSummary = useMemo(() => {
    const map: Record<string, number> = { Cash: 0, 'Bank Transfer': 0, 'JazzCash / EasyPaisa': 0, Online: 0 };
    filteredCollections.forEach(c => {
      const m = c.paymentMethod || 'Cash';
      map[m] = (map[m] || 0) + c.totalPaid;
    });
    return Object.entries(map).map(([method, amount]) => ({ method, amount }));
  }, [filteredCollections]);

  const expenseCategoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    if (totalSalaries > 0) {
      map['Staff Salaries & Payroll'] = totalSalaries;
    }

    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: total > 0 ? Math.round((amt / total) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, totalSalaries]);

  const sectorRecoverySummary = useMemo(() => {
    const map: Record<string, { houses: number; expected: number; collected: number; dues: number }> = {};
    houses.forEach(h => {
      const sec = h.sector || 'Unassigned';
      if (!map[sec]) map[sec] = { houses: 0, expected: 0, collected: 0, dues: 0 };
      map[sec].houses += 1;
      map[sec].expected += h.monthlyFee || 0;
      map[sec].dues += h.currentDues || 0;
    });

    collections.forEach(c => {
      const sec = c.sector || 'Unassigned';
      if (map[sec]) {
        map[sec].collected += c.totalPaid;
      }
    });

    return Object.entries(map).map(([sec, val]) => {
      const rate = val.expected > 0 ? Math.min(100, Math.round((val.collected / (val.expected || 1)) * 100)) : 100;
      return {
        sector: sec,
        ...val,
        recoveryRate: rate,
      };
    });
  }, [houses, collections]);

  const trendChartData = useMemo(() => {
    return [
      { month: 'Mar 2026', Income: 42000, Expenses: 31000 },
      { month: 'Apr 2026', Income: 45000, Expenses: 28000 },
      { month: 'May 2026', Income: 48000, Expenses: 35000 },
      { month: 'Jun 2026', Income: 43000, Expenses: 29000 },
      { month: 'Jul 2026', Income: 51000, Expenses: 38000 },
      { month: 'Aug 2026', Income: totalCollections, Expenses: totalOutflow },
    ];
  }, [totalCollections, totalOutflow]);

  const chartColors = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#8b5cf6', '#06b6d4'];

  const handlePrint = async () => {
    await api.logAction('PRINT', 'Reports Module', `Printed report page for tab ${activeTab.toUpperCase()}`);
    window.print();
  };

  const handleExportDefaultersPdf = async () => {
    const headers = ['House #', 'Resident Head', 'Sector', 'Phone', 'Monthly Fee', 'Current Dues', 'Status'];
    const rows = filteredDefaulters.map(d => [
      d.houseNo,
      d.headName,
      `${d.sector}, ${d.street}`,
      d.phone,
      `Rs. ${d.monthlyFee}`,
      `Rs. ${d.currentDues}`,
      d.status || 'Defaulter',
    ]);

    generatePdfTable({
      mohallaName: settings.mohallaName || 'MADINA STREET MOHALLA SOCIETY',
      title: 'OFFICIAL DEFAULTERS & PENDING DUES AUDIT REPORT',
      filename: 'Mohalla_Defaulters_Audit_Report',
      headers,
      rows,
    });

    await api.logAction('EXPORT', 'Defaulters Report', `Exported PDF report for ${filteredDefaulters.length} defaulter houses`);
  };

  const handleExportHouseDirectoryPdf = async () => {
    const headers = ['House #', 'Resident Name', 'CNIC', 'Mobile', 'Sector', 'Category', 'Monthly Fee', 'Dues', 'Status'];
    const rows = houses.map(h => [
      h.houseNo,
      h.headName,
      h.cnic || 'N/A',
      h.phone,
      h.sector,
      h.category,
      `Rs. ${h.monthlyFee}`,
      `Rs. ${h.currentDues}`,
      h.status,
    ]);

    generatePdfTable({
      mohallaName: settings.mohallaName,
      title: 'MASTER HOUSE DIRECTORY & FINANCIAL REGISTER',
      filename: 'Master_House_Directory',
      headers,
      rows,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Mohalla Business Intelligence & Audit Reports</h1>
            <Badge variant="teal" size="sm">Live Data</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time financial analytics, monthly closing ledger, collection rates, house directory audits, and defaulters notices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Screen
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics Dashboard
        </button>

        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'closing'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Monthly Closing & Audit
        </button>

        <button
          onClick={() => setActiveTab('houses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'houses'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          House Reports & Statements
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'collections'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Collection Analytics
        </button>

        <button
          onClick={() => setActiveTab('defaulters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'defaulters'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Defaulters & Dues ({defaultersList.length})
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'financial'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Financial P&L & Cash Book
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'payroll'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Payroll & Attendance
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE ANALYTICS DASHBOARD                                      */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Houses</span>
              <p className="text-xl font-black text-slate-900">{totalHouses}</p>
              <p className="text-[10px] text-teal-600 font-bold">{activeHouses} Active • {closedHouses} Closed</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Monthly</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(expectedMonthlyCollection)}</p>
              <p className="text-[10px] text-slate-500">Based on active house tariffs</p>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Revenue Collected</span>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(totalCollections)}</p>
              <p className="text-[10px] text-emerald-600 font-bold">Verified Cash Receipts</p>
            </div>

            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Pending Dues Balance</span>
              <p className="text-xl font-black text-rose-700">{formatCurrency(totalPendingDues)}</p>
              <p className="text-[10px] text-rose-600 font-bold">{defaultersList.length} Defaulter Houses</p>
            </div>

            <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Collection Efficiency</span>
              <p className="text-xl font-black text-teal-700">{collectionPercentage}%</p>
              <div className="w-full bg-teal-200 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-teal-700 h-full rounded-full" style={{ width: `${Math.min(100, collectionPercentage)}%` }}></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operational Expenses</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(totalExpenses)}</p>
              <p className="text-[10px] text-slate-500">Maintenance, Lighting, Repairs</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Staff Payroll Cost</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(totalSalaries)}</p>
              <p className="text-[10px] text-slate-500">{salaries.length} Salary Slips Paid</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Expenditures</span>
              <p className="text-xl font-black text-rose-600">{formatCurrency(totalOutflow)}</p>
              <p className="text-[10px] text-rose-500">OpEx + Staff Payroll</p>
            </div>

            <div className="bg-teal-900 text-white p-4 rounded-xl border border-teal-950 shadow-xs space-y-1 col-span-2">
              <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">Net Financial Surplus / Margin</span>
              <p className="text-2xl font-black text-emerald-300">{formatCurrency(netSurplus)}</p>
              <p className="text-[10px] text-teal-200">Total Revenue Collected minus All Operational Outflows</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Monthly Revenue vs Expenditure Trend</h3>
                  <p className="text-xs text-slate-500">Six-month cash inflow vs outflow comparison</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Area type="monotone" dataKey="Income" stroke="#0f766e" fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="Expenses" stroke="#dc2626" fillOpacity={1} fill="url(#colorExpenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Expense Categories Breakdown</h3>
                  <p className="text-xs text-slate-500">Distribution of operational spending & payroll</p>
                </div>
              </div>
              <div className="h-64 w-full flex items-center justify-center">
                {expenseCategoryBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400">No expense records found</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategoryBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percentage }) => `${category}: ${percentage}%`}
                      >
                        {expenseCategoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, 'Amount']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Sector Recovery Rate Efficiency (%)</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorRecoverySummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="sector" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => [`${value}%`, 'Recovery Rate']} />
                    <Bar dataKey="recoveryRate" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Payment Method Inflow Breakdown</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMethodSummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY CLOSING & HISTORICAL AUDIT                                  */}
      {/* ========================================================================= */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Month-Wise Financial Closing & Audit Ledger</h2>
              <p className="text-xs text-slate-500">Historical closing balances, paid receipts, and defaulter house tracking</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Select Month:</label>
              <select
                value={selectedClosingMonth}
                onChange={(e) => setSelectedClosingMonth(e.target.value)}
                className="bg-slate-100 border border-slate-300 font-extrabold text-teal-800 text-xs rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-600"
              >
                {monthsList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {closingLoading ? (
            <div className="flex justify-center p-12">
              <RefreshCw className="w-8 h-8 text-teal-700 animate-spin" />
            </div>
          ) : closingReport ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Collected ({selectedClosingMonth})</span>
                  <p className="text-xl font-extrabold text-emerald-600 mt-1">Rs. {closingReport.summary.totalCollected.toLocaleString()}</p>
                  <span className="text-xs text-slate-400">{closingReport.summary.paidHousesCount} Paid Houses</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational Expenses</span>
                  <p className="text-xl font-extrabold text-rose-600 mt-1">Rs. {closingReport.summary.totalExpenses.toLocaleString()}</p>
                  <span className="text-xs text-slate-400">{closingReport.expensesList.length} Vouchers</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Staff Payroll</span>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">Rs. {closingReport.summary.totalSalaries.toLocaleString()}</p>
                  <span className="text-xs text-slate-400">{closingReport.salaryPayments.length} Disbursed Slips</span>
                </div>

                <div className={`p-4 rounded-xl border shadow-2xs ${closingReport.summary.netClosingBalance >= 0 ? 'bg-teal-900 text-white border-teal-800' : 'bg-rose-900 text-white border-rose-800'}`}>
                  <span className="text-[10px] font-bold uppercase opacity-80 tracking-wider">Net Monthly Surplus</span>
                  <p className="text-xl font-black mt-1">Rs. {closingReport.summary.netClosingBalance.toLocaleString()}</p>
                  <span className="text-xs opacity-75">{closingReport.summary.netClosingBalance >= 0 ? 'Monthly Surplus' : 'Monthly Deficit'}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                  <button
                    onClick={() => setClosingActiveTab('paid')}
                    className={`px-5 py-3 font-bold text-xs border-b-2 transition-all ${closingActiveTab === 'paid' ? 'border-teal-700 text-teal-700 bg-teal-50' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                  >
                    Paid Houses ({closingReport.paidCollections.length})
                  </button>
                  <button
                    onClick={() => setClosingActiveTab('unpaid')}
                    className={`px-5 py-3 font-bold text-xs border-b-2 transition-all ${closingActiveTab === 'unpaid' ? 'border-amber-600 text-amber-600 bg-amber-50' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                  >
                    Unpaid / Pending Houses ({closingReport.unpaidHousesList.length})
                  </button>
                  <button
                    onClick={() => setClosingActiveTab('expenses')}
                    className={`px-5 py-3 font-bold text-xs border-b-2 transition-all ${closingActiveTab === 'expenses' ? 'border-rose-600 text-rose-600 bg-rose-50' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                  >
                    Expenses ({closingReport.expensesList.length})
                  </button>
                  <button
                    onClick={() => setClosingActiveTab('salaries')}
                    className={`px-5 py-3 font-bold text-xs border-b-2 transition-all ${closingActiveTab === 'salaries' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                  >
                    Salaries ({closingReport.salaryPayments.length})
                  </button>
                </div>

                <div className="p-4 overflow-x-auto">
                  {closingActiveTab === 'paid' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                          <th className="p-3">Receipt #</th>
                          <th className="p-3">House #</th>
                          <th className="p-3">Resident Name</th>
                          <th className="p-3">Payment Date</th>
                          <th className="p-3">Method</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {closingReport.paidCollections.length === 0 ? (
                          <tr><td colSpan={6} className="text-center p-6 text-slate-400">No payment records found for {selectedClosingMonth}</td></tr>
                        ) : (
                          closingReport.paidCollections.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono text-teal-700 font-bold">{c.receiptNo}</td>
                              <td className="p-3 font-bold text-slate-800">{c.houseNo}</td>
                              <td className="p-3">{c.headName}</td>
                              <td className="p-3">{c.paymentDate}</td>
                              <td className="p-3">{c.paymentMethod}</td>
                              <td className="p-3 text-right font-bold text-emerald-600">Rs. {c.totalPaid.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {closingActiveTab === 'unpaid' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                          <th className="p-3">House #</th>
                          <th className="p-3">Resident Name</th>
                          <th className="p-3">Sector / Street</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3 text-right">Monthly Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {closingReport.unpaidHousesList.length === 0 ? (
                          <tr><td colSpan={5} className="text-center p-6 text-emerald-600 font-bold">Awesome! All houses have paid for {selectedClosingMonth}</td></tr>
                        ) : (
                          closingReport.unpaidHousesList.map((h: any) => (
                            <tr key={h.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-800">{h.houseNo}</td>
                              <td className="p-3">{h.headName}</td>
                              <td className="p-3">{h.sector}, {h.street}</td>
                              <td className="p-3">{h.phone}</td>
                              <td className="p-3 text-right font-bold text-amber-600">Rs. {h.monthlyFee.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {closingActiveTab === 'expenses' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                          <th className="p-3">Voucher #</th>
                          <th className="p-3">Title</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Paid To</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {closingReport.expensesList.length === 0 ? (
                          <tr><td colSpan={6} className="text-center p-6 text-slate-400">No expense vouchers recorded for {selectedClosingMonth}</td></tr>
                        ) : (
                          closingReport.expensesList.map((e: any) => (
                            <tr key={e.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono text-rose-700 font-bold">{e.voucherNo}</td>
                              <td className="p-3 font-semibold text-slate-800">{e.title}</td>
                              <td className="p-3">{e.category}</td>
                              <td className="p-3">{e.paidTo}</td>
                              <td className="p-3">{e.date}</td>
                              <td className="p-3 text-right font-bold text-rose-600">Rs. {e.amount.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {closingActiveTab === 'salaries' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                          <th className="p-3">Slip #</th>
                          <th className="p-3">Staff Member</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Payment Date</th>
                          <th className="p-3 text-right">Net Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {closingReport.salaryPayments.length === 0 ? (
                          <tr><td colSpan={5} className="text-center p-6 text-slate-400">No salary slips disbursed for {selectedClosingMonth}</td></tr>
                        ) : (
                          closingReport.salaryPayments.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono text-indigo-700 font-bold">{s.slipNo}</td>
                              <td className="p-3 font-semibold text-slate-800">{s.staffName}</td>
                              <td className="p-3">{s.staffRole}</td>
                              <td className="p-3">{s.paymentDate}</td>
                              <td className="p-3 text-right font-bold text-indigo-600">Rs. {s.netPaid.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HOUSE REPORTS & STATEMENTS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'houses' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit text-xs font-bold">
            <button
              onClick={() => setHouseSubTab('directory')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                houseSubTab === 'directory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Master House Directory
            </button>
            <button
              onClick={() => setHouseSubTab('statement')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                houseSubTab === 'statement' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Individual House Statement
            </button>
            <button
              onClick={() => setHouseSubTab('sector')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                houseSubTab === 'sector' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Sector Recovery Matrix
            </button>
          </div>

          {houseSubTab === 'directory' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs space-y-4 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Master House Directory & Financial Register</h3>
                  <p className="text-xs text-slate-500">Complete listing of registered properties and monthly tariffs</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search house # or resident..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none w-48"
                    />
                  </div>

                  <button
                    onClick={handleExportHouseDirectoryPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600" />
                    Export PDF
                  </button>

                  <ExportButton filename="House_Directory_Report" data={houses} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="p-3">House No</th>
                      <th className="p-3">Resident Head</th>
                      <th className="p-3">Sector / Street</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Monthly Tariff</th>
                      <th className="p-3">Outstanding Dues</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {houses
                      .filter(h =>
                        h.houseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        h.headName.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(h => (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-900">{h.houseNo}</td>
                          <td className="p-3 font-bold text-slate-900">{h.headName}</td>
                          <td className="p-3 text-slate-600">{h.sector}, {h.street}</td>
                          <td className="p-3 text-slate-600">{h.phone}</td>
                          <td className="p-3 text-slate-600">{h.category}</td>
                          <td className="p-3 font-semibold text-slate-800">{formatCurrency(h.monthlyFee)}</td>
                          <td className={`p-3 font-bold ${h.currentDues > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                            {formatCurrency(h.currentDues)}
                          </td>
                          <td className="p-3">
                            <Badge variant={h.status === 'Active' ? 'success' : h.status === 'Defaulter' ? 'danger' : 'neutral'}>
                              {h.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {houseSubTab === 'statement' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Official House Financial Statement</h3>
                  <p className="text-xs text-slate-500">Detailed payment history log and pending month breakdown</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedHouseId}
                    onChange={e => setSelectedHouseId(e.target.value)}
                    className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg outline-none bg-white text-slate-800"
                  >
                    {houses.map(h => (
                      <option key={h.id} value={h.id}>
                        House {h.houseNo} - {h.headName} ({h.sector})
                      </option>
                    ))}
                  </select>

                  {selectedHouseProfile && (
                    <button
                      onClick={() =>
                        generateHouseStatementPdf({
                          houseNo: selectedHouseProfile.house.houseNo,
                          headName: selectedHouseProfile.house.headName,
                          sector: selectedHouseProfile.house.sector,
                          street: selectedHouseProfile.house.street,
                          cnic: selectedHouseProfile.house.cnic,
                          phone: selectedHouseProfile.house.phone,
                          monthlyFee: selectedHouseProfile.house.monthlyFee,
                          status: selectedHouseProfile.house.status,
                          totalPaid: selectedHouseProfile.totalPaid,
                          outstanding: selectedHouseProfile.outstanding,
                          collectionRate: 100,
                          pendingMonths: [],
                          payments: selectedHouseProfile.collections.map(c => ({
                            receiptNo: c.receiptNo,
                            month: c.month,
                            paymentDate: c.paymentDate || c.createdAt.split('T')[0],
                            paymentMethod: c.paymentMethod,
                            totalPaid: c.totalPaid,
                          })),
                          mohallaName: settings.mohallaName,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF Statement
                    </button>
                  )}
                </div>
              </div>

              {selectedHouseProfile ? (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Resident Head</span>
                      <p className="font-bold text-slate-900 text-sm">{selectedHouseProfile.house.headName}</p>
                      <p className="text-[10px] text-slate-500">Phone: {selectedHouseProfile.house.phone}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Location</span>
                      <p className="font-bold text-slate-900">{selectedHouseProfile.house.sector}, {selectedHouseProfile.house.street}</p>
                      <p className="text-[10px] text-slate-500">CNIC: {selectedHouseProfile.house.cnic || 'N/A'}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly Tariff</span>
                      <p className="font-black text-slate-900 text-sm">{formatCurrency(selectedHouseProfile.house.monthlyFee)}</p>
                      <Badge variant="teal" size="sm">{selectedHouseProfile.house.category}</Badge>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Outstanding Dues</span>
                      <p className={`font-black text-sm ${selectedHouseProfile.outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatCurrency(selectedHouseProfile.outstanding)}
                      </p>
                      <p className="text-[10px] text-slate-500">Status: {selectedHouseProfile.house.status}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Itemized Collection Receipts</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <th className="p-3">Receipt #</th>
                            <th className="p-3">Target Month</th>
                            <th className="p-3">Payment Date</th>
                            <th className="p-3">Method</th>
                            <th className="p-3">Collector</th>
                            <th className="p-3 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {selectedHouseProfile.collections.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold">
                                No payment receipts recorded yet for House {selectedHouseProfile.house.houseNo}
                              </td>
                            </tr>
                          ) : (
                            selectedHouseProfile.collections.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-900">{c.receiptNo}</td>
                                <td className="p-3 text-slate-800">{c.month}</td>
                                <td className="p-3 text-slate-600">{c.paymentDate || c.createdAt.split('T')[0]}</td>
                                <td className="p-3">
                                  <Badge variant="neutral">{c.paymentMethod}</Badge>
                                </td>
                                <td className="p-3 text-slate-600">{c.collectorName || 'Office Admin'}</td>
                                <td className="p-3 text-right font-black text-emerald-700">
                                  {formatCurrency(c.totalPaid)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Please select a house above to view statement</p>
              )}
            </div>
          )}

          {houseSubTab === 'sector' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Sector & Street Recovery Matrix</h3>
                  <p className="text-xs text-slate-500">Comparative performance across all sectors</p>
                </div>
                <ExportButton filename="Sector_Recovery_Matrix" data={sectorRecoverySummary} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="p-3">Sector</th>
                      <th className="p-3">Total Houses</th>
                      <th className="p-3">Expected Collection</th>
                      <th className="p-3">Actual Collected</th>
                      <th className="p-3">Outstanding Dues</th>
                      <th className="p-3">Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sectorRecoverySummary.map(sec => (
                      <tr key={sec.sector} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{sec.sector}</td>
                        <td className="p-3 text-slate-700">{sec.houses}</td>
                        <td className="p-3 font-semibold text-slate-900">{formatCurrency(sec.expected)}</td>
                        <td className="p-3 font-bold text-emerald-700">{formatCurrency(sec.collected)}</td>
                        <td className="p-3 font-bold text-rose-700">{formatCurrency(sec.dues)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 w-8">{sec.recoveryRate}%</span>
                            <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-teal-700 h-full rounded-full"
                                style={{ width: `${Math.min(100, sec.recoveryRate)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COLLECTION REPORTS & ANALYTICS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Timeframe:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-bold">
                {(['ALL', 'TODAY', 'MONTH', 'YEAR'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setCollectionTimeframe(tf)}
                    className={`px-3 py-1 rounded-md transition-all ${
                      collectionTimeframe === tf ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search receipt, house, or collector..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none w-56"
                />
              </div>
            </div>

            <ExportButton filename="Collection_Analytics_Report" data={filteredCollections} />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Collector-wise Collection Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="p-3">Collector Name</th>
                    <th className="p-3">Receipts Issued</th>
                    <th className="p-3">Cash Collected</th>
                    <th className="p-3">Bank Transfer</th>
                    <th className="p-3">Online Transfer</th>
                    <th className="p-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {collectorSummary.map(c => (
                    <tr key={c.collectorName} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{c.collectorName}</td>
                      <td className="p-3 text-slate-700">{c.count}</td>
                      <td className="p-3 text-emerald-700 font-semibold">{formatCurrency(c.cash)}</td>
                      <td className="p-3 text-blue-700 font-semibold">{formatCurrency(c.bank)}</td>
                      <td className="p-3 text-purple-700 font-semibold">{formatCurrency(c.online)}</td>
                      <td className="p-3 text-right font-black text-teal-800">{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Itemized Collection Receipts History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">House No</th>
                    <th className="p-3">Resident Head</th>
                    <th className="p-3">Month</th>
                    <th className="p-3">Payment Date</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Collector</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCollections.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{c.receiptNo}</td>
                      <td className="p-3 font-bold text-slate-900">{c.houseNo}</td>
                      <td className="p-3 text-slate-800">{c.headName}</td>
                      <td className="p-3 text-slate-600">{c.month}</td>
                      <td className="p-3 text-slate-600">{c.paymentDate || c.createdAt.split('T')[0]}</td>
                      <td className="p-3">
                        <Badge variant="teal">{c.paymentMethod}</Badge>
                      </td>
                      <td className="p-3 text-slate-600">{c.collectorName || 'Admin'}</td>
                      <td className="p-3 text-right font-black text-emerald-700">{formatCurrency(c.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DEFAULTERS & PENDING DUES AUDIT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'defaulters' && (
        <div className="space-y-6">
          <div className="bg-rose-900 text-white p-6 rounded-2xl shadow-xs grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">Total Defaulters</span>
              <p className="text-3xl font-black text-white mt-1">{defaultersList.length} Houses</p>
              <p className="text-xs text-rose-200 mt-1">Houses with pending dues</p>
            </div>

            <div>
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">Total Overdue Dues</span>
              <p className="text-3xl font-black text-rose-200 mt-1">{formatCurrency(defaulterTotalDues)}</p>
              <p className="text-xs text-rose-200 mt-1">Uncollected monthly tariffs</p>
            </div>

            <div>
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">Average Dues per Defaulter</span>
              <p className="text-3xl font-black text-white mt-1">
                {formatCurrency(defaultersList.length > 0 ? Math.round(defaulterTotalDues / defaultersList.length) : 0)}
              </p>
              <p className="text-xs text-rose-200 mt-1">Average outstanding</p>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={handleExportDefaultersPdf}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold text-rose-900 bg-white hover:bg-rose-50 rounded-xl transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 text-rose-700" />
                Export Official PDF Notice List
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search house, resident, phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none w-52"
                />
              </div>

              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">All Sectors</option>
                {sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={duesThreshold}
                onChange={e => setDuesThreshold(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                <option value={0}>All Pending Dues</option>
                <option value={2000}>Over Rs. 2,000</option>
                <option value={5000}>Over Rs. 5,000</option>
                <option value={10000}>Over Rs. 10,000</option>
              </select>
            </div>

            <ExportButton filename="Defaulters_Audit_List" data={filteredDefaulters} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <th className="p-4">House No</th>
                  <th className="p-4">Resident Head</th>
                  <th className="p-4">Sector / Street</th>
                  <th className="p-4">Mobile Number</th>
                  <th className="p-4">CNIC</th>
                  <th className="p-4">Monthly Tariff</th>
                  <th className="p-4">Outstanding Dues</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDefaulters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 font-bold">
                      No defaulter records match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDefaulters.map(d => (
                    <tr key={d.id} className="hover:bg-rose-50/40 transition-colors">
                      <td className="p-4 font-black text-slate-900">{d.houseNo}</td>
                      <td className="p-4 font-bold text-slate-900">{d.headName}</td>
                      <td className="p-4 text-slate-600">{d.sector}, {d.street}</td>
                      <td className="p-4 text-slate-600">{d.phone}</td>
                      <td className="p-4 text-slate-600">{d.cnic || 'N/A'}</td>
                      <td className="p-4 text-slate-800">{formatCurrency(d.monthlyFee)}</td>
                      <td className="p-4 font-black text-rose-700 text-sm">
                        {formatCurrency(d.currentDues)}
                      </td>
                      <td className="p-4">
                        <Badge variant="danger">Defaulter</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: FINANCIAL P&L, EXPENSE CATEGORIES & LEDGER                        */}
      {/* ========================================================================= */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit text-xs font-bold">
            <button
              onClick={() => setFinancialSubTab('pnl')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                financialSubTab === 'pnl' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              P&L Statement
            </button>
            <button
              onClick={() => setFinancialSubTab('categories')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                financialSubTab === 'categories' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Expense Categories
            </button>
            <button
              onClick={() => setFinancialSubTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                financialSubTab === 'ledger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              General Cash Ledger
            </button>
          </div>

          {financialSubTab === 'pnl' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">{settings.mohallaName}</h3>
                  <p className="text-xs text-slate-500">Official Statement of Revenue & Operational Outflows (2026)</p>
                </div>
                <ExportButton filename="Income_Expense_Statement" data={collections} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/80">
                  <p className="font-bold text-emerald-900">Total House Collection Inflow</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalCollections)}</p>
                </div>

                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200/80">
                  <p className="font-bold text-rose-900">Total Expenditures (OpEx + Payroll)</p>
                  <p className="text-2xl font-black text-rose-700 mt-1">{formatCurrency(totalOutflow)}</p>
                </div>

                <div className="p-4 bg-teal-50 rounded-xl border border-teal-200/80">
                  <p className="font-bold text-teal-900">Net Surplus / Profit Margin</p>
                  <p className="text-2xl font-black text-teal-800 mt-1">{formatCurrency(netSurplus)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Itemized Financial Breakdown</h4>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600 font-semibold">1. House Monthly Tariffs & Collection Receipts</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(totalCollections)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600 font-semibold">2. Staff Salaries & Payroll Disbursals</span>
                    <span className="font-bold text-rose-700">-{formatCurrency(totalSalaries)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600 font-semibold">3. Street Maintenance, Lighting & Utilities</span>
                    <span className="font-bold text-rose-700">-{formatCurrency(totalExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {financialSubTab === 'categories' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Categorized Operational Outflow Audit</h3>
              <div className="space-y-3">
                {expenseCategoryBreakdown.map(cat => (
                  <div key={cat.category} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-900">{cat.category}</span>
                      <span className="text-slate-900 font-black">{formatCurrency(cat.amount)} ({cat.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-teal-700 h-full rounded-full" style={{ width: `${cat.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {financialSubTab === 'ledger' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">General Cash Book Ledger Audit</h3>
                <ExportButton filename="General_Ledger_Export" data={ledger} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference No</th>
                      <th className="p-3">Account Head</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Debit (Out)</th>
                      <th className="p-3">Credit (In)</th>
                      <th className="p-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ledger.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{entry.date}</td>
                        <td className="p-3 font-bold text-slate-900">{entry.referenceNo}</td>
                        <td className="p-3 text-slate-800 font-semibold">{entry.accountHead}</td>
                        <td className="p-3 text-slate-600">{entry.description}</td>
                        <td className="p-3 font-bold text-rose-700">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </td>
                        <td className="p-3 font-bold text-emerald-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          {formatCurrency(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: STAFF PAYROLL & ATTENDANCE REPORTS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Staff Payroll & Salary Disbursal Audit</h3>
              <p className="text-xs text-slate-500">List of verified salary payments and monthly staff cost</p>
            </div>
            <ExportButton filename="Payroll_Disbursal_Report" data={salaries} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <th className="p-3">Slip No</th>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Target Month</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Base Salary</th>
                  <th className="p-3">Allowances</th>
                  <th className="p-3">Deductions</th>
                  <th className="p-3">Net Paid</th>
                  <th className="p-3">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {salaries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400">
                      No salary disbursal records found
                    </td>
                  </tr>
                ) : (
                  salaries.map(sal => (
                    <tr key={sal.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{sal.slipNo}</td>
                      <td className="p-3 font-bold text-slate-900">{sal.staffName}</td>
                      <td className="p-3 text-slate-600">{sal.staffRole}</td>
                      <td className="p-3 text-slate-800">{sal.month}</td>
                      <td className="p-3 text-slate-600">{sal.paymentDate}</td>
                      <td className="p-3 text-slate-800">{formatCurrency(sal.baseSalary)}</td>
                      <td className="p-3 text-emerald-700">+{formatCurrency((sal.allowance || 0) + (sal.bonus || 0))}</td>
                      <td className="p-3 text-rose-700">-{formatCurrency(sal.deductions || 0)}</td>
                      <td className="p-3 font-black text-emerald-800 text-sm">{formatCurrency(sal.netPaid)}</td>
                      <td className="p-3">
                        <Badge variant="teal">{sal.paymentMethod}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};