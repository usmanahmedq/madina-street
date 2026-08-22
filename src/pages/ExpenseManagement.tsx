import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Expense, PaymentMethod, FinancialSummaryData } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ExportButton } from '../components/common/ExportButton';
import { ExpenseVoucherModal } from '../components/expenses/ExpenseVoucherModal';
import { ExpenseAnalytics } from '../components/expenses/ExpenseAnalytics';
import {
  Receipt, Search, Plus, Filter, Trash2, Tag, Calendar,
  CreditCard, UserCheck, TrendingDown, Eye, CheckCircle, Clock,
  FileText, BarChart2, Layers, Download, RefreshCw, AlertCircle
} from 'lucide-react';

export const ExpenseManagement: React.FC = () => {
  const { formatCurrency } = useSettings();
  const { canManageFinances, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYTICS'>('LIST');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; description?: string; isDefault?: boolean }>>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Voucher for Printable View
  const [viewVoucher, setViewVoucher] = useState<Expense | null>(null);

  // Add / Edit Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidTo, setPaidTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptAttachmentUrl, setReceiptAttachmentUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catError, setCatError] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [expRes, catRes, sumRes] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories(),
        api.getFinancialSummary(),
      ]);

      if (expRes.success) setExpenses(expRes.expenses);
      if (catRes.success) setCategories(catRes.categories);
      if (sumRes.success) setFinancialSummary(sumRes.summary);
    } catch (e) {
      console.error('Error fetching expenses context:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const resetForm = () => {
    setEditingExpense(null);
    setTitle('');
    setCategory(categories[0]?.name || 'Street Lighting');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaidTo('');
    setPaymentMethod('Cash');
    setReferenceNo('');
    setNotes('');
    setReceiptAttachmentUrl('');
    setFormError('');
  };

  const openAddModal = () => {
    resetForm();
    if (categories.length > 0) setCategory(categories[0].name);
    setShowFormModal(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setCategory(exp.category);
    setAmount(exp.amount);
    setDate(exp.date);
    setPaidTo(exp.paidTo);
    setPaymentMethod(exp.paymentMethod);
    setReferenceNo(exp.referenceNo || '');
    setNotes(exp.notes || '');
    setReceiptAttachmentUrl(exp.receiptAttachmentUrl || '');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Expense Title / Description is required.');
      return;
    }

    if (!paidTo.trim()) {
      setFormError('Payee / Recipient Vendor name is required.');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Expense amount must be a positive number greater than zero.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (date > todayStr) {
      setFormError(`Expense date cannot be in the future (${date}). Today is ${todayStr}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingExpense) {
        const res = await api.updateExpense(editingExpense.id, {
          title,
          category,
          amount: numAmount,
          date,
          paidTo,
          paymentMethod,
          referenceNo,
          notes,
          receiptAttachmentUrl,
        });

        if (res.success) {
          setShowFormModal(false);
          fetchExpenses();
        }
      } else {
        const res = await api.createExpense({
          title,
          category,
          amount: numAmount,
          date,
          paidTo,
          paymentMethod,
          referenceNo,
          notes,
          receiptAttachmentUrl,
        });

        if (res.success) {
          setShowFormModal(false);
          fetchExpenses();
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveExpense = async (id: string, voucherNo: string) => {
    try {
      const res = await api.approveExpense(id);
      if (res.success) {
        fetchExpenses();
      }
    } catch (err) {
      alert('Failed to approve expense voucher');
    }
  };

  const handleDeleteExpense = async (id: string, voucherNo: string) => {
    if (!confirm(`Are you sure you want to delete expense voucher ${voucherNo}? This action is irreversible.`)) return;
    try {
      await api.deleteExpense(id);
      fetchExpenses();
    } catch (e) {
      alert('Failed to delete expense record');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    if (!newCatName.trim()) {
      setCatError('Category name is required.');
      return;
    }

    try {
      const res = await api.createExpenseCategory(newCatName.trim(), newCatDesc.trim());
      if (res.success) {
        setNewCatName('');
        setNewCatDesc('');
        // Refresh categories
        const catRes = await api.getExpenseCategories();
        if (catRes.success) setCategories(catRes.categories);
      }
    } catch (err: any) {
      setCatError(err.message || 'Failed to create custom category');
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category '${catName}'?`)) return;
    try {
      await api.deleteExpenseCategory(catId);
      const catRes = await api.getExpenseCategories();
      if (catRes.success) setCategories(catRes.categories);
    } catch (e) {
      alert('Failed to delete custom category');
    }
  };

  // Filtered Expenses Computation
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch =
      exp.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.paidTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.amount.toString().includes(searchTerm);

    const matchesCategory = categoryFilter === 'ALL' || exp.category === categoryFilter;
    const matchesMethod = paymentMethodFilter === 'ALL' || exp.paymentMethod === paymentMethodFilter;
    const matchesStatus = statusFilter === 'ALL' || exp.status === statusFilter;
    const matchesStart = !startDate || exp.date >= startDate;
    const matchesEnd = !endDate || exp.date <= endDate;

    return matchesSearch && matchesCategory && matchesMethod && matchesStatus && matchesStart && matchesEnd;
  });

  const totalFilteredOutflow = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-700" />
            Expense Management System
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record operational outflows, manage expense categories, print vouchers, and analyze society budget
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Expense Vouchers
            </button>
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'ANALYTICS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Analytics & Trends
            </button>
          </div>

          <ExportButton filename="Madina_Street_Expenses" data={filteredExpenses} />

          {canManageFinances && (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
                title="Manage Expense Categories"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Categories
              </button>

              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Expense Voucher
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'ANALYTICS' ? (
        <ExpenseAnalytics summary={financialSummary} loading={loading} />
      ) : (
        <>
          {/* Outflow KPI Summary Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-rose-800 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300/90">Filtered Outflow Total</p>
              <h2 className="text-2xl md:text-3xl font-black mt-1 tracking-tight">{formatCurrency(totalFilteredOutflow)}</h2>
              <p className="text-xs text-rose-200/80 mt-1">
                Showing {filteredExpenses.length} expense records ({expenses.filter(e => e.status === 'Pending').length} Pending Approval)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-rose-300 block">All-time Society Outflow</span>
                <span className="text-sm font-bold text-white">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
              <div className="w-12 h-12 bg-rose-800/80 rounded-xl flex items-center justify-center text-rose-200 border border-rose-700/50">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Advanced Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Bar */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Voucher #, Title, Vendor, or Category..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <select
                  value={paymentMethodFilter}
                  onChange={e => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Online Transfer">Online Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Mobile Wallet">Mobile Wallet</option>
                </select>
              </div>

              {/* Approval Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Approved">Approved Only</option>
                  <option value="Pending">Pending Approval</option>
                </select>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                Date Filter:
              </div>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-medium"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-medium"
              />

              {(startDate || endDate || categoryFilter !== 'ALL' || paymentMethodFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('ALL');
                    setPaymentMethodFilter('ALL');
                    setStatusFilter('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-xs font-bold text-rose-700 hover:text-rose-800 underline ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Expense Vouchers Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">Voucher #</th>
                    <th className="p-4">Title / Description</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Payee / Vendor</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                        Loading expense records...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                        No expense records found matching search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold text-slate-900 whitespace-nowrap">
                          {exp.voucherNo}
                        </td>
                        <td className="p-4 max-w-xs">
                          <p className="font-bold text-slate-900 truncate">{exp.title}</p>
                          {exp.notes && <p className="text-[10px] text-slate-400 truncate mt-0.5">{exp.notes}</p>}
                        </td>
                        <td className="p-4 text-slate-700 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-4 text-slate-800 font-medium whitespace-nowrap">{exp.paidTo}</td>
                        <td className="p-4 text-slate-600 whitespace-nowrap">{exp.date}</td>
                        <td className="p-4 font-black text-rose-700 text-sm whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="p-4 text-slate-600 whitespace-nowrap">{exp.paymentMethod}</td>
                        <td className="p-4 whitespace-nowrap">
                          {exp.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewVoucher(exp)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View & Print Printable Voucher"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {exp.status === 'Pending' && canManageFinances && (
                              <button
                                onClick={() => handleApproveExpense(exp.id, exp.voucherNo)}
                                className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                                title="Approve Voucher"
                              >
                                Approve
                              </button>
                            )}

                            {canManageFinances && (
                              <>
                                <button
                                  onClick={() => openEditModal(exp)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-[10px] font-bold"
                                  title="Edit Expense Record"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id, exp.voucherNo)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Voucher"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* View Printable Voucher Modal */}
      <ExpenseVoucherModal
        expense={viewVoucher}
        isOpen={!!viewVoucher}
        onClose={() => setViewVoucher(null)}
      />

      {/* Add / Edit Expense Voucher Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingExpense ? 'Edit Expense Voucher' : 'Create Expense Voucher'}
        subtitle="Record society operational outflow, vendor payments, or maintenance"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Expense Title / Item Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Purchased 10 LED Streetlight Bulbs for Street 1 & 2"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Outflow Amount (Rs.) *</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Enter amount"
                value={amount}
                onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-rose-700 focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payee / Recipient Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Al-Rehman Electric Store"
                value={paidTo}
                onChange={e => setPaidTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Date *</label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vendor Invoice / Reference # (Optional)</label>
              <input
                type="text"
                placeholder="e.g. INV-9981 or Cheque # 8820"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Itemization & Audit Notes</label>
            <textarea
              rows={3}
              placeholder="Provide item breakdown, quantity details, or approval reasons..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg font-normal"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs"
            >
              {isSubmitting ? 'Saving Voucher...' : editingExpense ? 'Update Expense' : 'Save Expense Voucher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Manager Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Expense Category Manager"
        subtitle="View default categories and configure society-specific custom categories"
        maxWidth="lg"
      >
        <div className="space-y-5 text-xs">
          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-900 text-xs">Add New Custom Category</h4>
            {catError && <p className="text-[11px] font-bold text-rose-700">{catError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Category Name (e.g. Security CCTV)"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
              <input
                type="text"
                placeholder="Description (Optional)"
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div className="text-right">
              <button
                type="submit"
                className="px-4 py-1.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Add Category
              </button>
            </div>
          </form>

          {/* Categories List */}
          <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg">
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-2">
                    {c.name}
                    {c.isDefault && (
                      <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        System Default
                      </span>
                    )}
                  </p>
                  {c.description && <p className="text-[10px] text-slate-400 mt-0.5">{c.description}</p>}
                </div>
                {!c.isDefault && (
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="text-right pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowCategoryModal(false)}
              className="px-4 py-1.5 font-bold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
