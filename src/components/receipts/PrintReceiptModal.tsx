import React, { useRef } from 'react';
import { Collection } from '../../types/index';
import { useSettings } from '../../context/SettingsContext';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface PrintReceiptModalProps {
  collection: Collection | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  collection,
  isOpen,
  onClose,
}) => {
  const { settings, formatCurrency } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !collection) return null;

  const handlePrint = async () => {
    const printContent = printRef.current;
    if (!printContent) return;

    try {
      await api.logAction('PRINT', 'Receipt Printing', `Printed receipt ${collection.receiptNo} for House ${collection.houseNo} (${collection.totalPaid} Rs.)`);
    } catch (e) {
      // ignore log error
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print receipt.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_${collection.receiptNo}</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              padding: 20px;
              color: #0f172a;
              background-color: #fff;
            }
            .receipt-box {
              max-width: 500px;
              margin: 0 auto;
              border: 2px solid #0f766e;
              border-radius: 12px;
              padding: 24px;
            }
            .header-title {
              text-align: center;
              font-size: 20px;
              font-weight: 800;
              color: #0f766e;
              margin-bottom: 2px;
            }
            .sub-title {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              margin-bottom: 12px;
            }
            .bismillah {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              font-family: serif;
              color: #0f766e;
              margin-bottom: 10px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              border-bottom: 1px dashed #e2e8f0;
              font-size: 13px;
            }
            .label { font-weight: 600; color: #475569; }
            .value { font-weight: 700; color: #0f172a; }
            .total-box {
              background-color: #f0fdf4;
              border: 1px solid #bbf7d0;
              padding: 12px;
              border-radius: 8px;
              margin-top: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .total-amount { font-size: 18px; font-weight: 800; color: #15803d; }
            .signatures {
              margin-top: 30px;
              display: flex;
              justify-content: space-between;
              padding-top: 20px;
              border-top: 1px solid #cbd5e1;
              font-size: 11px;
              color: #64748b;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            ${settings.showBismillah ? `<div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ''}
            <div class="header-title">${settings.mohallaName}</div>
            <div class="sub-title">${settings.address} | ${settings.phone}</div>
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="background: #e6fffa; color: #0f766e; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid #b2f5ea;">
                OFFICIAL MONTHLY RECEIPT
              </span>
            </div>

            <div class="row"><span class="label">Receipt No:</span><span class="value">${collection.receiptNo}</span></div>
            <div class="row"><span class="label">Date:</span><span class="value">${collection.paymentDate}</span></div>
            <div class="row"><span class="label">House No:</span><span class="value">${collection.houseNo}</span></div>
            <div class="row"><span class="label">Resident Head:</span><span class="value">${collection.headName}</span></div>
            <div class="row"><span class="label">Sector / Street:</span><span class="value">${collection.sector} - ${collection.street}</span></div>
            <div class="row"><span class="label">Target Month:</span><span class="value">${collection.month}</span></div>
            <div class="row"><span class="label">Payment Mode:</span><span class="value">${collection.paymentMethod} ${collection.referenceNo ? `(${collection.referenceNo})` : ''}</span></div>
            <div class="row"><span class="label">Base Amount:</span><span class="value">${formatCurrency(collection.amount)}</span></div>
            ${collection.lateFee > 0 ? `<div class="row"><span class="label">Late Fee:</span><span class="value">${formatCurrency(collection.lateFee)}</span></div>` : ''}

            <div class="total-box">
              <span style="font-weight: 700; color: #166534;">TOTAL PAID RECEIVED:</span>
              <span class="total-amount">${formatCurrency(collection.totalPaid)}</span>
            </div>

            <div class="signatures">
              <div>
                <div>________________________</div>
                <div style="margin-top: 4px;">Collector (${collection.collectorName})</div>
              </div>
              <div style="text-align: right;">
                <div>________________________</div>
                <div style="margin-top: 4px;">Treasurer / Stamp</div>
              </div>
            </div>

            <div class="footer">${settings.receiptFooter}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-teal-800 text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-300" />
            <h3 className="font-bold text-base">Receipt Preview & Print</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-teal-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-teal-200" />
          </button>
        </div>

        <div className="p-6 bg-slate-50/50">
          <div
            ref={printRef}
            className="bg-white rounded-xl border-2 border-teal-700/80 p-6 shadow-sm relative overflow-hidden"
          >
            {/* Watermark badge */}
            <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-teal-50 rounded-full flex items-center justify-center opacity-30 pointer-events-none">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-widest rotate-12">VERIFIED PAID</span>
            </div>

            {settings.showBismillah && (
              <p className="text-center text-teal-800 font-serif font-bold text-sm mb-2">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
            )}

            <div className="text-center">
              <h2 className="text-lg font-extrabold text-teal-800 tracking-tight">{settings.mohallaName}</h2>
              <p className="text-[11px] text-slate-500">{settings.address} • {settings.phone}</p>
              <div className="my-2">
                <span className="inline-block bg-teal-50 text-teal-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-teal-200">
                  {settings.receiptHeader}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs border-t border-b border-slate-200 py-3">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Receipt No:</span>
                <span className="font-bold text-slate-900">{collection.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Payment Date:</span>
                <span className="font-semibold text-slate-900">{collection.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">House Number:</span>
                <span className="font-bold text-teal-800">{collection.houseNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Resident Head:</span>
                <span className="font-semibold text-slate-900">{collection.headName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Sector & Street:</span>
                <span className="text-slate-800">{collection.sector} - {collection.street}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Contribution Month:</span>
                <span className="font-semibold text-slate-900">{collection.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Payment Method:</span>
                <span className="text-slate-800">{collection.paymentMethod} {collection.referenceNo ? `(${collection.referenceNo})` : ''}</span>
              </div>
            </div>

            <div className="my-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Monthly Fee Amount:</span>
                <span>{formatCurrency(collection.amount)}</span>
              </div>
              {collection.lateFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Late Fee Surcharge:</span>
                  <span>{formatCurrency(collection.lateFee)}</span>
                </div>
              )}
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">NET AMOUNT RECEIVED:</span>
              <span className="text-lg font-black text-emerald-700">{formatCurrency(collection.totalPaid)}</span>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-500">
              <div>
                <p className="font-medium text-slate-700">Collector: {collection.collectorName}</p>
                <p className="mt-4 border-t border-dashed border-slate-300 pt-1">Collector Signature</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-slate-700">Issued By: {settings.treasurerName}</p>
                <p className="mt-4 border-t border-dashed border-slate-300 pt-1">Treasurer Stamp & Sign</p>
              </div>
            </div>

            <p className="text-[10px] text-center text-slate-400 mt-4 italic">{settings.receiptFooter}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-100 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Receipt Now
          </button>
        </div>
      </div>
    </div>
  );
};
