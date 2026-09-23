import { APP_NAME } from '../../constants/branding';
import React from 'react';
import { Expense } from '../../types/index';
import { useSettings } from '../../context/SettingsContext';
import { Modal } from '../common/Modal';
import { Printer, Download, CheckCircle, Clock, XCircle, Building, Calendar, DollarSign, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpenseVoucherModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
}

// Convert numbers to words (Pakistani Rupees)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  return (inWords(Math.floor(num)).trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

export const ExpenseVoucherModal: React.FC<ExpenseVoucherModalProps> = ({ expense, isOpen, onClose }) => {
  const { settings, formatCurrency } = useSettings();

  if (!expense) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    // Bismillah
    if (settings.showBismillah) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Bismillah-ir-Rahman-ir-Rahim', 105, 12, { align: 'center' });
    }

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(APP_NAME, 105, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${settings.address} | Phone: ${settings.phone}`, 105, 26, { align: 'center' });
    doc.text(`Reg No: ${settings.registrationNo}`, 105, 31, { align: 'center' });

    // Title
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL EXPENSE PAYMENT VOUCHER', 105, 43, { align: 'center' });

    // Metadata Table
    autoTable(doc, {
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Voucher Number', 'Date', 'Category', 'Payment Method']],
      body: [[
        expense.voucherNo,
        expense.date,
        expense.category,
        expense.paymentMethod
      ]],
    });

    // Details Table
    const lastY = (doc as any).lastAutoTable.finalY || 65;

    autoTable(doc, {
      startY: lastY + 5,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 4 },
      body: [
        ['Paid To / Vendor:', expense.paidTo],
        ['Expense Title:', expense.title],
        ['Amount Paid:', `${settings.currencySymbol} ${expense.amount.toLocaleString()} (${numberToWords(expense.amount)})`],
        ['Reference / Cheque #:', expense.referenceNo || 'N/A'],
        ['Created By:', expense.createdBy],
        ['Approval Status:', `${expense.status.toUpperCase()} ${expense.approvedBy ? `(By ${expense.approvedBy})` : ''}`],
        ['Notes / Item Details:', expense.notes || 'No extra notes provided.'],
      ],
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;

    // Signatures
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('_______________________', 30, finalY);
    doc.text('Prepared By', 40, finalY + 5);

    doc.text('_______________________', 105, finalY, { align: 'center' });
    doc.text('Treasurer / President', 105, finalY + 5, { align: 'center' });

    doc.text('_______________________', 170, finalY, { align: 'right' });
    doc.text('Receiver / Vendor Sign', 170, finalY + 5, { align: 'right' });

    doc.save(`${expense.voucherNo}_Expense_Voucher.pdf`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Expense Payment Voucher"
      subtitle={`Voucher #${expense.voucherNo}`}
      maxWidth="2xl"
    >
      <div className="space-y-6 text-slate-800 printable-content">
        {/* Printable Header */}
        <div className="border-b border-slate-200 pb-4 text-center">
          {settings.showBismillah && (
            <p className="text-[11px] font-serif text-slate-500 mb-1">
              بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
          )}
          <h2 className="text-lg font-black text-slate-900 tracking-wide">
            {APP_NAME}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {settings.address} • Ph: {settings.phone}
          </p>
          <div className="mt-2 inline-block px-3 py-1 bg-rose-50 border border-rose-200 rounded-full">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Expense Payment Voucher
            </span>
          </div>
        </div>

        {/* Voucher Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs font-medium">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Voucher #</span>
            <span className="font-bold text-slate-900">{expense.voucherNo}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Expense Date</span>
            <span className="font-bold text-slate-800">{expense.date}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
            <span className="font-bold text-slate-800">{expense.category}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Method</span>
            <span className="font-bold text-slate-800">{expense.paymentMethod}</span>
          </div>
        </div>

        {/* Main Voucher Body */}
        <div className="space-y-3 text-xs border border-slate-200 rounded-xl p-4">
          <div className="flex justify-between items-start pb-2 border-b border-slate-100">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Paid To / Vendor</p>
              <p className="text-sm font-black text-slate-900 mt-0.5">{expense.paidTo}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Outflow Amount</p>
              <p className="text-lg font-black text-rose-700 mt-0.5">{formatCurrency(expense.amount)}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Amount in Words</p>
            <p className="font-bold text-slate-800 italic bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 mt-1">
              {numberToWords(expense.amount)}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Expense Title / Description</p>
            <p className="font-semibold text-slate-800 mt-1">{expense.title}</p>
          </div>

          {expense.referenceNo && (
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Vendor Reference / Bill #</p>
              <p className="font-medium text-slate-700 mt-0.5">{expense.referenceNo}</p>
            </div>
          )}

          {expense.notes && (
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Itemization / Audit Notes</p>
              <p className="text-slate-600 mt-0.5 whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-between items-center text-[11px] text-slate-500">
            <div>
              Created By: <span className="font-bold text-slate-700">{expense.createdBy}</span>
            </div>
            <div>
              Status:{' '}
              <span className={`inline-flex items-center gap-1 font-bold ${
                expense.status === 'Approved' ? 'text-emerald-700' : expense.status === 'Pending' ? 'text-amber-700' : 'text-rose-700'
              }`}>
                {expense.status === 'Approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {expense.status} {expense.approvedBy ? `(Approved by ${expense.approvedBy})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-3 gap-4 pt-8 text-center text-[11px] font-bold text-slate-600">
          <div>
            <div className="border-b border-slate-300 mb-1.5 h-8"></div>
            <span>Prepared By</span>
          </div>
          <div>
            <div className="border-b border-slate-300 mb-1.5 h-8"></div>
            <span>Treasurer Signature</span>
          </div>
          <div>
            <div className="border-b border-slate-300 mb-1.5 h-8"></div>
            <span>Receiver / Vendor Sign</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Voucher
          </button>
        </div>
      </div>
    </Modal>
  );
};
