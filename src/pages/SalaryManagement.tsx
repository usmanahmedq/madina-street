import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SalaryPayment, Staff } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { SalarySlipModal } from '../components/payroll/SalarySlipModal';
import { ExportButton } from '../components/common/ExportButton';
import {
  CreditCard, Plus, Search, Calendar, FileText, CheckCircle2,
  AlertCircle, Printer, Filter, ShieldCheck, DollarSign, Award, ChevronLeft, ChevronRight
} from 'lucide-react';

export const SalaryManagement: React.FC = () => {
  const { formatCurrency, settings } = useSettings();
  const { canManageFinance, user } = useAuth();

  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('August 2026');

  // Modals
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<SalaryPayment | null>(null);

  // Disbursal Form state
  const [staffId, setStaffId] = useState('');
  const [disburseMonth, setDisburseMonth] = useState('August 2026');
  const [baseSalary, setBaseSalary] = useState<number>(30000);
  const [allowance, setAllowance] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [salRes, staffRes] = await Promise.all([
        api.getSalaries(),
        api.getStaff(),
      ]);

      if (salRes.success) setSalaries(salRes.salaries);
      if (staffRes.success) {
        setStaffList(staffRes.staff);
        if (staffRes.staff.length > 0 && !staffId) {
          const activeFirst = staffRes.staff.find(s => s.status === 'Active') || staffRes.staff[0];
          setStaffId(activeFirst.id);
          setBaseSalary(activeFirst.monthlySalary);
        }
      }
    } catch (e) {
      console.error('Error fetching salary data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStaffSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setStaffId(sId);
    const selected = staffList.find(s => s.id === sId);
    if (selected) {
      setBaseSalary(selected.monthlySalary);
    }
  };

  const handleDisburseSalary = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedStaff = staffList.find(s => s.id === staffId);
    if (!selectedStaff) {
      alert('Please select a valid staff member.');
      return;
    }

    if (selectedStaff.status !== 'Active') {
      alert(`Inactive Staff Restriction: Cannot disburse salary to ${selectedStaff.name} because employment status is '${selectedStaff.status}'. Only Active staff members are eligible for payroll.`);
      return;
    }

    const netPaid = baseSalary + allowance + bonus - deductions;
    if (netPaid <= 0) {
      alert('Net salary payment must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.disburseSalary({
        staffId,
        month: disburseMonth,
        baseSalary,
        allowance,
        bonus,
        deductions,
        paymentMethod,
        notes,
      });

      if (res.success) {
        setShowDisburseModal(false);
        fetchData();
        alert(`Salary successfully disbursed to ${selectedStaff.name}! Salary slip #${res.salary.slipNo} generated.`);
        setSelectedSlip(res.salary); // Auto-open slip preview
      }
    } catch (err: any) {
      alert(err.message || 'Failed to disburse salary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStaffObj = staffList.find(s => s.id === staffId);
  const calculatedNetPaid = baseSalary + allowance + bonus - deductions;

  // Filtered Salaries
  const filteredSalaries = salaries.filter(s => {
    const matchesSearch =
      s.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slipNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.staffRole.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMonth = selectedMonth === 'ALL' || s.month.toLowerCase() === selectedMonth.toLowerCase();

    return matchesSearch && matchesMonth;
  });

  const totalDisbursedThisMonth = filteredSalaries.reduce((sum, s) => sum + s.netPaid, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll & Salary Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Disburse employee salaries, auto-generate official salary slips, and synchronize ledger</p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton filename="Madina_Street_Payroll_History" data={filteredSalaries} />

          {canManageFinance && (
            <button
              onClick={() => setShowDisburseModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Disburse Salary & Issue Slip
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Payroll Disbursed</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{formatCurrency(totalDisbursedThisMonth)}</h3>
            <p className="text-xs text-teal-800 font-semibold mt-0.5">{filteredSalaries.length} Salary Payments Issued</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center border border-teal-200">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Active Payroll Roster</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{staffList.filter(s => s.status === 'Active').length} Active Staff</h3>
            <p className="text-xs text-emerald-600 font-bold mt-0.5">100% Verified Disbursal</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex items-center justify-center border border-emerald-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Avg Net Salary</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {formatCurrency(filteredSalaries.length > 0 ? Math.round(totalDisbursedThisMonth / filteredSalaries.length) : 0)}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Per Employee Per Month</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-bold flex items-center justify-center border border-amber-200">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Slip #, Staff Name, Role..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Salary Month:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-slate-50"
          >
            <option value="ALL">All Months</option>
            <option value="August 2026">August 2026</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
          </select>
        </div>
      </div>

      {/* Salary History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Slip #</th>
                <th className="p-4">Employee Details</th>
                <th className="p-4">Salary Month</th>
                <th className="p-4">Base Salary</th>
                <th className="p-4">Allowances/Bonus</th>
                <th className="p-4">Deductions</th>
                <th className="p-4">Net Paid</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                    No salary disbursal records found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-teal-800">
                      {s.slipNo}
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-slate-900">{s.staffName}</p>
                      <p className="text-[10px] text-teal-800 font-semibold">{s.staffRole}</p>
                    </td>

                    <td className="p-4 font-bold text-slate-800">
                      {s.month}
                    </td>

                    <td className="p-4 font-semibold text-slate-700">
                      {formatCurrency(s.baseSalary)}
                    </td>

                    <td className="p-4 text-emerald-700 font-bold">
                      +{formatCurrency((s.allowance || 0) + (s.bonus || 0))}
                    </td>

                    <td className="p-4 text-rose-600 font-bold">
                      -{formatCurrency(s.deductions || 0)}
                    </td>

                    <td className="p-4 font-black text-slate-900 text-sm">
                      {formatCurrency(s.netPaid)}
                    </td>

                    <td className="p-4 text-slate-500">
                      {s.paymentDate}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedSlip(s)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Salary Modal */}
      {showDisburseModal && (
        <Modal
          isOpen={showDisburseModal}
          onClose={() => setShowDisburseModal(false)}
          title="Disburse Staff Salary & Generate Slip"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleDisburseSalary} className="space-y-4 text-xs">
            {selectedStaffObj && selectedStaffObj.status !== 'Active' && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Restricted: Selected staff member is '{selectedStaffObj.status}'. Only Active staff can receive salary.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Select Employee *</label>
                <select
                  value={staffId}
                  onChange={handleStaffSelect}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 mt-1"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) - {s.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Target Salary Month *</label>
                <select
                  value={disburseMonth}
                  onChange={e => setDisburseMonth(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 mt-1"
                >
                  <option value="August 2026">August 2026</option>
                  <option value="July 2026">July 2026</option>
                  <option value="June 2026">June 2026</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Base Salary (PKR) *</label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={e => setBaseSalary(Number(e.target.value))}
                  required
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Special Allowance (PKR)</label>
                <input
                  type="number"
                  value={allowance}
                  onChange={e => setAllowance(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-emerald-700 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Performance Bonus (PKR)</label>
                <input
                  type="number"
                  value={bonus}
                  onChange={e => setBonus(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-emerald-700 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Leave / Absence Deductions (PKR)</label>
                <input
                  type="number"
                  value={deductions}
                  onChange={e => setDeductions(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-rose-600 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 mt-1"
                >
                  <option value="Cash">Cash Handover</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Authorized Disbursed By</label>
                <input
                  type="text"
                  value={user?.name || settings.treasurerName}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-500 bg-slate-50 mt-1"
                />
              </div>
            </div>

            {/* Calculated Net Salary Box */}
            <div className="bg-teal-50 border-2 border-teal-600 p-4 rounded-xl flex items-center justify-between text-teal-900">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider">Calculated Net Payable Amount</p>
                <h3 className="text-2xl font-black mt-0.5">{formatCurrency(calculatedNetPaid)}</h3>
              </div>
              <div className="text-right text-[11px] font-semibold text-teal-800">
                <p>Base ({baseSalary}) + Allow ({allowance}) + Bonus ({bonus}) - Ded ({deductions})</p>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700">Remarks / Slip Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mt-1"
                placeholder="Payment voucher reference, Eid bonus notes, etc."
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisburseModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (selectedStaffObj && selectedStaffObj.status !== 'Active')}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Disburse & Issue Slip'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Salary Slip Modal */}
      {selectedSlip && (
        <SalarySlipModal
          salary={selectedSlip}
          onClose={() => setSelectedSlip(null)}
        />
      )}
    </div>
  );
};
