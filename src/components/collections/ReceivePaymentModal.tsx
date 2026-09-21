import { currentMonth, monthLabel, monthOptions } from '../../utils/contributionMonth';
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { House, PaymentMethod, Collection } from '../../types/index';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  X, CheckCircle2, AlertTriangle, Search, Banknote, UserCheck,
  Calendar, FileText, Smartphone, Building
} from 'lucide-react';

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (collection: Collection) => void;
  preselectedHouseId?: string;
}

export const ReceivePaymentModal: React.FC<ReceivePaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  preselectedHouseId,
}) => {
  const { currentUser } = useAuth();
  const { formatCurrency } = useSettings();

  const [houses, setHouses] = useState<House[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);

  // Form states
  const [month, setMonth] = useState(monthLabel(currentMonth()));
  const [year, setYear] = useState<number>(Number(currentMonth().slice(0,4)));
  const [amount, setAmount] = useState<number>(0);
  const [lateFee, setLateFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [collectorName, setCollectorName] = useState(currentUser?.name || 'Mohalla Collector');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthsList = monthOptions().map(m => m.replace(/\d{4}$/, String(year)));

  useEffect(() => {
    if (isOpen) {
      fetchHouses();
      setCollectorName(currentUser?.name || 'Mohalla Collector');
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    if (selectedHouse && isOpen) api.getMonthlyDues(month).then(res => {
      const due = res.dues.find(d => d.houseId === selectedHouse.id);
      if (active && due) setAmount(Math.max(0, due.amount - due.paidAmount));
    }).catch((e: Error) => { if (active) setErrorMessage(e.message); });
    return () => { active = false; };
  }, [selectedHouse?.id, month, isOpen]);

  const fetchHouses = async () => {
    try {
      const res = await api.getHouses();
      if (res.success) {
        setHouses(res.houses);
        if (preselectedHouseId) {
          const found = res.houses.find(h => h.id === preselectedHouseId || h.houseNo === preselectedHouseId);
          if (found) selectHouse(found);
        }
      }
    } catch (e) {
      console.error('Failed to fetch houses', e);
    }
  };

  const selectHouse = (house: House) => {
    setSelectedHouse(house);
    setSearchTerm(`${house.houseNo} - ${house.headName}`);
    setAmount(house.monthlyFee);
    setShowDropdown(false);
    setErrorMessage(null);
  };

  const filteredHouses = houses.filter(h => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      h.houseNo.toLowerCase().includes(q) ||
      h.headName.toLowerCase().includes(q) ||
      h.phone.toLowerCase().includes(q) ||
      h.sector.toLowerCase().includes(q) ||
      h.street.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedHouse) {
      setErrorMessage('Please search and select a valid active house record.');
      return;
    }

    if (selectedHouse.status === 'Vacant') {
      setErrorMessage(`House ${selectedHouse.houseNo} is currently VACANT and cannot accept monthly collection.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createCollection({
        houseId: selectedHouse.id,
        month,
        year: Number(month.slice(-4)),
        amount: Number(amount),
        lateFee: Number(lateFee || 0),
        paymentMethod,
        referenceNo: referenceNo.trim(),
        remarks: remarks.trim(),
        collectorName,
      });

      if (res.success && res.collection) {
        onPaymentSuccess(res.collection);
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to record payment');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit payment. Please verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-teal-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-teal-200">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Receive Monthly Fee Payment</h2>
              <p className="text-[11px] text-teal-200">Issue official verified receipt & update house ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-teal-200 hover:text-white hover:bg-teal-700/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Searchable House Selection */}
          <div className="space-y-1.5 relative">
            <label className="block font-bold text-slate-800">
              1. Search House Number / Resident Owner <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Type House No (e.g. MS-A-101), Resident Name, or Mobile..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                  if (selectedHouse && e.target.value !== `${selectedHouse.houseNo} - ${selectedHouse.headName}`) {
                    setSelectedHouse(null);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
              />
            </div>

            {/* Dropdown Suggestions */}
            {showDropdown && filteredHouses.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredHouses.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => selectHouse(h)}
                    className="w-full text-left p-3 hover:bg-teal-50/80 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <span className="font-extrabold text-teal-900">{h.houseNo}</span>
                      <span className="ml-2 font-bold text-slate-700">{h.headName}</span>
                      <p className="text-[10px] text-slate-400">{h.sector}, {h.street} • Mobile: {h.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-slate-900 block">{formatCurrency(h.monthlyFee)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        h.status === 'Active' || h.status === 'Good Standing' ? 'bg-emerald-100 text-emerald-800' :
                        h.status === 'Warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auto-filled Selected House Summary Banner */}
          {selectedHouse && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Owner Name</span>
                <span className="font-bold text-slate-900 text-xs">{selectedHouse.headName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Phone</span>
                <span className="font-bold text-slate-900 text-xs">{selectedHouse.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Category</span>
                <span className="font-semibold text-slate-700 text-[11px]">{selectedHouse.category}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Monthly Fee</span>
                <span className="font-extrabold text-teal-800 text-xs">{formatCurrency(selectedHouse.monthlyFee)}</span>
              </div>
            </div>
          )}

          {/* Month & Year Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                2. Contribution Month <span className="text-rose-500">*</span>
              </label>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500"
              >
                {monthsList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                Contribution Year
              </label>
              <input
                type="number"
                value={year}
                onChange={e => { const value = Number(e.target.value); setYear(value); setMonth(month.replace(/\d{4}$/, String(value))); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Fee Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                3. Monthly Fee Amount (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-extrabold text-teal-800 text-sm focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[10px] text-slate-400 font-semibold">
                * Partial payment not allowed (Minimum {selectedHouse ? formatCurrency(selectedHouse.monthlyFee) : 'monthly fee'}).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                Late Fee Surcharge (Optional)
              </label>
              <input
                type="number"
                value={lateFee}
                onChange={e => setLateFee(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800">
              4. Select Payment Method <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'Bank', label: 'Bank Transfer', icon: Building },
                { id: 'JazzCash', label: 'JazzCash', icon: Smartphone },
                { id: 'EasyPaisa', label: 'EasyPaisa', icon: Smartphone },
              ].map(m => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center font-bold transition-all ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50/90 text-teal-900 ring-2 ring-teal-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-teal-700' : 'text-slate-400'}`} />
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference No & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                Bank / Txn Reference ID
              </label>
              <input
                type="text"
                placeholder="e.g. TID-98471204"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800">
                Fee Collector Name
              </label>
              <input
                type="text"
                value={collectorName}
                onChange={e => setCollectorName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800">
              Remarks / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid in cash at Mohalla office by resident head"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Total Payable Summary Footer */}
          <div className="bg-emerald-900 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-emerald-300 font-bold uppercase block">Total Cash Collected</span>
              <span className="text-xl font-black">{formatCurrency(Number(amount) + Number(lateFee || 0))}</span>
            </div>
            <div className="text-right text-[11px] text-emerald-200">
              <p className="font-bold">{month}</p>
              <p className="text-[10px] text-emerald-300">{paymentMethod} Payment</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedHouse}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-teal-800 hover:bg-teal-900 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-teal-300" />
              {submitting ? 'Recording...' : 'Submit Payment & Issue Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
