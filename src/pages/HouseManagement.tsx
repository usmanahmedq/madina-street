import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { House } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  Home, Plus, Search, Filter, Edit2, Trash2, MessageSquare, 
  Phone, User, Shield, AlertCircle, CheckCircle, RefreshCw,
  ExternalLink, Building
} from 'lucide-react';

export const HouseManagement: React.FC = () => {
  const { settings, formatCurrency } = useSettings();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
  const [status, setStatus] = useState<'Active' | 'Closed' | 'Defaulter' | 'Suspended'>('Active');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getHouses();
      if (res.success) setHouses(res.houses || []);
    } catch (err) {
      console.error('Failed to load houses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        currentDues: Number(currentDues),
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
    const mohallaName = settings?.mohallaName || 'Madina Street Mohalla Society';

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

  const filteredHouses = houses.filter(h => {
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

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New House
        </button>
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
              <label className="block font-bold text-slate-700 mb-1">CNIC Number</label>
              <input
                type="text"
                placeholder="42101-1234567-1"
                value={cnic}
                onChange={e => setCnic(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Sector *</label>
              <input
                type="text"
                required
                placeholder="Sector A"
                value={sector}
                onChange={e => setSector(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Street *</label>
              <input
                type="text"
                required
                placeholder="Street 5"
                value={street}
                onChange={e => setStreet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Property Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
              >
                <option value="Residential 80 Sq Yd">Residential 80 Sq Yd</option>
                <option value="Residential 120 Sq Yd">Residential 120 Sq Yd</option>
                <option value="Residential 240 Sq Yd">Residential 240 Sq Yd</option>
                <option value="Commercial Shop">Commercial Shop</option>
                <option value="Plaza / Commercial">Plaza / Commercial</option>
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
              <label className="block font-bold text-slate-700 mb-1">Current Pending Dues (Rs.)</label>
              <input
                type="number"
                min={0}
                value={currentDues}
                onChange={e => setCurrentDues(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-extrabold text-rose-700"
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