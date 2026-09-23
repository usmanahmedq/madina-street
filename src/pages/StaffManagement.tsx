import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Staff, StaffDesignation } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ExportButton } from '../components/common/ExportButton';
import { DesignationManagerModal } from '../components/staff/DesignationManagerModal';
import { EmployeeProfileModal } from '../components/staff/EmployeeProfileModal';
import {
  Users, Search, Plus, Phone, Calendar, ShieldCheck,
  Edit, MapPin, User, Eye, Trash2, Award, Filter, ArrowUpDown, ChevronLeft, ChevronRight, Printer
} from 'lucide-react';

export const StaffManagement: React.FC = () => {
  const { formatCurrency } = useSettings();
  const { canManageStaff } = useAuth();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [designations, setDesignations] = useState<StaffDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Sorting
  const [sortField, setSortField] = useState<'empNo' | 'name' | 'monthlySalary' | 'joiningDate'>('empNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [viewingProfileStaffId, setViewingProfileStaffId] = useState<string | null>(null);

  // Form Fields
  const [empNo, setEmpNo] = useState('');
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [role, setRole] = useState('Security Guard');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [monthlySalary, setMonthlySalary] = useState<number>(30000);
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'On Leave' | 'Resigned'>('Active');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      const [staffRes, desRes] = await Promise.all([
        api.getStaff(),
        api.getStaffDesignations(),
      ]);

      if (staffRes.success) setStaffList(staffRes.staff);
      if (desRes.success && desRes.designations) setDesignations(desRes.designations);
      setLoadError('');
    } catch (e: any) {
      setLoadError(e.message || 'Staff data could not be loaded. Please retry.');
      console.error('Error fetching staff management data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingStaff(null);
    const nextNumber = Math.max(0, ...staffList.map(s => /^EMP-\d+$/.test(s.empNo) ? Number(s.empNo.slice(4)) : 0)) + 1;
    setEmpNo(`EMP-${String(nextNumber).padStart(3, '0')}`);
    setName('');
    setFatherName('');
    setRole(designations.length > 0 ? designations[0].title : 'Security Guard');
    setPhone('');
    setCnic('');
    setEmergencyContact('');
    setAddress('');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setMonthlySalary(30000);
    setStatus('Active');
    setNotes('');
    setShowAddEditModal(true);
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setEmpNo(staff.empNo || `EMP-${staff.id}`);
    setName(staff.name);
    setFatherName(staff.fatherName || '');
    setRole(staff.role);
    setPhone(staff.phone);
    setCnic(staff.cnic);
    setEmergencyContact(staff.emergencyContact || '');
    setAddress(staff.address);
    setJoiningDate(staff.joiningDate);
    setMonthlySalary(staff.monthlySalary);
    setStatus(staff.status);
    setNotes(staff.notes || '');
    setShowAddEditModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      empNo,
      name: name.trim(),
      fatherName: fatherName.trim(),
      role,
      phone: phone.trim(),
      cnic: cnic.trim(),
      emergencyContact: emergencyContact.trim(),
      address: address.trim(),
      joiningDate,
      monthlySalary: Number(monthlySalary),
      status,
      notes: notes.trim(),
    };

    try {
      if (editingStaff) {
        const result = await api.updateStaff(editingStaff.id, payload);
        setStaffList(list => list.map(s => s.id === result.staff.id ? result.staff : s));
      } else {
        const result = await api.createStaff(payload);
        setStaffList(list => [...list.filter(s => s.id !== result.staff.id), result.staff]);
      }
      setShowAddEditModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save staff record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!confirm(`Are you sure you want to delete staff member '${staff.name}' (${staff.empNo || staff.id})?`)) return;

    try {
      const res = await api.deleteStaff(staff.id);
      if (res.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff member');
    }
  };

  // Filtered & Sorted Data
  const filteredStaff = staffList.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(searchLower) ||
      (s.empNo && s.empNo.toLowerCase().includes(searchLower)) ||
      (s.cnic && s.cnic.includes(searchTerm)) ||
      s.phone.includes(searchTerm) ||
      s.role.toLowerCase().includes(searchLower);

    const matchesDesignation = selectedDesignation === 'ALL' || s.role === selectedDesignation;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesDesignation && matchesStatus;
  });

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    let aVal: any = a[sortField] || '';
    let bVal: any = b[sortField] || '';

    if (sortField === 'monthlySalary') {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Math
  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage) || 1;
  const paginatedStaff = sortedStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSort = (field: 'empNo' | 'name' | 'monthlySalary' | 'joiningDate') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const activeCount = staffList.filter(s => s.status === 'Active').length;
  const inactiveCount = staffList.filter(s => s.status !== 'Active').length;
  const totalPayrollBudget = staffList.reduce((sum, s) => sum + (s.status === 'Active' ? s.monthlySalary : 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Enterprise Staff Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage security guards, sanitation crew, electricians, and office staff</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ExportButton filename="Madina_Street_Staff_Directory" data={filteredStaff} />

          {canManageStaff && (
            <>
              <button
                onClick={() => setShowDesignationModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Award className="w-4 h-4 text-teal-700" />
                Manage Designations
              </button>

              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Register Staff Member
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Registered Staff</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{staffList.length} Members</h3>
            <p className="text-xs text-emerald-600 font-bold mt-0.5">{activeCount} Active • {inactiveCount} Inactive</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center border border-teal-200">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Monthly Payroll Commitment</p>
            <h3 className="text-xl font-black text-teal-800 mt-0.5">{formatCurrency(totalPayrollBudget)}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Active Staff Base Salaries</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex items-center justify-center border border-emerald-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Staff Designations</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{designations.length} Roles</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Security, Sanitation, Electrical & Admin</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-bold flex items-center justify-center border border-amber-200">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {loadError && <div role="alert" className="text-sm text-red-700">
        {loadError} <button type="button" onClick={fetchData} className="underline font-semibold">Retry</button>
      </div>}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Employee ID, Name, CNIC, Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDesignation}
              onChange={e => setSelectedDesignation(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50"
            >
              <option value="ALL">All Designations</option>
              {designations.map(d => (
                <option key={d.id} value={d.title}>{d.title}</option>
              ))}
            </select>
          </div>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
            <option value="Resigned">Resigned</option>
          </select>
        </div>
      </div>

      {/* Staff Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('empNo')}>
                  <div className="flex items-center gap-1">
                    Employee ID <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4">Staff Member</th>
                <th className="p-4">Designation</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('monthlySalary')}>
                  <div className="flex items-center gap-1">
                    Monthly Salary <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('joiningDate')}>
                  <div className="flex items-center gap-1">
                    Joining Date <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                    No staff records match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedStaff.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-teal-800">
                      {s.empNo || `EMP-${s.id}`}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200 shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{s.name}</p>
                          {s.fatherName && <p className="text-[10px] text-slate-400">S/O {s.fatherName}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-slate-800">{s.role}</span>
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-slate-800">{s.phone}</p>
                      <p className="text-[10px] text-slate-400">CNIC: {s.cnic}</p>
                    </td>

                    <td className="p-4 font-black text-slate-900">
                      {formatCurrency(s.monthlySalary)}
                    </td>

                    <td className="p-4 text-slate-600">
                      {s.joiningDate}
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        s.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        s.status === 'On Leave' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        s.status === 'Inactive' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                        'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingProfileStaffId(s.id)}
                          className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Employee Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canManageStaff && (
                          <>
                            <button
                              onClick={() => openEditModal(s)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Staff Member"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Record"
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

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <p>Showing <span className="font-bold text-slate-800">{paginatedStaff.length}</span> of <span className="font-bold text-slate-800">{filteredStaff.length}</span> staff members</p>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {showAddEditModal && (
        <Modal
          isOpen={showAddEditModal}
          onClose={() => setShowAddEditModal(false)}
          title={editingStaff ? `Edit Staff Member - ${editingStaff.name}` : 'Register New Staff Member'}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
            {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Employee ID (Auto-Generated)</label>
                <input
                  type="text"
                  value={empNo}
                  onChange={e => setEmpNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-teal-800 bg-slate-50 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Subedar (R) Muhammad Aslam"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Father's Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Chaudhry Ghulam Muhammad"
                  value={fatherName}
                  onChange={e => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Designation / Role *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                >
                  {designations.map(d => (
                    <option key={d.id} value={d.title}>{d.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">CNIC Number *</label>
                <input
                  type="text"
                  placeholder="35201-1234567-1"
                  value={cnic}
                  onChange={e => setCnic(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Mobile Phone *</label>
                <input
                  type="text"
                  placeholder="0300-1112233"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Emergency Contact (Optional)</label>
                <input
                  type="text"
                  placeholder="0300-4445566 (Son)"
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Monthly Fixed Salary (PKR) *</label>
                <input
                  type="number"
                  value={monthlySalary}
                  onChange={e => setMonthlySalary(Number(e.target.value))}
                  required
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Joining Date *</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={e => setJoiningDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Employment Status *</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold mt-1"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Resigned">Resigned</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700">Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold mt-1"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Remarks / Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mt-1"
                placeholder="Duty shifts, special equipment assigned, or notes..."
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !!loadError || designations.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm"
              >
                {saving ? 'Saving...' : editingStaff ? 'Update Staff Record' : 'Register Staff'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Custom Designation Modal */}
      <DesignationManagerModal
        isOpen={showDesignationModal}
        onClose={() => setShowDesignationModal(false)}
        onDesignationChanged={fetchData}
      />

      {/* Employee Profile View Modal */}
      {viewingProfileStaffId && (
        <EmployeeProfileModal
          staffId={viewingProfileStaffId}
          onClose={() => setViewingProfileStaffId(null)}
        />
      )}
    </div>
  );
};
