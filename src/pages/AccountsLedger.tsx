import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LedgerEntry } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { ExportButton } from '../components/common/ExportButton';
import {
  BookOpen, Search, ArrowUpRight, ArrowDownRight,
  Landmark, Filter, Calendar, ShieldCheck, RefreshCw, FileText
} from 'lucide-react';

export const AccountsLedger: React.FC = () => {
  const { formatCurrency } = useSettings();
  const { canManageFinances } = useAuth();

  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [refTypeFilter, setRefTypeFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await api.getLedger();
      if (res.success) {
        setLedger(res.ledger);
      }
    } catch (e) {
      console.error('Error fetching general ledger:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const filteredLedger = ledger.filter(entry => {
    const matchesSearch =
      entry.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.accountHead.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.performedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRefType = refTypeFilter === 'ALL' || entry.referenceType === refTypeFilter;
    const matchesStart = !startDate || entry.date >= startDate;
    const matchesEnd = !endDate || entry.date <= endDate;

    return matchesSearch && matchesRefType && matchesStart && matchesEnd;
  });

  const totalInflow = filteredLedger.reduce((sum, e) => sum + e.credit, 0);  // Income / Collections
  const totalOutflow = filteredLedger.reduce((sum, e) => sum + e.debit, 0);   // Expenses / Salaries
  const currentRunningBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-700" />
            Unified General Accounts Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready, chronological double-entry journal automatically synchronized across Monthly Collections, Expenses, and Salaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLedger}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Ledger
          </button>
          <ExportButton filename="Madina_Street_Accounts_Ledger" data={filteredLedger} />
        </div>
      </div>

      {/* Ledger KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Filtered Inflow (Credit)</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalInflow)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Collections & System opening balances</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Filtered Outflow (Debit)</p>
              <h3 className="text-2xl font-black text-rose-700 mt-1">{formatCurrency(totalOutflow)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Approved operational expenses & staff salaries</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
              <ArrowDownRight className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-950 to-teal-800 text-white rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-300">Society Treasury Net Liquidity</p>
              <h3 className="text-2xl font-black text-white mt-1">{formatCurrency(currentRunningBalance)}</h3>
              <p className="text-[10px] text-teal-200/80 mt-0.5">Real-time audited cash & bank position</p>
            </div>
            <div className="p-3 bg-teal-800/80 text-teal-200 rounded-xl border border-teal-700/60">
              <Landmark className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Guarantee Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-3.5 px-4 text-xs flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="font-semibold text-slate-200">
            Automated Audit Trail Active: Every entry in this ledger is linked directly to source vouchers (Receipts, Expense Vouchers, Salary Slips).
          </p>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
          Compliance Guarantee
        </span>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Voucher #, Receipt #, Account Head, or Description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Reference Module Filter */}
          <div>
            <select
              value={refTypeFilter}
              onChange={e => setRefTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Source Modules</option>
              <option value="COLLECTION">Monthly House Collections</option>
              <option value="EXPENSE">Operational Expenses</option>
              <option value="SALARY">Staff Salary Payments</option>
              <option value="ADJUSTMENT">System Opening Balances</option>
            </select>
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
              placeholder="From Date"
            />
            <span className="text-slate-400 font-bold text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
              placeholder="To Date"
            />
          </div>
        </div>
      </div>

      {/* Ledger Journal Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Reference / Voucher #</th>
                <th className="p-4">Source Module</th>
                <th className="p-4">Account Head</th>
                <th className="p-4">Transaction Description</th>
                <th className="p-4 text-right">Inflow / Credit (Rs.)</th>
                <th className="p-4 text-right">Outflow / Debit (Rs.)</th>
                <th className="p-4 text-right">Running Cash Balance</th>
                <th className="p-4">Auditor / User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                    Compiling general accounts ledger...
                  </td>
                </tr>
              ) : filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                    No ledger transactions found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredLedger.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-slate-600 font-semibold whitespace-nowrap">{entry.date}</td>
                    <td className="p-4 font-bold text-slate-900 whitespace-nowrap">{entry.referenceNo}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.referenceType === 'COLLECTION' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        entry.referenceType === 'EXPENSE' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                        entry.referenceType === 'SALARY' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {entry.referenceType}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-semibold text-slate-800">
                      {entry.accountHead}
                    </td>
                    <td className="p-4 text-slate-800 max-w-xs truncate font-medium">
                      {entry.description}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-700 whitespace-nowrap">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                    <td className="p-4 text-right font-black text-rose-700 whitespace-nowrap">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="p-4 text-right font-black text-slate-900 bg-slate-50/60 whitespace-nowrap text-sm">
                      {formatCurrency(entry.runningBalance)}
                    </td>
                    <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">{entry.performedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
