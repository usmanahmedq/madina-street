import React, { useState, useEffect } from 'react';
import { EmployeeProfileData } from '../../types/index';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { useSettings } from '../../context/SettingsContext';
import {
  User, Phone, Calendar, CreditCard, ShieldCheck, MapPin,
  Clock, Award, FileText, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';

interface EmployeeProfileModalProps {
  staffId: string | null;
  onClose: () => void;
  onEditStaff?: (staff: any) => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({ staffId, onClose, onEditStaff }) => {
  const { formatCurrency } = useSettings();
  const [profileData, setProfileData] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'salary'>('overview');

  useEffect(() => {
    if (!staffId) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await api.getEmployeeProfile(staffId);
        if (res.success && res.profile) {
          setProfileData(res.profile);
        }
      } catch (err) {
        console.error('Error fetching employee profile', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [staffId]);

  if (!staffId) return null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Employee Profile & Records" maxWidth="max-w-3xl">
      {loading || !profileData ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading complete employee profile...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Banner Card */}
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-800 text-teal-100 font-black text-2xl flex items-center justify-center border-2 border-teal-500/30 shadow-inner">
                {profileData.staff.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-teal-900/80 text-teal-300 text-[10px] font-bold border border-teal-700/50">
                    {profileData.staff.empNo || 'EMP'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    profileData.staff.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {profileData.staff.status}
                  </span>
                </div>
                <h2 className="text-xl font-black mt-1 tracking-tight">{profileData.staff.name}</h2>
                <p className="text-xs text-teal-300 font-semibold">{profileData.staff.role}</p>
              </div>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-xs p-3 rounded-xl border border-slate-700/80 text-right">
              <p className="text-[10px] font-bold uppercase text-slate-400">Monthly Salary</p>
              <p className="text-lg font-black text-teal-400">{formatCurrency(profileData.staff.monthlySalary)}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Joined: {profileData.staff.joiningDate}</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'overview' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Personal Information
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'attendance' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Attendance Logs ({profileData.attendanceStats.attendancePercentage}% Present)
            </button>
            <button
              onClick={() => setActiveTab('salary')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'salary' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Salary Disbursal History ({profileData.salaryHistory.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-teal-700" /> Identity & Contact Info
                  </h3>
                  <div>
                    <p className="text-slate-400 text-[10px]">Father's Name</p>
                    <p className="font-semibold text-slate-800">{profileData.staff.fatherName || 'Not Provided'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">CNIC Number</p>
                    <p className="font-mono font-bold text-slate-900">{profileData.staff.cnic}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Mobile Number</p>
                    <p className="font-semibold text-slate-800">{profileData.staff.phone}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Emergency Contact</p>
                    <p className="font-semibold text-slate-800">{profileData.staff.emergencyContact || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-700" /> Employment Details
                  </h3>
                  <div>
                    <p className="text-slate-400 text-[10px]">Employee ID</p>
                    <p className="font-mono font-bold text-teal-800">{profileData.staff.empNo || profileData.staff.id}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Designation / Role</p>
                    <p className="font-bold text-slate-900">{profileData.staff.role}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Residential Address</p>
                    <p className="font-semibold text-slate-800">{profileData.staff.address}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Joining Date</p>
                    <p className="font-semibold text-slate-800">{profileData.staff.joiningDate}</p>
                  </div>
                </div>
              </div>

              {profileData.staff.notes && (
                <div className="bg-teal-50/60 border border-teal-200 p-4 rounded-xl text-xs text-teal-900 space-y-1">
                  <p className="font-bold">Administrative Notes:</p>
                  <p>{profileData.staff.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Stats KPI grid */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Present</p>
                  <p className="text-lg font-black text-emerald-900">{profileData.attendanceStats.presentDays}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-800 uppercase">Absent</p>
                  <p className="text-lg font-black text-rose-900">{profileData.attendanceStats.absentDays}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Leave</p>
                  <p className="text-lg font-black text-amber-900">{profileData.attendanceStats.leaveDays}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Half Day</p>
                  <p className="text-lg font-black text-blue-900">{profileData.attendanceStats.halfDays}</p>
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Check-In</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {profileData.attendanceHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">No attendance logs found.</td>
                      </tr>
                    ) : (
                      profileData.attendanceHistory.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-800">{a.date}</td>
                          <td className="p-3 text-slate-600">{a.checkIn || '08:00 AM'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                              a.status === 'Absent' ? 'bg-rose-100 text-rose-800' :
                              a.status === 'Leave' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 italic">{a.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase">Total Lifetime Salary Paid</p>
                  <p className="text-xl font-black text-teal-400 mt-0.5">{formatCurrency(profileData.totalSalariesPaid)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-300 font-semibold">{profileData.salaryHistory.length} Salary Slips Issued</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Slip #</th>
                      <th className="p-3">Month</th>
                      <th className="p-3">Base</th>
                      <th className="p-3">Deduction</th>
                      <th className="p-3">Net Paid</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {profileData.salaryHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">No salary disbursal records found.</td>
                      </tr>
                    ) : (
                      profileData.salaryHistory.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-teal-800">{s.slipNo}</td>
                          <td className="p-3 font-semibold text-slate-900">{s.month}</td>
                          <td className="p-3 text-slate-600">{formatCurrency(s.baseSalary)}</td>
                          <td className="p-3 text-rose-600">-{formatCurrency(s.deductions)}</td>
                          <td className="p-3 font-black text-slate-900">{formatCurrency(s.netPaid)}</td>
                          <td className="p-3 text-slate-500">{s.paymentDate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
