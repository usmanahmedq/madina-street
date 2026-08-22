import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import {
  X, Printer, Calendar, Banknote, Receipt, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, Shield
} from 'lucide-react';

interface DailyCashClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyCashClosingModal: React.FC<DailyCashClosingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { formatCurrency, settings } = useSettings();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchClosingReport(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const fetchClosingReport = async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await api.getDailyCashClosing(dateStr);
      if (res.success) {
        setData(res.closingReport);
      }
    } catch (e) {
      console.error('Error fetching closing report', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily_Cash_Closing_${selectedDate}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; }
            .box { max-width: 600px; margin: 0 auto; border: 2px solid #0f766e; border-radius: 12px; padding: 24px; }
            .header { text-align: center; border-bottom: 2px border-style: solid; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: 800; color: #0f766e; }
            .sub { font-size: 12px; color: #64748b; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; }
            .label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            .total { background: #f0fdf4; font-weight: 800; color: #15803d; }
            .signatures { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <div class="title">${settings.mohallaName}</div>
              <div class="sub">DAILY CASH CLOSING & AUDIT REPORT</div>
              <div style="font-weight:700; margin-top: 4px; font-size:13px;">Date: ${selectedDate}</div>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Opening Cash Balance</div><div class="val">${formatCurrency(data?.openingBalance || 0)}</div></div>
              <div class="card"><div class="label">Today's Total Collections</div><div class="val" style="color:#15803d;">${formatCurrency(data?.totalTodayCollections || 0)}</div></div>
              <div class="card"><div class="label">Today's Total Expenses</div><div class="val" style="color:#b91c1c;">${formatCurrency(data?.totalTodayExpenses || 0)}</div></div>
              <div class="card"><div class="label">Net Closing Balance</div><div class="val" style="color:#0f766e;">${formatCurrency(data?.netCash || 0)}</div></div>
            </div>

            <div style="font-weight:700; font-size:13px; margin-top:16px;">Collection Methods Breakdown</div>
            <table>
              <thead><tr><th>Method</th><th>Total Received</th></tr></thead>
              <tbody>
                ${Object.keys(data?.methodSummary || {}).map(m => `
                  <tr><td>${m}</td><td>${formatCurrency(data.methodSummary[m])}</td></tr>
                `).join('')}
              </tbody>
            </table>

            <div style="font-weight:700; font-size:13px; margin-top:16px;">Collector Wise Summary</div>
            <table>
              <thead><tr><th>Collector Name</th><th>Receipts Issued</th><th>Total Collected</th></tr></thead>
              <tbody>
                ${Object.keys(data?.collectorSummary || {}).map(cName => `
                  <tr>
                    <td>${cName}</td>
                    <td>${data.collectorSummary[cName].count}</td>
                    <td>${formatCurrency(data.collectorSummary[cName].amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="signatures">
              <div>
                <div>__________________________</div>
                <div>Collector / Cashier Sign</div>
              </div>
              <div>
                <div>__________________________</div>
                <div>Treasurer Signature & Stamp</div>
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-teal-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-teal-200">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Daily Cash Closing Statement</h2>
              <p className="text-[11px] text-teal-200">Reconcile cash collections, expenses & collector balances</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-2.5 py-1 bg-teal-900 text-white border border-teal-700 rounded-lg text-xs font-bold"
            />
            <button onClick={onClose} className="p-1.5 text-teal-200 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs" ref={printRef}>
          {loading ? (
            <div className="py-12 text-center text-slate-400 font-semibold">Generating cash closing statement...</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Opening Cash</span>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatCurrency(data?.openingBalance || 0)}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">+ Today's Collections</span>
                  <p className="text-base font-extrabold text-emerald-800 mt-0.5">{formatCurrency(data?.totalTodayCollections || 0)}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">{data?.collectionsCount || 0} Receipts</span>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-bold uppercase block">- Today's Expenses</span>
                  <p className="text-base font-extrabold text-rose-800 mt-0.5">{formatCurrency(data?.totalTodayExpenses || 0)}</p>
                  <span className="text-[10px] text-rose-600 font-semibold">{data?.expensesCount || 0} Vouchers</span>
                </div>
                <div className="p-3.5 rounded-xl bg-teal-900 text-white shadow-xs">
                  <span className="text-[10px] text-teal-300 font-bold uppercase block">Net Cash Balance</span>
                  <p className="text-base font-black mt-0.5">{formatCurrency(data?.netCash || 0)}</p>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 border-b border-slate-100 pb-1">Payment Method Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.keys(data?.methodSummary || {}).map(m => (
                    <div key={m} className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <span className="text-[10px] text-slate-400 font-bold block">{m}</span>
                      <span className="font-black text-slate-900 text-sm">{formatCurrency(data.methodSummary[m])}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collector Breakdown Table */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 border-b border-slate-100 pb-1">Collector Performance Summary</h3>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="p-2.5">Collector Name</th>
                      <th className="p-2.5">Receipts Issued</th>
                      <th className="p-2.5 text-right">Total Cash Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {Object.keys(data?.collectorSummary || {}).length === 0 ? (
                      <tr><td colSpan={3} className="p-4 text-center text-slate-400">No collections recorded for {selectedDate}.</td></tr>
                    ) : (
                      Object.keys(data.collectorSummary).map(cName => (
                        <tr key={cName}>
                          <td className="p-2.5 font-bold text-slate-900">{cName}</td>
                          <td className="p-2.5 text-slate-600">{data.collectorSummary[cName].count} Receipts</td>
                          <td className="p-2.5 text-right font-black text-emerald-700">{formatCurrency(data.collectorSummary[cName].amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 bg-slate-100 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Daily Closing Report
          </button>
        </div>
      </div>
    </div>
  );
};
