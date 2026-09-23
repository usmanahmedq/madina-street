import { APP_NAME } from '../constants/branding';
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { House } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ExportButton } from '../components/common/ExportButton';
import { 
  Home, Plus, Search, Filter, Edit2, Trash2, MessageSquare, 
  Phone, User, Shield, AlertCircle, CheckCircle, RefreshCw,
  ExternalLink, Building, Upload, Download
} from 'lucide-react';

const REGISTRATION_MONTHS = [
  'January 2026', 'February 2026', 'March 2026', 'April 2026',
  'May 2026', 'June 2026', 'July 2026', 'August 2026',
  'September 2026', 'October 2026', 'November 2026', 'December 2026',
];

const getPendingMonthsBeforeCurrent = (registrationMonth: string) => {
  const registrationIndex = REGISTRATION_MONTHS.indexOf(registrationMonth);
  const currentIndex = new Date().getFullYear() === 2026 ? new Date().getMonth() : 0;
  return registrationIndex >= 0 && registrationIndex < currentIndex
    ? currentIndex - registrationIndex
    : 0;
};

const parseHouseSequence = (houseNo: string) => {
  const match = houseNo.match(/(?:MS-)?([A-Za-z]+)[-_ ]?(\d+)/i);
  if (!match) {
    return { sectorIndex: 999, number: Number.MAX_SAFE_INTEGER, fallback: houseNo.toLowerCase() };
  }

  const sector = match[1].toUpperCase();
  const number = Number.parseInt(match[2], 10) || 0;

  return {
    sectorIndex: sector.charCodeAt(0) - 64 || 999,
    number,
    fallback: houseNo.toLowerCase(),
  };
};

const compareHouseNumbers = (a: string, b: string) => {
  const left = parseHouseSequence(a);
  const right = parseHouseSequence(b);

  if (left.sectorIndex !== right.sectorIndex) {
    return left.sectorIndex - right.sectorIndex;
  }

  if (left.number !== right.number) {
    return left.number - right.number;
  }

  return left.fallback.localeCompare(right.fallback);
};

export const HouseManagement: React.FC = () => {
  const { settings, formatCurrency } = useSettings();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const importInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);

  // Form State
  const [houseNo, setHouseNo] = useState('');
  const [headName, setHeadName] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [sector, setSector] = useState('Sector A');
  const [street, setStreet] = useState('');
  const [category, setCategory] = useState('Residential 100 Sq Yd');
  const [monthlyFee, setMonthlyFee] = useState<number>(1000);
  const [currentDues, setCurrentDues] = useState<number>(0);
  const [registrationMonth, setRegistrationMonth] = useState('September 2026');
  const [status, setStatus] = useState<'Active' | 'Closed' | 'Defaulter' | 'Suspended'>('Active');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getHouses();
      if (res.success) {
        const sorted = [...(res.houses || [])].sort((a, b) => compareHouseNumbers(a.houseNo, b.houseNo));
        setHouses(sorted);
      }
    } catch (err) {
      console.error('Failed to load houses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const downloadImportTemplate = () => {
    const headers = ['House Number', 'Resident Head Name', 'Mobile / WhatsApp Number', 'Monthly Tariff Fee', 'Registration Month', 'Account Status'];
    const example = ['B-02', 'Muhammad Farooq', '03001234567', '4000', 'August 2026', 'Active'];
    const csv = [headers, example].map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = 'House_Import_Template.csv';
    link.click();
  };

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === ',' && !quoted) {
        values.push(value.trim());
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
  };

  const handleImportHouses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const rows = (await file.text()).split(/\r?\n/).filter(row => row.trim());
      if (rows.length < 2) throw new Error('CSV file must include a header and at least one house row.');
      const headers = parseCsvLine(rows[0]).map(header => header.toLowerCase());
      const getValue = (values: string[], ...names: string[]) => {
        const index = names.map(name => headers.indexOf(name.toLowerCase())).find(index => index >= 0);
        return index === undefined ? '' : values[index] || '';
      };

      const importedHouses = rows.slice(1).map(row => {
        const values = parseCsvLine(row);
        return {
          houseNo: getValue(values, 'house number', 'house no'),
          headName: getValue(values, 'resident head name', 'head name'),
          phone: getValue(values, 'mobile / whatsapp number', 'phone', 'mobile'),
          monthlyFee: Number(getValue(values, 'monthly tariff fee', 'monthly fee')),
          registrationMonth: getValue(values, 'registration month'),
          status: getValue(values, 'account status', 'status') || 'Active',
        };
      });

      const result = await api.importHouses(importedHouses);
      await fetchData();
      const errorMessage = result.errors?.length ? `\n\nSkipped rows:\n${result.errors.join('\n')}` : '';
      alert(`${result.addedCount} house record(s) imported successfully.${errorMessage}`);
    } catch (error: any) {
      alert(error.message || 'Failed to import house CSV file.');
    }
  };

  const openAddModal = () => {
    setEditingHouse(null);
    setHouseNo('');
    setHeadName('');
    setPhone('');
    setCnic('');
    setSector('Sector A');
    setStreet('Street 1');
    setCategory('Residential 100 Sq Yd');
    setMonthlyFee(1000);
    setCurrentDues(0);
    setRegistrationMonth('September 2026');
    setStatus('Active');
    setShowModal(true);
  };

  const openEditModal = (h: House) => {
    setEditingHouse(h);
    setHouseNo(h.houseNo);
    setHeadName(h.headName);
    setPhone(h.phone || '');
    setCnic(h.cnic || '');
    setSector(h.sector || 'Sector A');
    setStreet(h.street || '');
    setCategory(h.category || 'Residential');
    setMonthlyFee(h.monthlyFee || 0);
    setCurrentDues(h.currentDues || 0);
    setRegistrationMonth(h.registrationMonth || 'September 2026');
    setStatus(h.status || 'Active');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        houseNo,
        headName,
        phone,
        cnic,
        sector,
        street,
        category,
        monthlyFee: Number(monthlyFee),
        currentDues: Number(monthlyFee) * getPendingMonthsBeforeCurrent(registrationMonth),
        currentDuesOverride: false,
        registrationMonth,
        status,
      };

      if (editingHouse) {
        await api.updateHouse(editingHouse.id, payload);
      } else {
        await api.createHouse(payload);
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save house record');
    } finally {
      setSubmitting(false);
    }
  };

  // WhatsApp Message Sender Function
  const handleSendWhatsApp = (house: House) => {
    if (!house.phone) {
      alert('Is resident ka Phone/WhatsApp number add nahi hai!');
      return;
    }

    // Number format clean karein (e.g., 03001234567 -> 923001234567)
    let cleanPhone = house.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    }

    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const mohallaName = APP_NAME;

    // WhatsApp Reminder Template Message
    const message = `Assalam-o-Alaikum *${house.headName}*,\n\n` +
      `Yeh *${mohallaName}* Committee ki taraf se monthly fee reminder hai.\n\n` +
      `📌 *House No:* ${house.houseNo}\n` +
      `📅 *Target Month:* ${currentMonth}\n` +
      `💰 *Pending Dues Amount:* Rs. ${house.currentDues.toLocaleString()}\n` +
      `💵 *Monthly Tariff:* Rs. ${house.monthlyFee.toLocaleString()}\n\n` +
      `Baraye meharbani apni monthly collection fee jald se jald office ya collector ko jama karwayein.\n` +
      `Shukriya!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteHouse = async (house: House) => {
    const confirmed = window.confirm(
      `Delete house ${house.houseNo} (${house.headName})? This will remove the house record.`
    );
    if (!confirmed) return;

    try {
      await api.deleteHouse(house.id);
      await fetchData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete house record.');
    }
  };

  const sortedHouses = [...houses].sort((a, b) => compareHouseNumbers(a.houseNo, b.houseNo));
  const filteredHouses = sortedHouses.filter(h => {
    const matchSearch = h.houseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.headName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.phone && h.phone.includes(searchTerm));
    const matchSector = sectorFilter === 'ALL' || h.sector === sectorFilter;
    const matchStatus = statusFilter === 'ALL' || h.status === statusFilter;
    return matchSearch && matchSector && matchStatus;
  });

  const sectorsList = Array.from(new Set(houses.map(h => h.sector).filter(Boolean)));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">House Directory & Residents Management</h1>
            <Badge variant="teal" size="sm">{houses.length} Properties</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage house records, resident contact information, monthly tariffs, pending dues, and send WhatsApp reminders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={handleImportHouses} className="hidden" />
          <button
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={downloadImportTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          <ExportButton
            filename="House_Directory"
            label="Export CSV"
            data={houses.map(h => ({
              'House Number': h.houseNo,
              'Resident Head Name': h.headName,
              'Mobile / WhatsApp Number': h.phone,
              'Monthly Tariff Fee': h.monthlyFee,
              'Registration Month': h.registrationMonth || '',
              'Account Status': h.status,
              'Current Pending Dues': h.currentDues,
            }))}
          />
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New House
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search house #, resident head, phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Sectors</option>
            {sectorsList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Defaulter">Defaulter</option>
            <option value="Closed">Closed</option>
            <option value="Suspended">Suspended</option>
          </select>

          <button
            onClick={fetchData}
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* House Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3.5">House No</th>
                <th className="p-3.5">Resident Head</th>
                <th className="p-3.5">Contact / WhatsApp</th>
                <th className="p-3.5">Sector & Street</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Monthly Fee</th>
                <th className="p-3.5">Pending Dues</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 font-semibold">Loading properties directory...</td>
                </tr>
              ) : filteredHouses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 font-semibold">No houses found matching your criteria.</td>
                </tr>
              ) : (
                filteredHouses.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-black text-slate-900 text-sm">{h.houseNo}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{h.headName}</div>
                      <div className="text-[10px] text-slate-400">CNIC: {h.cnic || 'N/A'}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {h.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">{h.sector}, {h.street}</td>
                    <td className="p-3.5 text-slate-600">{h.category}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{formatCurrency(h.monthlyFee)}</td>
                    <td className={`p-3.5 font-black ${h.currentDues > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatCurrency(h.currentDues)}
                    </td>
                    <td className="p-3.5">
                      <Badge variant={h.status === 'Active' ? 'success' : h.status === 'Defaulter' ? 'danger' : 'neutral'}>
                        {h.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {/* WhatsApp Reminder Button */}
                      <button
                        onClick={() => handleSendWhatsApp(h)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs"
                        title="Send WhatsApp Dues Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        WhatsApp
                      </button>

                      <button
                        onClick={() => openEditModal(h)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit House Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteHouse(h)}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete House Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit House Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingHouse ? `Edit House Details - ${editingHouse.houseNo}` : 'Register New House Property'}
        subtitle="Specify resident details, sector location, monthly tariff, and initial dues"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">House Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. H-102"
                value={houseNo}
                onChange={e => setHouseNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Resident Head Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Muhammad Farooq"
                value={headName}
                onChange={e => setHeadName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile / WhatsApp Number *</label>
              <input
                type="text"
                required
                placeholder="03001234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">House Registration Month *</label>
              <select
                value={registrationMonth}
                onChange={e => setRegistrationMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
              >
                {REGISTRATION_MONTHS.map(month => <option key={month} value={month}>{month}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Tariff Fee (Rs.) *</label>
              <input
                type="number"
                required
                min={0}
                value={monthlyFee}
                onChange={e => setMonthlyFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-extrabold text-teal-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Calculated Pending Dues (Rs.)</label>
              <input
                type="number"
                value={Number(monthlyFee) * getPendingMonthsBeforeCurrent(registrationMonth)}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-extrabold text-rose-700 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Account Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
              >
                <option value="Active">Active</option>
                <option value="Defaulter">Defaulter</option>
                <option value="Closed">Closed</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save House Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};