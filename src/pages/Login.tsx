import React, { useState } from 'react';
import { useNavigate } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Building2, Shield, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';
import { UserRole } from '../types/index';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@madinastreet.org');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Administrator');
  const [loading, setLoading] = useState(false);

  const quickLogins: { role: UserRole; name: string; email: string; color: string }[] = [
    { role: 'Administrator', name: 'Admin', email: 'admin@madinastreet.org', color: 'bg-teal-700 hover:bg-teal-800 text-white' },
    { role: 'Treasurer', name: 'Treasurer', email: 'treasurer@madinastreet.org', color: 'bg-slate-800 hover:bg-slate-900 text-white' },
    { role: 'Collector', name: 'Collector', email: 'collector@madinastreet.org', color: 'bg-teal-600 hover:bg-teal-700 text-white' },
    { role: 'Viewer', name: 'Auditor', email: 'viewer@madinastreet.org', color: 'bg-slate-600 hover:bg-slate-700 text-white' },
  ];

  const handleQuickLogin = async (targetEmail: string, role: UserRole) => {
    setEmail(targetEmail);
    setSelectedRole(role);
    setLoading(true);
    const success = await login(targetEmail, role);
    setLoading(false);
    if (success) {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, selectedRole);
    setLoading(false);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:24px_24px] opacity-10"></div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative z-10">
        {/* Top Header Banner */}
        <div className="bg-teal-900 p-8 text-center text-white relative">
          <div className="w-14 h-14 bg-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg border border-teal-500/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">{settings.mohallaName}</h1>
          <p className="text-xs text-teal-200 mt-1">Official Mohalla Management System v1.0</p>
        </div>

        {/* Quick Role Selectors */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            One-Click Portal Access (Role Demo)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickLogins.map(q => (
              <button
                key={q.role}
                type="button"
                onClick={() => handleQuickLogin(q.email, q.role)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs ${q.color}`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{q.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Standard Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Security Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Access Role</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
            >
              <option value="Administrator">Administrator</option>
              <option value="Treasurer">Treasurer</option>
              <option value="Collector">Collector</option>
              <option value="Viewer">Viewer (Read Only)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="px-6 py-3 bg-slate-100 text-center text-[10px] text-slate-400 border-t border-slate-200">
          Encrypted Sanctum Authentication • All actions logged in Audit Trail
        </div>
      </div>
    </div>
  );
};
