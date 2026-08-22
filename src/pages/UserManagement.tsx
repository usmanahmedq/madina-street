import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Role } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Users, UserPlus, Shield, Key, CheckCircle, XCircle,
  Edit, Trash2, RefreshCw, AlertTriangle, Search, Lock
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('Collector');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Default Fallback Roles (In case API fails or returns empty)
  const defaultRoles = ['Admin', 'Collector', 'Supervisor', 'Auditor', 'Committee Member'];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
      ]);

      if (usersRes.success) setUsers(usersRes.users || []);
      if (rolesRes.success && rolesRes.roles) setRoles(rolesRes.roles);
    } catch (e) {
      console.error('Failed to load user management data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    // Pehle role set karein
    const initialRole = roles.length > 0 ? roles[0].name : 'Collector';
    setFormRole(initialRole);
    setFormStatus('Active');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(''); // Password optionally update hoga
    setFormRole(u.role);
    setFormStatus(u.status || 'Active');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!formEmail.trim()) {
      setFormError('Email address / Username is required.');
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      setFormError('Password is required for new operators.');
      return;
    }
    if (!formRole) {
      setFormError('Please select a security role.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formName,
        email: formEmail,
        password: formPassword || undefined,
        role: formRole,
        status: formStatus,
      };

      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        await api.createUser(payload);
      }

      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save operator user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
      await api.updateUser(user.id, { status: newStatus });
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to change user status');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">System User & Operator Management</h1>
            <Badge variant="teal" size="sm">{users.length} Accounts</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create operator accounts, assign security roles, and manage system login access permissions
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add New Operator
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search operators by name, email, or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3">Operator Name</th>
                <th className="p-3">Username / Email</th>
                <th className="p-3">Assigned Security Role</th>
                <th className="p-3">Last Active</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Loading operator directory...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">No operator accounts found.</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{u.name}</td>
                    <td className="p-3 font-mono text-slate-700">{u.email}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        <Shield className="w-3 h-3 text-teal-600" />
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{u.lastLogin || 'Never'}</td>
                    <td className="p-3">
                      <Badge variant={u.status === 'Active' ? 'success' : 'neutral'}>
                        {u.status || 'Active'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit Account"
                      >
                        <Edit className="w-4 h-4" />
                      </button>                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                          u.status === 'Active'
                            ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {u.status === 'Active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Operator Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingUser ? `Edit Operator Account - ${editingUser.name}` : 'Create New System Operator'}
        subtitle="Specify login credentials, email address, and security permissions role"
        maxWidth="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Tariq Mehmood"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Email / Username *</label>
            <input
              type="email"
              required
              placeholder="operator@mohalla.org"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {editingUser ? 'Password (Leave blank to keep existing)' : 'Login Password *'}
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                placeholder={editingUser ? '••••••••' : 'Enter strong password'}
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Security Role *</label>
              <select
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-teal-800 bg-white"
              >
                {roles.length > 0
                  ? roles.map(r => (
                      <option key={r.id || r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))
                  : defaultRoles.map(roleName => (
                      <option key={roleName} value={roleName}>
                        {roleName}
                      </option>
                    ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Account Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
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
              disabled={submitting}
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};