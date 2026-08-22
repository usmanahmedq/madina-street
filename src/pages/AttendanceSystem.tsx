import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AttendanceRecord, Staff, AttendanceStatus } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { ExportButton } from '../components/common/ExportButton';
import {
  CalendarCheck, CheckCircle2, XCircle, Clock, AlertCircle,
  Calendar, CheckSquare, Save, Users, Filter, Search, Grid, Table
} from 'lucide-react';

export const AttendanceSystem: React.FC = () => {
  const { canManageStaff } = useAuth();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [searchTerm, setSearchTerm] = useState('');

  // Local state for editing daily sheet
  const [dailySheet, setDailySheet] = useState<Record<string, { status: AttendanceStatus; checkIn: string; notes: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [staffRes, attRes] = await Promise.all([
        api.getStaff(),
        api.getAttendance(),
      ]);

      if (staffRes.success) setStaffList(staffRes.staff);
      if (attRes.success) setAttendanceRecords(attRes.attendance);
    } catch (e) {
      console.error('Error fetching attendance data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync dailySheet when staffList, selectedDate, or attendanceRecords change
  useEffect(() => {
    const sheet: Record<string, { status: AttendanceStatus; checkIn: string; notes: string }> = {};

    staffList.forEach(s => {
      const existing = attendanceRecords.find(a => a.staffId === s.id && a.date === selectedDate);
      if (existing) {
        sheet[s.id] = {
          status: existing.status,
          checkIn: existing.checkIn || '08:00 AM',
          notes: existing.notes || '',
        };
      } else {
        sheet[s.id] = {
          status: 'Present',
          checkIn: '08:00 AM',
          notes: '',
        };
      }
    });

    setDailySheet(sheet);
  }, [selectedDate, staffList, attendanceRecords]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    const todayStr = new Date().toISOString().split('T')[0];

    if (newDate > todayStr) {
      alert(`Future Attendance Restriction: You cannot mark attendance for future date ${newDate}. Setting date to today (${todayStr}).`);
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(newDate);
    }
  };

  const handleMarkAllPresent = async () => {
    try {
      await api.markAllAttendance(selectedDate, 'Present');
      fetchData();
      alert(`All active staff marked as Present for ${selectedDate}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to mark all present');
    }
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const recordsToSave = Object.entries(dailySheet).map(([staffId, rawData]) => {
        const data = rawData as { status: AttendanceStatus; checkIn: string; notes: string };
        const s = staffList.find(st => st.id === staffId);
        return {
          staffId,
          staffName: s?.name || 'Staff',
          status: data.status,
          checkIn: data.checkIn,
          notes: data.notes,
        };
      });

      await api.saveAttendance(selectedDate, recordsToSave);
      fetchData();
      alert('Attendance register successfully saved!');
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance register');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter Active Staff
  const activeStaff = staffList.filter(s =>
    s.status === 'Active' &&
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (s.empNo && s.empNo.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Calculate Month Days for Monthly Matrix
  const getDaysInMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month, 0);
    const numDays = date.getDate();
    const daysArr: string[] = [];
    for (let i = 1; i <= numDays; i++) {
      daysArr.push(`${yearMonth}-${String(i).padStart(2, '0')}`);
    }
    return daysArr;
  };

  const monthDays = getDaysInMonth(selectedMonth);

  // Overall Attendance Summary Stats for Selected Month
  const monthlyLogs = attendanceRecords.filter(a => a.date.startsWith(selectedMonth));
  const totalPresent = monthlyLogs.filter(a => a.status === 'Present').length;
  const totalAbsent = monthlyLogs.filter(a => a.status === 'Absent').length;
  const totalLeave = monthlyLogs.filter(a => a.status === 'Leave').length;
  const totalHalfDay = monthlyLogs.filter(a => a.status === 'Half Day').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Attendance System</h1>
          <p className="text-xs text-slate-500 mt-0.5">Daily check-in register & monthly attendance calendar for mohalla staff</p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton filename={`Attendance_Export_${selectedDate}`} data={attendanceRecords} />

          {canManageStaff && (
            <>
              <button
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
              >
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                Mark All Present
              </button>

              <button
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Register'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'daily' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Daily Marking Sheet
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'monthly' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Monthly Attendance Matrix
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium w-48"
            />
          </div>

          {activeTab === 'daily' ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-slate-50"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-slate-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase">Present Days Logged</p>
            <h3 className="text-xl font-black text-emerald-900 mt-0.5">{totalPresent} Days</h3>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>

        <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-rose-800 uppercase">Absences Recorded</p>
            <h3 className="text-xl font-black text-rose-900 mt-0.5">{totalAbsent} Days</h3>
          </div>
          <XCircle className="w-6 h-6 text-rose-600" />
        </div>

        <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-800 uppercase">Approved Leaves</p>
            <h3 className="text-xl font-black text-amber-900 mt-0.5">{totalLeave} Days</h3>
          </div>
          <Calendar className="w-6 h-6 text-amber-600" />
        </div>

        <div className="bg-blue-50 border border-blue-200/80 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-800 uppercase">Half-Day Shifts</p>
            <h3 className="text-xl font-black text-blue-900 mt-0.5">{totalHalfDay} Days</h3>
          </div>
          <Clock className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Tab 1: Daily Marking Sheet */}
      {activeTab === 'daily' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-4">Emp ID & Name</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Check-In Time</th>
                  <th className="p-4">Attendance Status</th>
                  <th className="p-4">Notes / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {activeStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 font-semibold">
                      No active staff found.
                    </td>
                  </tr>
                ) : (
                  activeStaff.map(s => {
                    const current = dailySheet[s.id] || { status: 'Present', checkIn: '08:00 AM', notes: '' };
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          <p className="font-mono text-[10px] text-teal-800 font-bold">{s.empNo || `EMP-${s.id}`}</p>
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-[10px] text-slate-400">{s.phone}</p>
                        </td>

                        <td className="p-4 text-teal-800 font-semibold">{s.role}</td>

                        <td className="p-4">
                          <input
                            type="text"
                            value={current.checkIn}
                            onChange={e =>
                              setDailySheet(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], checkIn: e.target.value },
                              }))
                            }
                            className="w-24 px-2 py-1 border border-slate-300 rounded font-semibold text-xs"
                          />
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {(['Present', 'Absent', 'Leave', 'Half Day'] as AttendanceStatus[]).map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setDailySheet(prev => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], status: st },
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                  current.status === st
                                    ? st === 'Present'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : st === 'Absent'
                                      ? 'bg-rose-600 text-white border-rose-600'
                                      : st === 'Leave'
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="p-4">
                          <input
                            type="text"
                            placeholder="Reason for leave / late check-in..."
                            value={current.notes}
                            onChange={e =>
                              setDailySheet(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], notes: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Attendance Matrix */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <th className="p-3 sticky left-0 bg-slate-100 z-10 w-44">Staff Member</th>
                  {monthDays.map(d => {
                    const dayNum = d.split('-')[2];
                    return (
                      <th key={d} className="p-1.5 text-center w-8 text-[10px] border-l border-slate-200">
                        {dayNum}
                      </th>
                    );
                  })}
                  <th className="p-2 text-center bg-slate-200 text-slate-800 font-black">Present %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {activeStaff.map(s => {
                  let pCount = 0;
                  let totalLogged = 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900 sticky left-0 bg-white shadow-xs border-r border-slate-200">
                        <p className="truncate max-w-[140px]">{s.name}</p>
                        <p className="text-[9px] text-teal-800 font-normal">{s.role}</p>
                      </td>

                      {monthDays.map(d => {
                        const rec = attendanceRecords.find(a => a.staffId === s.id && a.date === d);
                        if (rec) {
                          totalLogged++;
                          if (rec.status === 'Present' || rec.status === 'Half Day') pCount++;
                        }

                        let badgeColor = 'bg-slate-100 text-slate-400';
                        let symbol = '-';

                        if (rec) {
                          if (rec.status === 'Present') {
                            badgeColor = 'bg-emerald-500 text-white font-bold';
                            symbol = 'P';
                          } else if (rec.status === 'Absent') {
                            badgeColor = 'bg-rose-500 text-white font-bold';
                            symbol = 'A';
                          } else if (rec.status === 'Leave') {
                            badgeColor = 'bg-amber-500 text-white font-bold';
                            symbol = 'L';
                          } else if (rec.status === 'Half Day') {
                            badgeColor = 'bg-blue-500 text-white font-bold';
                            symbol = 'H';
                          }
                        }

                        return (
                          <td key={d} className="p-1 text-center border-l border-slate-100">
                            <span className={`inline-block w-6 h-6 leading-6 rounded text-[10px] text-center ${badgeColor}`}>
                              {symbol}
                            </span>
                          </td>
                        );
                      })}

                      <td className="p-2 text-center font-black text-slate-900 bg-slate-50">
                        {totalLogged > 0 ? `${Math.round((pCount / totalLogged) * 100)}%` : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
