import React from 'react';
import { SalaryPayment } from '../../types/index';
import { useSettings } from '../../context/SettingsContext';
import { Modal } from '../common/Modal';
import { Printer, Download, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalarySlipModalProps {
  salary: SalaryPayment | null;
  onClose: () => void;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ salary, onClose }) => {
  const { settings, formatCurrency } = useSettings();

  if (!salary) return null;

  const base = salary.baseSalary || 0;
  const allowance = salary.allowance || 0;
  const bonus = salary.bonus || 0;
  const deductions = salary.deductions || 0;
  const netPaid = salary.netPaid || (base + allowance + bonus - deductions);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(15, 118, 110); // Teal-700
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.mohallaName || 'MADINA STREET WELFARE SOCIETY', 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL STAFF SALARY DISBURSAL SLIP', 14, 21);

    // Slip Info Box
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Salary Slip #: ${salary.slipNo}`, 14, 38);
    doc.text(`Payment Date: ${salary.paymentDate}`, 130, 38);

    doc.setLineWidth(0.5);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 42, 196, 42);

    // Employee Meta Table
    autoTable(doc, {
      startY: 46,
      head: [['Employee Field', 'Details', 'Salary Month', 'Payment Mode']],
      body: [
        ['Staff Name', salary.staffName, 'Target Month', salary.month],
        ['Designation', salary.staffRole, 'Disbursed By', salary.paidBy || settings.treasurerName],
        ['Payment Method', salary.paymentMethod, 'Status', 'PAID & VERIFIED'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    // Earnings & Deductions Table
    const currentY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: currentY,
      head: [['Component', 'Type', 'Amount (PKR)']],
      body: [
        ['Basic Monthly Salary', 'Earning', `Rs. ${base.toLocaleString()}`],
        ['Special Allowance', 'Earning', `Rs. ${allowance.toLocaleString()}`],
        ['Performance Bonus / Reward', 'Earning', `Rs. ${bonus.toLocaleString()}`],
        ['Absence / Leave Deductions', 'Deduction', `- Rs. ${deductions.toLocaleString()}`],
        ['NET SALARY PAID', 'NET PAYABLE', `Rs. ${netPaid.toLocaleString()}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9.5, cellPadding: 3.5 },
      columnStyles: {
        2: { fontStyle: 'bold', halign: 'right' }
      }
    });

    // Signature Footer
    const footerY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('_______________________', 20, footerY);
    doc.text('Employee Signature', 20, footerY + 6);

    doc.text('_______________________', 80, footerY);
    doc.text('Treasurer Signature', 80, footerY + 6);

    doc.text('_______________________', 140, footerY);
    doc.text('President Signature', 140, footerY + 6);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings.mohallaName} • Computer Generated Official Slip`, 14, footerY + 20);

    doc.save(`Salary_Slip_${salary.slipNo}_${salary.staffName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Salary Slip #${salary.slipNo}`} maxWidth="max-w-2xl">
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Printable Voucher Card */}
        <div id="printable-salary-slip" className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden space-y-6">
          {/* Header */}
          <div className="border-b border-slate-200 pb-5 flex items-start justify-between">
            <div>
              {settings.showBismillah && (
                <p className="text-xs font-bold text-teal-800 text-center mb-1 font-serif">
                  بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
                </p>
              )}
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{settings.mohallaName}</h2>
              <p className="text-xs text-slate-500 font-medium">{settings.address}</p>
              <p className="text-[11px] text-slate-400">Phone: {settings.phone} | Reg: {settings.registrationNo}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" /> PAID SLIP
              </span>
              <p className="text-xs font-bold text-slate-700 mt-2">Slip #: {salary.slipNo}</p>
              <p className="text-[11px] text-slate-500">Date: {salary.paymentDate}</p>
            </div>
          </div>

          {/* Employee & Payroll Meta */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Employee Details</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{salary.staffName}</p>
              <p className="text-teal-800 font-semibold">{salary.staffRole}</p>
              <p className="text-slate-500 text-[11px] mt-1">Staff ID: {salary.staffId}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Salary Month & Disbursal</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{salary.month}</p>
              <p className="text-slate-700">Payment Mode: <span className="font-bold">{salary.paymentMethod}</span></p>
              <p className="text-slate-500 text-[11px] mt-1">Authorized By: {salary.paidBy || settings.treasurerName}</p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">Salary Component</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="p-3 text-slate-800">Basic Monthly Salary</td>
                  <td className="p-3 text-emerald-700 font-bold">Earning</td>
                  <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(base)}</td>
                </tr>
                {allowance > 0 && (
                  <tr>
                    <td className="p-3 text-slate-800">Special Medical / Travel Allowance</td>
                    <td className="p-3 text-emerald-700 font-bold">Allowance</td>
                    <td className="p-3 text-right font-bold text-emerald-700">+{formatCurrency(allowance)}</td>
                  </tr>
                )}
                {bonus > 0 && (
                  <tr>
                    <td className="p-3 text-slate-800">Performance Bonus / Eid Reward</td>
                    <td className="p-3 text-emerald-700 font-bold">Bonus</td>
                    <td className="p-3 text-right font-bold text-emerald-700">+{formatCurrency(bonus)}</td>
                  </tr>
                )}
                {deductions > 0 && (
                  <tr>
                    <td className="p-3 text-slate-800">Leave / Absence Deductions</td>
                    <td className="p-3 text-rose-600 font-bold">Deduction</td>
                    <td className="p-3 text-right font-bold text-rose-600">-{formatCurrency(deductions)}</td>
                  </tr>
                )}
                <tr className="bg-teal-50/80 border-t-2 border-teal-600 font-black text-slate-900 text-sm">
                  <td className="p-3.5 text-teal-900 uppercase">Net Disbursed Salary</td>
                  <td className="p-3.5 text-teal-800">NET PAYABLE</td>
                  <td className="p-3.5 text-right text-teal-900 text-base">{formatCurrency(netPaid)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {salary.notes && (
            <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
              <span className="font-bold">Remarks:</span> {salary.notes}
            </div>
          )}

          {/* Signature Lines */}
          <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[11px] font-bold text-slate-600">
            <div>
              <div className="border-b border-slate-300 pb-1 mb-1"></div>
              <p>Employee Signature</p>
            </div>
            <div>
              <div className="border-b border-slate-300 pb-1 mb-1"></div>
              <p>Treasurer ({settings.treasurerName})</p>
            </div>
            <div>
              <div className="border-b border-slate-300 pb-1 mb-1"></div>
              <p>President ({settings.presidentName})</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print Slip
          </button>

          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Official PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};
