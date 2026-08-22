import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { House, PaymentMethod, ExpenseCategory } from '../../types/index';
import { PrintReceiptModal } from '../receipts/PrintReceiptModal';

export const AppLayout: React.FC = () => {
  const { user, loading } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Quick Collection Modal State
  const [showQuickCollection, setShowQuickCollection] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState('');
  const [collectionMonth, setCollectionMonth] = useState('August 2026');
  const [collectionAmount, setCollectionAmount] = useState<number>(1500);
  const [collectionLateFee, setCollectionLateFee] = useState<number>(0);
  const [collectionMethod, setCollectionMethod] = useState<PaymentMethod>('Cash');
  const [collectionRef, setCollectionRef] = useState('');
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // Quick Expense Modal State
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Street Lighting');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>('Cash');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Receipt Modal State
  const [createdCollectionReceipt, setCreatedCollectionReceipt] = useState<any>(null);

  useEffect(() => {
    if (showQuickCollection) {
      api.getHouses().then(res => {
        if (res.success && res.houses) {
          setHouses(res.houses);
          if (res.houses.length > 0 && !selectedHouseId) {
            setSelectedHouseId(res.houses[0].id);
            setCollectionAmount(res.houses[0].monthlyFee);
          }
        }
      });
    }
  }, [showQuickCollection]);

  const handleHouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedHouseId(id);
    const target = houses.find(h => h.id === id);
    if (target) {
      setCollectionAmount(target.monthlyFee);
    }
  };

  const handleSubmitQuickCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouseId) return;

    setIsSubmittingCollection(true);
    try {
      const res = await api.createCollection({
        houseId: selectedHouseId,
        month: collectionMonth,
        amount: collectionAmount,
        lateFee: collectionLateFee,
        paymentMethod: collectionMethod,
        referenceNo: collectionRef,
      });

      if (res.success && res.collection) {
        setShowQuickCollection(false);
        setCreatedCollectionReceipt(res.collection);
        setCollectionRef('');
        setCollectionLateFee(0);
      }
    } catch (err) {
      alert('Failed to record collection');
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  const handleSubmitQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;

    setIsSubmittingExpense(true);
    try {
      const res = await api.createExpense({
        title: expenseTitle,
        category: expenseCategory,
        amount: expenseAmount,
        paidTo: expensePaidTo || 'Vendor',
        paymentMethod: expenseMethod,
      });

      if (res.success) {
        setShowQuickExpense(false);
        setExpenseTitle('');
        setExpenseAmount(0);
        setExpensePaidTo('');
        window.location.reload();
      }
    } catch (err) {
      alert('Failed to add expense');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-600">Loading Madina Street System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Header
          onOpenQuickCollection={() => setShowQuickCollection(true)}
          onOpenQuickExpense={() => setShowQuickExpense(true)}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Quick Record Collection Modal */}
      <Modal
        isOpen={showQuickCollection}
        onClose={() => setShowQuickCollection(false)}
        title="Record Monthly Collection"
        subtitle="Issue official receipt for house contribution"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitQuickCollection} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Select House / Residence</label>
            <select
              value={selectedHouseId}
              onChange={handleHouseChange}
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
            >
              {houses.map(h => (
                <option key={h.id} value={h.id}>
                  {h.houseNo} - {h.headName} ({h.sector}, {h.street}) [Dues: Rs. {h.currentDues}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Month</label>
              <select
                value={collectionMonth}
                onChange={e => setCollectionMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="August 2026">August 2026</option>
                <option value="September 2026">September 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="June 2026">June 2026</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={collectionMethod}
                onChange={e => setCollectionMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="Cash">Cash</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="Mobile Wallet">Mobile Wallet (Easypaisa/JazzCash)</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fee Amount (Rs.)</label>
              <input
                type="number"
                required
                min="0"
                value={collectionAmount}
                onChange={e => setCollectionAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Late Fee Surcharge (Rs.)</label>
              <input
                type="number"
                min="0"
                value={collectionLateFee}
                onChange={e => setCollectionLateFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
              />
            </div>
          </div>

          {collectionMethod !== 'Cash' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Ref / Cheque No</label>
              <input
                type="text"
                placeholder="e.g. TXN-998811"
                value={collectionRef}
                onChange={e => setCollectionRef(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between mt-2">
            <span className="font-bold text-emerald-900">Total Net Payment:</span>
            <span className="text-base font-black text-emerald-700">
              Rs. {(Number(collectionAmount || 0) + Number(collectionLateFee || 0)).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowQuickCollection(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCollection}
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm"
            >
              {isSubmittingCollection ? 'Saving...' : 'Confirm & Print Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Expense Modal */}
      <Modal
        isOpen={showQuickExpense}
        onClose={() => setShowQuickExpense(false)}
        title="Record Expense Voucher"
        subtitle="Log mohalla operational outflow"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitQuickExpense} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Title / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Street Light Replacement (Street 2)"
              value={expenseTitle}
              onChange={e => setExpenseTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <select
                value={expenseCategory}
                onChange={e => setExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="Street Lighting">Street Lighting</option>
                <option value="Sanitation & Waste">Sanitation & Waste</option>
                <option value="Security Staff">Security Staff</option>
                <option value="Mosque Contribution">Mosque Contribution</option>
                <option value="Water & Drainage">Water & Drainage</option>
                <option value="Roads & Repairs">Roads & Repairs</option>
                <option value="Office & Admin">Office & Admin</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount (Rs.)</label>
              <input
                type="number"
                required
                min="1"
                value={expenseAmount || ''}
                onChange={e => setExpenseAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Paid To (Vendor / Person)</label>
              <input
                type="text"
                placeholder="e.g. Al-Rehman Electric Shop"
                value={expensePaidTo}
                onChange={e => setExpensePaidTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseMethod}
                onChange={e => setExpenseMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="Cash">Cash</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowQuickExpense(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingExpense}
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm"
            >
              {isSubmittingExpense ? 'Saving...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Print Receipt Modal */}
      <PrintReceiptModal
        isOpen={!!createdCollectionReceipt}
        collection={createdCollectionReceipt}
        onClose={() => {
          setCreatedCollectionReceipt(null);
          window.location.reload();
        }}
      />
    </div>
  );
};
