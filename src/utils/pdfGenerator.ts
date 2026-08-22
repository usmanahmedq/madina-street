import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HousePdfExportOptions {
  mohallaName?: string;
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

export function generatePdfTable({
  mohallaName = 'MADINA STREET MOHALLA SOCIETY',
  title,
  filename,
  headers,
  rows,
}: HousePdfExportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Brand Header
  doc.setFillColor(15, 118, 110); // Teal 700
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(mohallaName, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Official Directory Report • Generated on ${new Date().toLocaleDateString('en-PK', { dateStyle: 'full' })}`, 14, 18);

  // Document Title
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, 14, 32);

  // Table
  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount} • Madina Street Society Financial System`, 14, 287);
  }

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateHouseStatementPdf({
  houseNo,
  headName,
  sector,
  street,
  cnic,
  phone,
  monthlyFee,
  status,
  totalPaid,
  outstanding,
  collectionRate,
  pendingMonths,
  payments,
  mohallaName = 'Madina Street Mohalla Committee',
  address = 'Main Boulevard, Madina Street',
  contactPhone = '0300-1234567',
}: {
  houseNo: string;
  headName: string;
  sector: string;
  street: string;
  cnic?: string;
  phone: string;
  monthlyFee: number;
  status: string;
  totalPaid: number;
  outstanding: number;
  collectionRate: number;
  pendingMonths: string[];
  payments: Array<{
    receiptNo: string;
    month: string;
    paymentDate: string;
    paymentMethod: string;
    totalPaid: number;
  }>;
  mohallaName?: string;
  address?: string;
  contactPhone?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(13, 148, 136); // Teal 600
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(mohallaName.toUpperCase(), 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${address} | Contact: ${contactPhone}`, 14, 21);
  doc.text(`OFFICIAL HOUSE FINANCIAL STATEMENT`, 14, 26);

  // Profile Details Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 36, 182, 34, 2, 2, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`HOUSE RECORD: ${houseNo}`, 18, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Resident Owner / Head: ${headName}`, 18, 50);
  doc.text(`Location: ${sector}, ${street}`, 18, 56);
  doc.text(`Mobile: ${phone} | CNIC: ${cnic || 'N/A'}`, 18, 62);

  doc.text(`Monthly Tariff: Rs. ${monthlyFee.toLocaleString()}`, 115, 50);
  doc.text(`Account Status: ${status}`, 115, 56);
  doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 115, 62);

  // Financial Stats Row
  doc.setFillColor(236, 253, 245); // emerald 50
  doc.roundedRect(14, 74, 56, 18, 2, 2, 'F');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(7.5);
  doc.text('TOTAL CONTRIBUTIONS PAID', 18, 79);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${totalPaid.toLocaleString()}`, 18, 87);

  doc.setFillColor(254, 242, 242); // rose 50
  doc.roundedRect(77, 74, 56, 18, 2, 2, 'F');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('OUTSTANDING DUES', 81, 79);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${outstanding.toLocaleString()}`, 81, 87);

  doc.setFillColor(240, 253, 250); // teal 50
  doc.roundedRect(140, 74, 56, 18, 2, 2, 'F');
  doc.setTextColor(17, 94, 89);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('COLLECTION RATE', 144, 79);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${collectionRate}%`, 144, 87);

  let currentY = 98;

  if (pendingMonths.length > 0) {
    doc.setFillColor(254, 243, 199); // amber 100
    doc.roundedRect(14, currentY, 182, 10, 1, 1, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Pending Unpaid Months (${pendingMonths.length}): ${pendingMonths.join(', ')}`, 18, currentY + 6.5);
    currentY += 14;
  }

  // Itemized Table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMIZED PAYMENT HISTORY LOG', 14, currentY);

  const tableRows = payments.map(p => [
    p.receiptNo,
    p.month,
    p.paymentDate,
    p.paymentMethod,
    `Rs. ${p.totalPaid.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Receipt #', 'Target Month', 'Payment Date', 'Method', 'Amount Paid']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || currentY + 40;

  // Stamp & Signatures
  if (finalY + 30 < 280) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(14, finalY + 25, 70, finalY + 25);
    doc.text('Verified by Mohalla Auditor', 14, finalY + 29);

    doc.line(136, finalY + 25, 196, finalY + 25);
    doc.text('Society Treasurer Stamp & Signature', 136, finalY + 29);
  }

  doc.save(`Statement_House_${houseNo}.pdf`);
}
