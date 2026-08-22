import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { House, HouseCategory, HouseStatus } from '../types/index';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ExportButton } from '../components/common/ExportButton';
import { generatePdfTable } from '../utils/pdfGenerator';
import {
  Home, Search, Plus, Filter, Edit, Trash2, Eye,
  Upload, UserCheck, Phone, MapPin, Users, MessageSquare,
  FileSpreadsheet, FileText, Printer, ArrowUpDown, ArrowUp, ArrowDown,
  AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';

export const HouseManagement: React.FC = () => {
  const { formatCurrency, settings } = useSettings();
  const { canManageFinances } = useAuth();

  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feeRangeFilter, setFeeRangeFilter] = useState('ALL');
  const [duesFilter, setDuesFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<'houseNo' | 'headName' | 'monthlyFee' | 'currentDues' | 'lastPaymentDate'>('houseNo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTargetHouse, setDeleteTargetHouse] = useState<House | null>(null);

  // Form State
  const [formHouseNo, setFormHouseNo] = useState('');
  const [formStreet, setFormStreet] = useState('Street 1');
  const [formSector, setFormSector] = useState('Sector A');
  const [formCategory, setFormCategory] = useState<HouseCategory>('Residential Standard');
  const [formType, setFormType] = useState<'Owner' | 'Tenant'>('Owner');
  const [formHeadName, setFormHeadName] = useState('');
  const [formCnic, setFormCnic] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formFamilyMembers, setFormFamilyMembers] = useState(4);
  const [formMonthlyFee, setFormMonthlyFee] = useState(1500);
  const [formStatus, setFormStatus] = useState<HouseStatus>('Active');
  const [formCurrentDues, setFormCurrentDues] = useState(0);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Import JSON/CSV string state
  const [importCsvText, setImportCsvText] = useState('');

  const fetchHouses = async () => {
    setLoading(true);
    try {
      const res = await api.getHouses(true); // includeDeleted for full directory
      if (res.success) {
        setHouses(res.houses);
      }
    } catch (e) {
      console.error('Error fetching houses', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouses();
  }, []);

  const openAddModal = () => {
    setEditingHouse(null);
    setFormHouseNo(`MS-A-${Math.floor(Math.random() * 800 + 100)}`);
    setFormStreet('Street 1');
    setFormSector('Sector A');
    setFormCategory('Residential Standard');
    setFormType('Owner');
    setFormHeadName('');
    setFormCnic('');
    setFormPhone('0300-1234567');
    setFormWhatsapp('0300-1234567');
    setFormFamilyMembers(4);
    setFormMonthlyFee(1500);
    setFormStatus('Active');
    setFormCurrentDues(0);
    setFormNotes('');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (house: House) => {
    setEditingHouse(house);
    setFormHouseNo(house.houseNo);
    setFormStreet(house.street);
    setFormSector(house.sector);
    setFormCategory(house.category);
    setFormType(house.residentType);
    setFormHeadName(house.headName);
    setFormCnic(house.cnic || '');
    setFormPhone(house.phone);
    setFormWhatsapp(house.whatsapp || house.phone);
    setFormFamilyMembers(house.familyMembers);
    setFormMonthlyFee(house.monthlyFee);
    setFormStatus(house.status);
    setFormCurrentDues(house.currentDues);
    setFormNotes(house.notes || '');
    setFormError(null);
    setShowAddModal(true);
  };

  const validateCnic = (cnicVal: string) => {
    if (!cnicVal.trim()) return true;
    const clean = cnicVal.replace(/\D/g, '');
    return clean.length === 13;
  };

  const handleCnicChange = (val: string) => {
    // Auto format CNIC: XXXXX-XXXXXXX-X
    const digits = val.replace(/\D/g, '').slice(0, 13);
    let formatted = digits;
    if (digits.length > 5 && digits.length <= 12) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 12) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
    }
    setFormCnic(formatted);
  };

  const handleSaveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formHouseNo.trim()) {
      setFormError('House Number is required.');
      return;
    }
    if (!formHeadName.trim()) {
      setFormError('Resident Owner / Head Name is required.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Mobile phone number is required.');
      return;
    }
    if (Number(formMonthlyFee) <= 0) {
      setFormError('Monthly Fee contribution must be greater than 0.');
      return;
    }
    if (formCnic && !validateCnic(formCnic)) {
      setFormError('CNIC must contain 13 digits (e.g. 35202-1234567-1).');
      return;
    }

    const payload = {
      houseNo: formHouseNo,
      street: formStreet,
      sector: formSector,
      category: formCategory,
      residentType: formType,
      headName: formHeadName,
      cnic: formCnic,
      phone: formPhone,
      whatsapp: formWhatsapp || formPhone,
      familyMembers: Number(formFamilyMembers),
      monthlyFee: Number(formMonthlyFee),
      status: formStatus,
      currentDues: Number(formCurrentDues),
      notes: formNotes,
    };

    try {
      if (editingHouse) {
        await api.updateHouse(editingHouse.id, payload);
      } else {
        await api.createHouse(payload);
      }
      setShowAddModal(false);
      fetchHouses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save house record.');
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTargetHouse) return;
    try {
      await api.deleteHouse(deleteTargetHouse.id);
      setDeleteTargetHouse(null);
      fetchHouses();
    } catch (e: any) {
      alert(e.message || 'Failed to delete house');
    }
  };

  const handleImportCsv = async () => {
    if (!importCsvText) return;
    try {
      const lines = importCsvText.trim().split('\n');
      const imported = lines.map(line => {
        const parts = line.split(',');
        return {
          houseNo: parts[0]?.trim(),
          headName: parts[1]?.trim(),
          phone: parts[2]?.trim(),
          sector: parts[3]?.trim() || 'Sector A',
          street: parts[4]?.trim() || 'Street 1',
          monthlyFee: Number(parts[5]?.trim()) || 1500,
        };
      });

      const res = await api.importHouses(imported);
      if (res.success) {
        alert(`Successfully imported ${res.addedCount} house records!`);
        setShowImportModal(false);
        setImportCsvText('');
        fetchHouses();
      }
    } catch (e) {
      alert('Invalid CSV payload format');
    }
  };

  // Helper for WhatsApp link format
  const cleanPhoneForWhatsapp = (phoneStr: string) => {
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.startsWith('0')) return '92' + digits.substring(1);
    if (digits.startsWith('92')) return digits;
    return '92' + digits;
  };

  // Filtered and Sorted Houses
  const filteredAndSortedHouses = useMemo(() => {
    return houses.filter(h => {
      // Search term match across HouseNo, HeadName, CNIC, Phone, WhatsApp
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || (
        h.houseNo.toLowerCase().includes(search) ||
        h.headName.toLowerCase().includes(search) ||
        (h.cnic && h.cnic.toLowerCase().includes(search)) ||
        h.phone.includes(search) ||
        (h.whatsapp && h.whatsapp.includes(search))
      );

      // Sector Filter
      const matchesSector = sectorFilter === 'ALL' || h.sector === sectorFilter;

      // Status Filter
      const matchesStatus = statusFilter === 'ALL' || h.status === statusFilter;

      // Fee Range Filter
      let matchesFee = true;
      if (feeRangeFilter === '<1000') matchesFee = h.monthlyFee < 1000;
      else if (feeRangeFilter === '1000-2000') matchesFee = h.monthlyFee >= 1000 && h.monthlyFee <= 2000;
      else if (feeRangeFilter === '2000-5000') matchesFee = h.monthlyFee > 2000 && h.monthlyFee <= 5000;
      else if (feeRangeFilter === '>5000') matchesFee = h.monthlyFee > 5000;

      // Outstanding Dues Filter
      let matchesDues = true;
      if (duesFilter === 'CLEAR') matchesDues = (h.currentDues === 0);
      else if (duesFilter === 'DEFAULTER') matchesDues = (h.currentDues > 0);

      // Date Filter
      let matchesDate = true;
      if (dateFilter === 'TODAY') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchesDate = h.joinedDate === todayStr || (h.createdAt && h.createdAt.startsWith(todayStr));
      } else if (dateFilter === 'THIS_MONTH') {
        const thisMonthStr = new Date().toISOString().slice(0, 7);
        matchesDate = (h.joinedDate && h.joinedDate.startsWith(thisMonthStr)) || (h.createdAt && h.createdAt.startsWith(thisMonthStr));
      }

      return matchesSearch && matchesSector && matchesStatus && matchesFee && matchesDues && matchesDate;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'houseNo') {
        comparison = a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true });
      } else if (sortField === 'headName') {
        comparison = a.headName.localeCompare(b.headName);
      } else if (sortField === 'monthlyFee') {
        comparison = a.monthlyFee - b.monthlyFee;
      } else if (sortField === 'currentDues') {
        comparison = a.currentDues - b.currentDues;
      } else if (sortField === 'lastPaymentDate') {
        const dateA = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
        const dateB = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [houses, searchTerm, sectorFilter, statusFilter, feeRangeFilter, duesFilter, dateFilter, sortField, sortDirection]);

  // Pagination Calculations
  const totalItems = filteredAndSortedHouses.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const paginatedHouses = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedHouses;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedHouses.slice(start, start + pageSize);
  }, [filteredAndSortedHouses, currentPage, pageSize]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExportPdf = () => {
    const headers = ['House No', 'Resident Owner', 'Mobile / WhatsApp', 'Sector', 'Fee (Rs.)', 'Dues (Rs.)', 'Status', 'Last Payment'];
    const rows = filteredAndSortedHouses.map(h => [
      h.houseNo,
      h.headName,
      h.phone,
      `${h.sector}, ${h.street}`,
      h.monthlyFee.toLocaleString(),
      h.currentDues > 0 ? `Rs. ${h.currentDues.toLocaleString()}` : 'Clear',
      h.status,
      h.lastPaymentDate || 'Never',
    ]);

    generatePdfTable({
      title: 'Mohalla House Directory & Dues Ledger',
      filename: 'Madina_Street_House_Directory',
      headers,
      rows,
    });
  };

  const handlePrintDirectory = () => {
    window.print();
  };

  // Directory Stats
  const activeCount = houses.filter(h => h.status === 'Active' || h.status === 'Good Standing').length;
  const defaulterCount = houses.filter(h => h.currentDues > 0 || h.status === 'Defaulter').length;
  const totalDuesAmount = houses.reduce((sum, h) => sum + (h.currentDues || 0), 0);
  const totalTariffMonthly = houses.reduce((sum, h) => sum + (h.monthlyFee || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">House Directory & Master Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive database of residents, monthly tariffs, contacts, and dues status</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton filename="Madina_Street_Houses" data={filteredAndSortedHouses} label="CSV" />
          
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Download PDF Report"
          >
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            PDF Report
          </button>

          <button
            onClick={handlePrintDirectory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Print House Table"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print
          </button>

          {canManageFinances && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Import CSV
              </button>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Register House
              </button>
            </>
          )}
        </div>
      </div>

      {/* Directory Metrics Overview Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Registered Houses</p>
          <p className="text-xl font-black text-slate-900 mt-1">{houses.length}</p>
          <p className="text-[11px] text-teal-700 font-medium mt-0.5">{activeCount} Active Contributing</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Monthly Assessed Tariff</p>
          <p className="text-xl font-black text-teal-800 mt-1">{formatCurrency(totalTariffMonthly)}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Expected Monthly Revenue</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Houses With Pending Dues</p>
          <p className="text-xl font-black text-rose-600 mt-1">{defaulterCount}</p>
          <p className="text-[11px] text-rose-700 font-medium mt-0.5">Pending Action / Reminders</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Outstanding Dues</p>
          <p className="text-xl font-black text-rose-700 mt-1">{formatCurrency(totalDuesAmount)}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Uncollected Receivables</p>
        </div>
      </div>

      {/* Multi-Criteria Search & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        {/* Row 1: Search Bar & Clear Button */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by House #, Owner Name, CNIC, Mobile, or WhatsApp..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setSectorFilter('ALL');
              setStatusFilter('ALL');
              setFeeRangeFilter('ALL');
              setDuesFilter('ALL');
              setDateFilter('ALL');
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
          >
            Reset Filters
          </button>
        </div>

        {/* Row 2: Filter Select Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sector</label>
            <select
              value={sectorFilter}
              onChange={e => { setSectorFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Sectors</option>
              <option value="Sector A">Sector A</option>
              <option value="Sector B">Sector B</option>
              <option value="Commercial Lane">Commercial Lane</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Good Standing">Good Standing</option>
              <option value="Warning">Warning</option>
              <option value="Defaulter">Defaulter</option>
              <option value="Rented">Rented</option>
              <option value="Vacant">Vacant</option>
              <option value="Exempted">Exempted</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monthly Tariff</label>
            <select
              value={feeRangeFilter}
              onChange={e => { setFeeRangeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Fees</option>
              <option value="<1000">Below Rs. 1,000</option>
              <option value="1000-2000">Rs. 1,000 - 2,000</option>
              <option value="2000-5000">Rs. 2,000 - 5,000</option>
              <option value=">5000">Above Rs. 5,000</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dues Status</label>
            <select
              value={duesFilter}
              onChange={e => { setDuesFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Dues</option>
              <option value="CLEAR">Fully Paid (Clear)</option>
              <option value="DEFAULTER">Has Pending Dues</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</label>
            <select
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Time</option>
              <option value="THIS_MONTH">Added This Month</option>
              <option value="TODAY">Added Today</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Houses Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort('houseNo')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    House No
                    {sortField === 'houseNo' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-700" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-700" />
                    ) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('headName')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Resident Head & CNIC
                    {sortField === 'headName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-700" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-700" />
                    ) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </th>

                <th className="p-4">Contact / WhatsApp</th>
                <th className="p-4">Sector & Street</th>

                <th
                  onClick={() => handleSort('monthlyFee')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Monthly Fee
                    {sortField === 'monthlyFee' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-700" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-700" />
                    ) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('currentDues')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Outstanding Dues
                    {sortField === 'currentDues' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-700" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-700" />
                    ) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('lastPaymentDate')}
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Last Payment
                    {sortField === 'lastPaymentDate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-700" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-700" />
                    ) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </th>

                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                    <RefreshCw className="w-6 h-6 text-teal-600 animate-spin mx-auto mb-2" />
                    Loading master house directory...
                  </td>
                </tr>
              ) : paginatedHouses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold">
                    No houses match your selected search criteria.
                  </td>
                </tr>
              ) : (
                paginatedHouses.map(h => (
                  <tr key={h.id} className={`hover:bg-slate-50/80 transition-colors ${h.isDeleted ? 'bg-slate-50/60 opacity-75' : ''}`}>
                    <td className="p-4">
                      <Link to={`/houses/${h.id}`} className="font-extrabold text-teal-800 hover:text-teal-900 hover:underline flex items-center gap-1.5">
                        {h.houseNo}
                        {h.isDeleted && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-600">Soft Deleted</span>}
                      </Link>
                      <span className="block text-[10px] text-slate-400 font-normal">{h.residentType} • {h.category}</span>
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-slate-900">{h.headName}</p>
                      {h.cnic ? (
                        <p className="text-[10px] font-mono text-slate-500">CNIC: {h.cnic}</p>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No CNIC on file</p>
                      )}
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-slate-800">{h.phone}</p>
                      <a
                        href={`https://wa.me/${cleanPhoneForWhatsapp(h.whatsapp || h.phone)}?text=Assalam%20o%20Alaikum%20${encodeURIComponent(h.headName)},%20regarding%20House%20${h.houseNo}%20monthly%20contribution.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline mt-0.5"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
                      </a>
                    </td>

                    <td className="p-4 text-slate-700">
                      {h.sector}
                      <span className="block text-[10px] text-slate-400">{h.street}</span>
                    </td>

                    <td className="p-4 font-bold text-slate-900">{formatCurrency(h.monthlyFee)}</td>

                    <td className="p-4">
                      {h.currentDues > 0 ? (
                        <div>
                          <span className="font-black text-rose-600">{formatCurrency(h.currentDues)}</span>
                          <span className="block text-[10px] font-bold text-rose-500">Pending</span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Clear
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-slate-600">
                      {h.lastPaymentDate ? (
                        <div>
                          <p className="font-semibold text-slate-800">{h.lastPaymentDate}</p>
                          {h.lastReceiptNo && <p className="text-[10px] text-teal-800 font-mono">#{h.lastReceiptNo}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No receipts</span>
                      )}
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={
                          h.status === 'Active' || h.status === 'Good Standing'
                            ? 'success'
                            : h.status === 'Defaulter'
                            ? 'danger'
                            : h.status === 'Warning'
                            ? 'warning'
                            : h.status === 'Exempted'
                            ? 'primary'
                            : 'neutral'
                        }
                      >
                        {h.status}
                      </Badge>
                    </td>

                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <Link
                        to={`/houses/${h.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                        title="View Profile & Statement"
                      >
                        <Eye className="w-3.5 h-3.5" /> Profile
                      </Link>

                      {canManageFinances && !h.isDeleted && (
                        <>
                          <button
                            onClick={() => openEditModal(h)}
                            className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetHouse(h)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination & Item Counter */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-900">{paginatedHouses.length}</strong> of{' '}
              <strong className="text-slate-900">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1">
              <span className="text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={-1}>All</option>
              </select>
            </div>
          </div>

          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
              >
                Previous
              </button>

              <span className="font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Register / Edit House Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingHouse ? `Edit House Record - ${editingHouse.houseNo}` : 'Register New House'}
        subtitle="Specify residence details, CNIC, mobile, monthly tariff, and initial dues"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveHouse} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">House Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. MS-A-101"
                value={formHouseNo}
                onChange={e => setFormHouseNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Resident Owner / Head Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Haji Muhammad Younas"
                value={formHeadName}
                onChange={e => setFormHeadName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Sector</label>
              <select
                value={formSector}
                onChange={e => setFormSector(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value="Sector A">Sector A</option>
                <option value="Sector B">Sector B</option>
                <option value="Commercial Lane">Commercial Lane</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Street</label>
              <input
                type="text"
                placeholder="e.g. Street 1"
                value={formStreet}
                onChange={e => setFormStreet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as HouseCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value="Residential Standard">Residential Standard</option>
                <option value="Residential Large">Residential Large</option>
                <option value="Commercial Shop">Commercial Shop</option>
                <option value="Plaza / Office">Plaza / Office</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Resident Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as 'Owner' | 'Tenant')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value="Owner">Owner</option>
                <option value="Tenant">Tenant</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
              <input
                type="text"
                required
                placeholder="0300-1234567"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">WhatsApp Number</label>
              <input
                type="text"
                placeholder="0300-1234567"
                value={formWhatsapp}
                onChange={e => setFormWhatsapp(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">CNIC Number</label>
              <input
                type="text"
                placeholder="35202-0000000-0"
                value={formCnic}
                onChange={e => handleCnicChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400">13 digits standard Pakistani CNIC</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Tariff (Rs.) *</label>
              <input
                type="number"
                required
                min="1"
                value={formMonthlyFee}
                onChange={e => setFormMonthlyFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-extrabold text-teal-800 text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as HouseStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                <option value="Active">Active</option>
                <option value="Rented">Rented</option>
                <option value="Vacant">Vacant</option>
                <option value="Exempted">Exempted</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Family Members Count</label>
              <input
                type="number"
                min="1"
                value={formFamilyMembers}
                onChange={e => setFormFamilyMembers(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Initial Outstanding Dues (Rs.)</label>
              <input
                type="number"
                min="0"
                value={formCurrentDues}
                onChange={e => setFormCurrentDues(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-rose-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Internal Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Special instructions, landmark near house..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm"
            >
              Save Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Soft Delete Warning Modal */}
      <Modal
        isOpen={!!deleteTargetHouse}
        onClose={() => setDeleteTargetHouse(null)}
        title="Confirm House Record Removal"
        subtitle="Enterprise Soft Delete Protection"
        maxWidth="md"
      >
        {deleteTargetHouse && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900">Soft Delete Safeguard</h4>
                <p className="text-amber-800 mt-1">
                  Are you sure you want to delete house record <strong>{deleteTargetHouse.houseNo}</strong> ({deleteTargetHouse.headName})?
                </p>
                <p className="text-amber-700 text-[11px] mt-2 italic">
                  Note: If this house has existing receipt history, it will be marked as <strong>Closed / Soft-Deleted</strong> to protect all audit trails and financial ledgers.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetHouse(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSoftDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs"
              >
                Proceed With Deletion
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Batch Import CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Batch Import Houses (CSV Format)"
        subtitle="Paste CSV rows in format: HouseNo, ResidentName, Phone, Sector, Street, MonthlyFee"
        maxWidth="lg"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">Sample Row Format:</p>
          <code className="block bg-slate-900 text-teal-300 p-3 rounded-lg font-mono text-[11px]">
            MS-A-110, Haji Tariq, 0300-1112233, Sector A, Street 1, 1500<br/>
            MS-A-111, Rashid Khan, 0300-2223344, Sector A, Street 2, 1500
          </code>

          <textarea
            rows={6}
            placeholder="Paste CSV contents here..."
            value={importCsvText}
            onChange={e => setImportCsvText(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg font-mono text-xs"
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleImportCsv}
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              Start Batch Import
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
