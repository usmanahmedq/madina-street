import { APP_NAME } from '../constants/branding';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Building, User, Phone, MessageSquare, CreditCard, Calendar, 
  CheckCircle2, AlertCircle, AlertTriangle, Printer, FileSpreadsheet, Download, 
  Search, RefreshCw, History, ShieldAlert, Sparkles, Receipt, ChevronRight, FileText
} from 'lucide-react';
import { api } from '../services/api';
import { HouseProfileData, Collection } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { PrintReceiptModal } from '../components/receipts/PrintReceiptModal';
import { generateHouseStatementPdf } from '../utils/pdfGenerator';

export const HouseProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();

  const [profileData, setProfileData] = useState<HouseProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'statement' | 'timeline'>('history');

  // Payment history search & pagination
  const [historySearch, setHistorySearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected receipt for reprinting
  const [selectedReceipt, setSelectedReceipt] = useState<Collection | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const fetchProfile = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.getHouseProfile(id);
      if (res.success) {
        setProfileData(res.profile);
      }
    } catch (err) {
      console.error('Failed to load house profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading house financial profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">House Profile Not Found</h3>
        <p className="text-xs text-slate-500">The requested house record could not be loaded or does not exist.</p>
        <button
          onClick={() => navigate('/houses')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to House Directory
        </button>
      </div>
    );
  }

  const { house, financialSummary, paymentHistory, timeline } = profileData;

  // Filter payment history
  const filteredHistory = paymentHistory.filter(c =>
    c.receiptNo.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.month.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.paymentMethod.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.collectorName.toLowerCase().includes(historySearch.toLowerCase())
  );

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Good Standing':
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Good Standing
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Warning (1 Month Pending)
          </span>
        );
      case 'Defaulter':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Defaulter ({financialSummary.pendingMonthsCount} Months Pending)
          </span>
        );
      case 'Vacant':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Vacant Property</span>;
      case 'Exempted':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Fee Exempted</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const handleReprint = (collection: Collection) => {
    setSelectedReceipt(collection);
    setIsReceiptModalOpen(true);
  };

  const handlePrintStatement = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!profileData) return;
    generateHouseStatementPdf({
      houseNo: house.houseNo,
      headName: house.headName,
      sector: house.sector,
      street: house.street,
      cnic: house.cnic,
      phone: house.phone,
      monthlyFee: house.monthlyFee,
      status: financialSummary.statusClassification,
      totalPaid: financialSummary.totalPaidAmount,
      outstanding: financialSummary.outstandingAmount,
      collectionRate: financialSummary.collectionPercentage,
      pendingMonths: financialSummary.pendingMonthsList,
      payments: paymentHistory.filter(c => c.status !== 'Cancelled'),
      mohallaName: APP_NAME,
      address: settings.address,
      contactPhone: settings.phone,
    });
  };

  const handleExportCSV = () => {
    const headers = ['Receipt No', 'Month', 'Amount Paid', 'Late Fee', 'Total Paid', 'Payment Date', 'Payment Method', 'Collector', 'Status'];
    const rows = paymentHistory.map(c => [
      c.receiptNo,
      c.month,
      c.amount,
      c.lateFee,
      c.totalPaid,
      c.paymentDate,
      c.paymentMethod,
      c.collectorName,
      c.status || 'Paid',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_House_${house.houseNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cleanPhone = (phoneStr: string) => {
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.startsWith('0')) return '92' + digits.substring(1);
    if (digits.startsWith('92')) return digits;
    return '92' + digits;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/houses')}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            title="Back to Houses"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-slate-900">House Profile: {house.houseNo}</h1>
              {getStatusBadge(financialSummary.statusClassification)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {house.sector} • {house.street} • {house.category}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProfile}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            title="Refresh Profile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href={`https://wa.me/${cleanPhone(house.whatsapp || house.phone)}?text=Assalam%20o%20Alaikum%20${encodeURIComponent(house.headName)},%20regarding%20House%20${house.houseNo}%20monthly%20contribution.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp Owner
          </a>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Resident Owner / Head</p>
          <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-700 shrink-0" />
            {house.headName}
          </p>
          <p className="text-xs text-slate-500 mt-1">Type: <span className="font-semibold text-slate-700">{house.residentType}</span></p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Contact & CNIC</p>
          <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            {house.phone}
          </p>
          <p className="text-xs text-slate-500 mt-1">CNIC: <span className="font-mono text-slate-700">{house.cnic || 'Not Specified'}</span></p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Fee Structure</p>
          <p className="text-base font-extrabold text-teal-800 mt-1">
            {formatCurrency(house.monthlyFee)} <span className="text-xs font-normal text-slate-500">/ month</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Family Members: <span className="font-semibold text-slate-700">{house.familyMembers} Persons</span></p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Registration Info</p>
          <p className="text-xs font-semibold text-slate-800 mt-1 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Joined {house.joinedDate}
          </p>
          {house.notes && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">{house.notes}</p>}
        </div>
      </div>

      {/* Financial Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Amount Paid</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(financialSummary.totalPaidAmount)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{financialSummary.paidMonthsCount} Months Cleared</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expected Fee</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(financialSummary.totalExpectedAmount)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Assessed for 2026</p>
        </div>

        <div className={`rounded-2xl border p-5 shadow-2xs ${financialSummary.outstandingAmount > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Outstanding Dues</p>
          <p className={`text-2xl font-black mt-1 ${financialSummary.outstandingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatCurrency(financialSummary.outstandingAmount)}
          </p>
          <p className="text-[11px] font-semibold text-slate-600 mt-1">
            {financialSummary.pendingMonthsCount === 0 ? 'Fully Paid & Clear' : `${financialSummary.pendingMonthsCount} Pending Month(s)`}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collection Rate</p>
            <span className="text-xs font-extrabold text-teal-800">{financialSummary.collectionPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${financialSummary.collectionPercentage === 100 ? 'bg-emerald-500' : financialSummary.collectionPercentage >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${financialSummary.collectionPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Last Paid: <span className="font-semibold text-slate-700">{financialSummary.lastPaymentDate || 'None'}</span>
          </p>
        </div>
      </div>

      {/* Pending vs Paid Months Breakdown Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">2026 Monthly Payment Status Tracker</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Paid Months ({financialSummary.paidMonthsCount})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {financialSummary.paidMonthsList.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No months paid yet.</span>
              ) : (
                financialSummary.paidMonthsList.map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {m} ✓
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-rose-900">
              <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-rose-600" /> Pending Unpaid Months ({financialSummary.pendingMonthsCount})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {financialSummary.pendingMonthsList.length === 0 ? (
                <span className="text-xs text-emerald-700 font-semibold">No pending months! All dues cleared.</span>
              ) : (
                financialSummary.pendingMonthsList.map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {m} ✗
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <History className="w-4 h-4" />
            Payment History ({paymentHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'statement' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <FileText className="w-4 h-4" />
            Financial Statement
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'timeline' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Sparkles className="w-4 h-4" />
            Activity Timeline ({timeline.length})
          </button>
        </div>

        {activeTab === 'statement' && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700" /> PDF Statement
            </button>
            <button
              onClick={handlePrintStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print Statement
            </button>
          </div>
        )}
      </div>

      {/* Tab Content 1: Payment History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Table Search Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search receipts, months..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredHistory.length} record(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Target Month</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      No payment receipts found for this house.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map((col) => (
                    <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-teal-800">{col.receiptNo}{col.status === 'Cancelled' ? ' (Cancelled)' : ''}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{col.month}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 text-right">{formatCurrency(col.totalPaid)}</td>
                      <td className="py-3 px-4 text-slate-600">{col.paymentDate}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {col.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{col.collectorName}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleReprint(col)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors"
                        >
                          <Printer className="w-3 h-3" /> Reprint
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-50 font-semibold"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-md disabled:opacity-50 hover:bg-slate-50 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: House Financial Statement */}
      {activeTab === 'statement' && (
        <div className="bg-white rounded-2xl border-2 border-teal-800 p-8 shadow-md space-y-6 print:p-0 print:border-none print:shadow-none">
          {/* Statement Header */}
          <div className="text-center border-b border-slate-200 pb-6">
            <h2 className="text-2xl font-black text-teal-800">{APP_NAME}</h2>
            <p className="text-xs text-slate-500">{settings.address} • {settings.phone}</p>
            <div className="inline-block mt-3 px-4 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-full border border-teal-200 uppercase tracking-widest">
              OFFICIAL HOUSE FINANCIAL STATEMENT
            </div>
          </div>

          {/* House Opening Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">House Number:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{house.houseNo}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Resident Owner:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{house.headName}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Monthly Fee:</span>
              <p className="font-bold text-teal-800 text-sm mt-0.5">{formatCurrency(house.monthlyFee)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Account Status:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{financialSummary.statusClassification}</p>
            </div>
          </div>

          {/* Financial Totals */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-800 font-bold uppercase">Total Contributions Paid</span>
              <p className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(financialSummary.totalPaidAmount)}</p>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-xs text-rose-800 font-bold uppercase">Outstanding Dues</span>
              <p className="text-xl font-black text-rose-700 mt-1">{formatCurrency(financialSummary.outstandingAmount)}</p>
            </div>
            <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
              <span className="text-xs text-teal-800 font-bold uppercase">Collection Percentage</span>
              <p className="text-xl font-black text-teal-800 mt-1">{financialSummary.collectionPercentage}%</p>
            </div>
          </div>

          {/* Pending Months List */}
          {financialSummary.pendingMonthsList.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <span className="font-bold text-amber-900">Unpaid Pending Months Breakdown:</span>
              <p className="text-amber-800 font-medium">{financialSummary.pendingMonthsList.join(', ')}</p>
            </div>
          )}

          {/* Complete Payment Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Itemized Payment Log</h4>
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 border-r border-slate-200">Receipt #</th>
                  <th className="p-2.5 border-r border-slate-200">Month</th>
                  <th className="p-2.5 border-r border-slate-200">Payment Date</th>
                  <th className="p-2.5 border-r border-slate-200">Method</th>
                  <th className="p-2.5 text-right">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paymentHistory.filter(c => c.status !== 'Cancelled').map(c => (
                  <tr key={c.id}>
                    <td className="p-2.5 font-bold border-r border-slate-200">{c.receiptNo}</td>
                    <td className="p-2.5 border-r border-slate-200">{c.month}</td>
                    <td className="p-2.5 border-r border-slate-200">{c.paymentDate}</td>
                    <td className="p-2.5 border-r border-slate-200">{c.paymentMethod}</td>
                    <td className="p-2.5 text-right font-extrabold text-slate-900">{formatCurrency(c.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Statement Signatures */}
          <div className="pt-8 flex justify-between items-end text-xs text-slate-600">
            <div>
              <p className="border-t border-slate-400 pt-1 w-44 font-semibold">Mohalla Auditor / Verified</p>
            </div>
            <div className="text-right">
              <p className="border-t border-slate-400 pt-1 w-44 font-semibold">Society Treasurer Stamp</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: House Activity Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="relative border-l-2 border-teal-200 ml-4 pl-6 space-y-6">
            {timeline.map((evt) => (
              <div key={evt.id} className="relative group">
                {/* Bullet node */}
                <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-2xs flex items-center justify-center ${
                  evt.type === 'CREATED' ? 'bg-teal-700' :
                  evt.type === 'PAYMENT' ? 'bg-emerald-600' :
                  evt.type === 'STATUS_CHANGE' ? 'bg-amber-500' : 'bg-slate-500'
                }`} />

                <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-4 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{evt.title}</h4>
                    <span className="text-[10px] font-semibold text-slate-400">{evt.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{evt.description}</p>
                  <p className="text-[10px] font-semibold text-teal-800 mt-2">By: {evt.performedBy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receipt Reprint Modal */}
      {selectedReceipt && (
        <PrintReceiptModal
          collection={selectedReceipt}
          isOpen={isReceiptModalOpen}
          onClose={() => { setIsReceiptModalOpen(false); setSelectedReceipt(null); }}
        />
      )}
    </div>
  );
};
