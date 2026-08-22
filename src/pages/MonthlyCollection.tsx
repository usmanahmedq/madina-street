import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Collection, PaymentMethod } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { ExportButton } from '../components/common/ExportButton';
import { PrintReceiptModal } from '../components/receipts/PrintReceiptModal';
import { ReceivePaymentModal } from '../components/collections/ReceivePaymentModal';
import { DailyCashClosingModal } from '../components/collections/DailyCashClosingModal';
import { CollectionDashboard } from '../components/collections/CollectionDashboard';
import { CollectorPerformanceView } from '../components/collections/CollectorPerformanceView';
import {
  Banknote, Search, Printer, Trash2, Filter, Calendar,
  CreditCard, CheckCircle2, FileSpreadsheet, PlusCircle,
  LayoutDashboard, Users, Clock, ShieldAlert, Zap, RefreshCw
} from 'lucide-react';

export const MonthlyCollection: React.FC = () => {
  const { formatCurrency } = useSettings();
  const { canManageFinances } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'collectors'>('dashboard');

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for History Table
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isReceivePaymentOpen, setIsReceivePaymentOpen] = useState(false);
  const [isDailyClosingOpen, setIsDailyClosingOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Collection | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await api.getCollections();
      if (res.success) {
        setCollections(res.collections);
      }
    } catch (e) {
      console.error('Error fetching collections', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCancelCollection = async (id: string, receiptNo: string) => {
    const reason = prompt(`Provide cancellation reason for Receipt #${receiptNo}:`, 'Administrative Error / Incorrect Entry');
    if (reason === null) return;

    try {
      const res = await api.cancelCollection(id, reason);
      if (res.success) {
        alert(res.message || 'Receipt marked as Cancelled');
        fetchCollections();
      }
    } catch (e) {
      alert('Failed to cancel receipt');
    }
  };

  const handlePaymentSuccess = (newCollection: Collection) => {
    fetchCollections();
    setSelectedReceipt(newCollection); // Automatically open receipt print modal!
  };

  const handleBulkGenerateDues = async () => {
    const targetMonth = prompt('Enter target month for bulk dues generation:', 'September 2026');
    if (!targetMonth) return;

    try {
      const res = await api.bulkGenerateDues(targetMonth);
      if (res.success) {
        alert(`Successfully generated monthly fee dues for ${res.targetMonth} across ${res.updatedCount} active houses!`);
        fetchCollections();
      }
    } catch (e) {
      alert('Failed to generate bulk dues');
    }
  };

  const filteredCollections = collections.filter(c => {
    const matchesSearch =
      c.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.houseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.headName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.collectorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = monthFilter === 'ALL' || c.month === monthFilter;
    const matchesMethod = methodFilter === 'ALL' || c.paymentMethod === methodFilter;
    const matchesStatus = statusFilter === 'ALL' || (c.status || 'Paid') === statusFilter;
    return matchesSearch && matchesMonth && matchesMethod && matchesStatus;
  });

  const totalCollectedAmount = filteredCollections
    .filter(c => c.status !== 'Cancelled')
    .reduce((s, c) => s + c.totalPaid, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Page Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Monthly Collection Management System</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage fee receipts, daily cash closing, collector performance, and financial analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDailyClosingOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <Banknote className="w-4 h-4 text-teal-800" />
            Daily Cash Closing
          </button>

          {canManageFinances && (
            <button
              onClick={handleBulkGenerateDues}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Generate Dues
            </button>
          )}

          <button
            onClick={() => setIsReceivePaymentOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-teal-300" />
            Receive Payment
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'dashboard'
              ? 'border-teal-800 text-teal-900 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Collection Dashboard & Analytics
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-teal-800 text-teal-900 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Banknote className="w-4 h-4" />
          Payment Register & Receipts ({collections.length})
        </button>

        <button
          onClick={() => setActiveTab('collectors')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'collectors'
              ? 'border-teal-800 text-teal-900 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Collector Performance Tracker
        </button>
      </div>

      {/* Tab 1: Collection Dashboard */}
      {activeTab === 'dashboard' && (
        <CollectionDashboard
          onOpenReceivePayment={() => setIsReceivePaymentOpen(true)}
          onOpenDailyClosing={() => setIsDailyClosingOpen(true)}
        />
      )}

      {/* Tab 2: Payment History Register */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary KPI Bar */}
          <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Total Filtered Collection Inflow</p>
              <h2 className="text-2xl md:text-3xl font-black mt-1">{formatCurrency(totalCollectedAmount)}</h2>
              <p className="text-xs text-emerald-200 mt-1">{filteredCollections.length} Receipts Logged</p>
            </div>
            <div className="flex items-center gap-3">
              <ExportButton filename="Madina_Street_Collections" data={filteredCollections} />
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Receipt #, House #, Resident Name, or Collector..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
              >
                <option value="ALL">All Months</option>
                <option value="August 2026">August 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="June 2026">June 2026</option>
                <option value="May 2026">May 2026</option>
              </select>

              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
              >
                <option value="ALL">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Online Transfer">Online Transfer</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="Paid">Verified Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Collections Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">Receipt #</th>
                    <th className="p-4">House & Resident</th>
                    <th className="p-4">Month</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Total Paid</th>
                    <th className="p-4">Collector</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCollections.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                        No collection records found matching search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCollections.map(c => {
                      const isCancelled = c.status === 'Cancelled';
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isCancelled ? 'opacity-60 bg-slate-50/50 line-through' : ''}`}>
                          <td className="p-4 font-bold text-teal-800">{c.receiptNo}</td>
                          <td className="p-4">
                            <p className="font-bold text-slate-900">{c.houseNo} - {c.headName}</p>
                            <p className="text-[10px] text-slate-400">{c.sector}, {c.street}</p>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{c.month}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                              {c.paymentMethod}
                              {c.referenceNo && <span className="text-[10px] text-slate-400">({c.referenceNo})</span>}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">{c.paymentDate}</td>
                          <td className="p-4 font-black text-emerald-700 text-sm">
                            {formatCurrency(c.totalPaid)}
                          </td>
                          <td className="p-4 text-slate-600">{c.collectorName}</td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {c.status || 'Paid'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1 no-line-through">
                            <button
                              onClick={() => setSelectedReceipt(c)}
                              className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Print Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {canManageFinances && !isCancelled && (
                              <button
                                onClick={() => handleCancelCollection(c.id, c.receiptNo)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Cancel Receipt"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Collector Performance Tracker */}
      {activeTab === 'collectors' && (
        <CollectorPerformanceView collections={collections} />
      )}

      {/* Receive Payment Modal */}
      <ReceivePaymentModal
        isOpen={isReceivePaymentOpen}
        onClose={() => setIsReceivePaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Daily Cash Closing Modal */}
      <DailyCashClosingModal
        isOpen={isDailyClosingOpen}
        onClose={() => setIsDailyClosingOpen(false)}
      />

      {/* Print Receipt Modal */}
      <PrintReceiptModal
        isOpen={!!selectedReceipt}
        collection={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
