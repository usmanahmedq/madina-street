import { APP_NAME } from '../../constants/branding';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  Bell, Plus, LogOut, Shield, ChevronDown,
  UserCheck, Sparkles, Building
} from 'lucide-react';
import { GlobalHouseSearch } from '../common/GlobalHouseSearch';

interface HeaderProps {
  onOpenQuickCollection: () => void;
  onOpenQuickExpense: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQuickCollection,
  onOpenQuickExpense,
}) => {
  const { user, logout, canRecordCollection, canManageFinances } = useAuth();
  const { settings } = useSettings();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-6 flex items-center justify-between shadow-xs gap-4">
      {/* Left: Mohalla Location Title */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800">
          <Building className="w-4 h-4 text-teal-700" />
          <span className="text-xs font-bold">{APP_NAME}</span>
        </div>
        <span className="text-xs text-slate-400 hidden lg:inline">• {settings.registrationNo}</span>
      </div>

      {/* Middle: Global Quick Search */}
      <div className="flex-1 max-w-xs md:max-w-md mx-2">
        <GlobalHouseSearch />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Action Buttons */}
        {canRecordCollection && (
          <button
            onClick={onOpenQuickCollection}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Record</span> Collection
          </button>
        )}

        {canManageFinances && (
          <button
            onClick={onOpenQuickExpense}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Add</span> Expense
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h4 className="text-xs font-bold text-slate-900">Mohalla Alerts</h4>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                  System Live
                </span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/60">
                  <p className="font-semibold text-amber-900">Dues Warning</p>
                  <p className="text-[11px] text-amber-800">1 house marked as defaulter (MS-A-103). Outstanding: Rs. 4,000</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/60">
                  <p className="font-semibold text-emerald-900">Collection Goal</p>
                  <p className="text-[11px] text-emerald-800">August collections achieved 70% of target.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Menu */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-800 text-white font-bold text-xs flex items-center justify-center">
              {user?.name.charAt(0) || 'A'}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</p>
              <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Account</p>
                <p className="text-xs text-slate-500 mt-0.5">{user?.name} · {user?.role}</p>
              </div>

              <div className="border-t border-slate-100 pt-1 mt-1 px-2">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
