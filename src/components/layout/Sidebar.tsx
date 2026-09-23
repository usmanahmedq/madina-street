import { APP_NAME } from '../../constants/branding';
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Home, Banknote, Receipt, Users, CreditCard,
  CalendarCheck, BookOpen, BarChart3, Printer, Shield, Settings,
  FileText, ChevronLeft, ChevronRight, Building2, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user } = useAuth();
  const { settings } = useSettings();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'Houses', href: '/houses', icon: Home, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'Defaulters Report', href: '/defaulters', icon: ShieldAlert, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'Collections', href: '/collections', icon: Banknote, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'Expenses', href: '/expenses', icon: Receipt, roles: ['Administrator', 'Treasurer', 'Viewer'] },
    { name: 'Staff', href: '/staff', icon: Users, roles: ['Administrator', 'Treasurer', 'Viewer'] },
    { name: 'Salaries', href: '/salaries', icon: CreditCard, roles: ['Administrator', 'Treasurer', 'Viewer'] },
    { name: 'Attendance', href: '/attendance', icon: CalendarCheck, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'Ledger', href: '/ledger', icon: BookOpen, roles: ['Administrator', 'Treasurer', 'Viewer'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['Administrator', 'Treasurer', 'Viewer'] },
    { name: 'Print Receipts', href: '/print-receipts', icon: Printer, roles: ['Administrator', 'Treasurer', 'Collector', 'Viewer'] },
    { name: 'User Management', href: '/users', icon: Shield, roles: ['Administrator'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['Administrator', 'Treasurer'] },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileText, roles: ['Administrator'] },
  ];

  const filteredNav = navigation.filter(
    item => user && item.roles.includes(user.role)
  );

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-teal-950 text-slate-100 transition-all duration-300 flex flex-col border-r border-teal-900 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-teal-900/80 bg-teal-950/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center shrink-0 shadow-md">
            <Building2 className="w-5 h-5 text-teal-100" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm text-white truncate">{APP_NAME}</h1>
              <p className="text-[10px] text-teal-300 font-medium tracking-wide">MOHALLA SYSTEM v1.0</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredNav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm font-semibold'
                    : 'text-teal-200/80 hover:bg-teal-900/70 hover:text-white'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Role badge */}
      {!collapsed && user && (
        <div className="p-4 border-t border-teal-900/80 bg-teal-950/60">
          <div className="bg-teal-900/80 rounded-xl p-3 border border-teal-800/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-xs font-bold text-teal-100 shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase bg-teal-800 text-teal-200">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
