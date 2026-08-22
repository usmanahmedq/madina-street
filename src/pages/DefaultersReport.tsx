import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Search, Filter, Printer, FileSpreadsheet, MessageSquare, 
  Eye, RefreshCw, AlertTriangle, AlertCircle, Phone, ArrowUpDown
} from 'lucide-react';
import { api } from '../services/api';
import { DefaulterReportItem } from '../types/index';
import { useSettings } from '../context/SettingsContext';

export const DefaultersReport: React.FC = () => {
  const navigate = useNavigate();
  const { formatCurrency, settings } = useSettings();

  const [defaulters, setDefaulters] = useState<DefaulterReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // ALL, Warning, Defaulter
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const fetchDefaulters = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDefaultersReport();
      if (res.success) {
        setDefaulters(res.defaulters);
      }
    } catch (err) {
      console.error('Failed to load defaulters report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaulters();
  }, []);

  const sectors = Array.from(new Set(defaulters.map(d => d.sector)));

  const filteredDefaulters = defaulters.filter(item => {
    const matchesSearch = 
      item.houseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    const matchesSector = selectedSector === 'ALL' || item.sector === selectedSector;

    return matchesSearch && matchesStatus && matchesSector;
  });

  const totalOutstanding = filteredDefaulters.reduce((sum, item) => sum + item.currentDues, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['House No', 'Sector', 'Street', 'Owner Name', 'Mobile', 'Monthly Fee', 'Pending Months Count', 'Pending Months List', 'Outstanding Amount', 'Last Payment Date'];
    const rows = filteredDefaulters.map(item => [
      item.houseNo,
      item.sector,
      item.street,
      `"${item.headName}"`,
      item.phone,
      item.monthlyFee,
      item.pendingMonthsCount,
      `"${item.pendingMonthsList.join('; ')}"`,
      item.currentDues,
      item.lastPaymentDate || 'None',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Defaulters_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Mohalla Dues & Defaulters Report</h1>
              <p className="text-xs text-slate-500">
                Track unpaid monthly contributions, defaulter houses, and pending dues
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={fetchDefaulters}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
            title="Refresh Report"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Defaulter / Warning Houses</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{filteredDefaulters.length} <span className="text-xs font-semibold text-slate-500">Houses</span></p>
        </div>

        <div className="bg-rose-50 rounded-2xl border border-rose-200/80 p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-rose-800 tracking-wider">Total Outstanding Uncollected Dues</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>

        <div className="bg-amber-50 rounded-2xl border border-amber-200/80 p-5 shadow-2xs">
          <p className="text-xs font-bold uppercase text-amber-800 tracking-wider">Warning Level (1 Month)</p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {filteredDefaulters.filter(d => d.status === 'Warning').length} <span className="text-xs font-semibold text-amber-800">Houses</span>
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search house #, owner or phone..."
            className="w-full pl-10 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Warning">Warning (1 Month)</option>
              <option value="Defaulter">Defaulter (2+ Months)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Defaulters Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Printable Header */}
        <div className="hidden print:block text-center p-6 border-b border-slate-300">
          <h2 className="text-xl font-black text-slate-900">{settings.mohallaName}</h2>
          <p className="text-xs text-slate-600">{settings.address} • {settings.phone}</p>
          <p className="text-sm font-bold text-rose-800 uppercase tracking-widest mt-2">DEFAULTERS & OUTSTANDING DUES REPORT</p>
          <p className="text-xs text-slate-500 mt-1">Generated on: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <th className="py-3.5 px-4">House #</th>
                <th className="py-3.5 px-4">Resident Owner</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4 text-right">Monthly Fee</th>
                <th className="py-3.5 px-4">Pending Months</th>
                <th className="py-3.5 px-4 text-right">Outstanding Dues</th>
                <th className="py-3.5 px-4">Last Payment</th>
                <th className="py-3.5 px-4 text-center print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-600 mb-2" />
                    Loading defaulter records...
                  </td>
                </tr>
              ) : filteredDefaulters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-emerald-700 font-bold">
                    ✓ No defaulters found! All house monthly contributions are up to date.
                  </td>
                </tr>
              ) : (
                filteredDefaulters.map((item) => (
                  <tr key={item.houseId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{item.houseNo}</div>
                      <div className="text-[10px] text-slate-400">{item.sector} - {item.street}</div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.headName}</td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {item.phone}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(item.monthlyFee)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${item.status === 'Defaulter' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.status === 'Defaulter' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {item.pendingMonthsCount} Month(s) Pending
                        </span>
                        <div className="text-[10px] text-slate-500 line-clamp-1">
                          {item.pendingMonthsList.join(', ')}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-rose-700 text-sm">
                        {formatCurrency(item.currentDues)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                      {item.lastPaymentDate ? (
                        <div>
                          <div>{item.lastPaymentDate}</div>
                          <div className="text-[10px] text-slate-400"># {item.lastReceiptNo}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No record</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/houses/${item.houseId}`)}
                          className="p-1.5 text-teal-800 hover:bg-teal-50 rounded-lg transition-colors border border-teal-200"
                          title="View House Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <a
                          href={`https://wa.me/${cleanPhone(item.whatsapp || item.phone)}?text=Assalam%20o%20Alaikum%20${encodeURIComponent(item.headName)},%20this%20is%20a%20reminder%20from%20${encodeURIComponent(settings.mohallaName)}%20regarding%20outstanding%20dues%20of%20Rs.%20${item.currentDues}%20for%20House%20${item.houseNo}.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                          title="Send WhatsApp Payment Reminder"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary in Table */}
        {!isLoading && filteredDefaulters.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-slate-800">
            <span>Total Defaulter Houses: {filteredDefaulters.length}</span>
            <span className="text-rose-800 font-extrabold text-sm">Cumulative Outstanding Balance: {formatCurrency(totalOutstanding)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
