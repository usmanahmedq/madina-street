import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Collection } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { PrintReceiptModal } from '../components/receipts/PrintReceiptModal';
import { Printer, Search, FileText, CheckCircle2 } from 'lucide-react';

export const ReceiptPrinting: React.FC = () => {
  const { formatCurrency, settings, updateSettings } = useSettings();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Collection | null>(null);

  // Receipt customization state
  const [showBismillah, setShowBismillah] = useState(settings.showBismillah);
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);

  useEffect(() => {
    api.getCollections().then(res => {
      if (res.success) {
        setCollections(res.collections);
      }
    });
  }, []);

  const handleSaveBranding = async () => {
    await updateSettings({
      showBismillah,
      receiptHeader,
      receiptFooter,
    });
    alert('Receipt template branding saved!');
  };

  const filteredCollections = collections.filter(c =>
    c.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.houseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.headName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Receipt Printing & Template Setup</h1>
        <p className="text-xs text-slate-500 mt-0.5">Search receipts by number or house, customize headers, and trigger instant print</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template Branding Customizer */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Printer className="w-4 h-4 text-teal-700" />
            Receipt Layout Configurator
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 rounded-lg border border-slate-200 font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={showBismillah}
                onChange={e => setShowBismillah(e.target.checked)}
                className="w-4 h-4 text-teal-700 rounded focus:ring-teal-500"
              />
              Show Arabic Bismillah Header
            </label>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Receipt Tagline Header</label>
              <input
                type="text"
                value={receiptHeader}
                onChange={e => setReceiptHeader(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Receipt Footer Message</label>
              <textarea
                rows={3}
                value={receiptFooter}
                onChange={e => setReceiptFooter(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <button
              onClick={handleSaveBranding}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition-colors shadow-xs"
            >
              Save Template Settings
            </button>
          </div>
        </div>

        {/* Right Column: Receipt Finder & Quick Reprint Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search receipt by Receipt #, House #, or Resident Name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">Receipt #</th>
                    <th className="p-4">House & Resident</th>
                    <th className="p-4">Month</th>
                    <th className="p-4">Total Paid</th>
                    <th className="p-4 text-right">Reprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCollections.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-teal-800">{c.receiptNo}</td>
                      <td className="p-4 font-bold text-slate-900">{c.houseNo} - {c.headName}</td>
                      <td className="p-4 text-slate-700">{c.month}</td>
                      <td className="p-4 font-black text-emerald-700">{formatCurrency(c.totalPaid)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedReceipt(c)}
                          className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Reprint
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <PrintReceiptModal
        isOpen={!!selectedReceipt}
        collection={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
};
