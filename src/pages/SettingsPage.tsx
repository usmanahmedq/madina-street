import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import {
  Settings, Save, Download, RefreshCw, Landmark, Phone,
  Building2, ShieldAlert
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const [mohallaName, setMohallaName] = useState(settings.mohallaName);
  const [city, setCity] = useState(settings.city);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [presidentName, setPresidentName] = useState(settings.presidentName);
  const [secretaryName, setSecretaryName] = useState(settings.secretaryName);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState(settings.defaultMonthlyFee);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings({
        mohallaName,
        city,
        address,
        phone,
        presidentName,
        secretaryName,
        currencySymbol,
        defaultMonthlyFee,
      });
      alert('System settings updated successfully!');
    } catch (e) {
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupDownload = async () => {
    try {
      const res = await api.getBackup();
      if (res.success) {
        const jsonStr = JSON.stringify(res.backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Madina_Street_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }
    } catch (e) {
      alert('Failed to generate system backup');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">System Settings & Data Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">Configure organization identity, official committee names, default tariffs, and database backups</p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Organization Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-700" />
            Mohalla Identity & Profile
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mohalla / Society Name *</label>
              <input
                type="text"
                required
                value={mohallaName}
                onChange={e => setMohallaName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">City / Region *</label>
              <input
                type="text"
                required
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Helpline Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={e => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 mb-1">Full Postal Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Committee Members Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Landmark className="w-4 h-4 text-teal-700" />
            Official Committee Signatories (Appears on Printed Receipts)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">President Name</label>
              <input
                type="text"
                value={presidentName}
                onChange={e => setPresidentName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">General Secretary / Treasurer Name</label>
              <input
                type="text"
                value={secretaryName}
                onChange={e => setSecretaryName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Financial Tariff Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Financial Default Tariffs</h3>

          <div className="max-w-xs text-xs">
            <label className="block font-bold text-slate-700 mb-1">Default Residential Monthly Contribution (Rs.)</label>
            <input
              type="number"
              value={defaultMonthlyFee}
              onChange={e => setDefaultMonthlyFee(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 font-bold text-xs text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Updating...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Backup & System Maintenance Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2 text-teal-400">
            <Download className="w-4 h-4" />
            Database Backup & Disaster Recovery
          </h3>
          <p className="text-xs text-slate-300 mt-1">Export complete system JSON database snapshot including houses, collections, expenses, and staff</p>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleBackupDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export System Backup (JSON)
          </button>
        </div>
      </div>
    </div>
  );
};
