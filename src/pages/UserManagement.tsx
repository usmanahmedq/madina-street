import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, UserRole, CustomRole, UserPermission } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ExportButton } from '../components/common/ExportButton';
import {
  Shield, UserCheck, Plus, Search, Edit, Check, X, Lock,
  KeyRound, Trash2, ShieldAlert, History, Laptop, Globe,
  RefreshCw, CheckCircle2, AlertTriangle
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { canManageUsers, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES' | 'LOGINS'>('USERS');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Modal State for User
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('Collector');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Suspended'>('Active');
  const [avatar, setAvatar] = useState('');

  // Modal State for Role
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<UserPermission[]>([]);

  // Password Reset Modal
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  const availableModules = [
    { key: 'houses', label: 'Houses & Residents' },
    { key: 'collections', label: 'Monthly Collections & Receipts' },
    { key: 'expenses', label: 'Expenses & Payment Vouchers' },
    { key: 'staff', label: 'Staff Directory & Attendance' },
    { key: 'salaries', label: 'Staff Salaries & Disbursals' },
    { key: 'ledger', label: 'General Accounts Ledger' },
    { key: 'reports', label: 'Reports & Analytics' },
    { key: 'users', label: 'User & Access Management' },
    { key: 'settings', label: 'Mohalla Settings & Backups' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, loginsRes] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
        api.getLoginHistory(),
      ]);

      if (usersRes.success) setUsers(usersRes.users);
      if (rolesRes.success) setRoles(rolesRes.roles);
      if (loginsRes.success) setLoginHistory(loginsRes.loginHistory);
    } catch (e) {
      console.error('Error fetching admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddUserModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setUsername('');
    setRole('Collector');
    setPhone('0300-1234567');
    setStatus('Active');
    setAvatar('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    setShowUserModal(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setUsername(u.username || u.email.split('@')[0]);
    setRole(u.role);
    setPhone(u.phone || '');
    setStatus(u.status || (u.active ? 'Active' : 'Inactive'));
    setAvatar(u.avatar || '');
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedRole = roles.find(r => r.name === role);
    const payload = {
      name,
      email,
      username,
      role,
      phone,
      status,
      active: status === 'Active',
      avatar,
      permissions: editingUser?.permissions || (matchedRole ? matchedRole.permissions : []),
    };

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        await api.createUser(payload);
      }
      setShowUserModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save user account');
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${u.name}" (${u.email})?`)) {
      return;
    }
    try {
      const res = await api.deleteUser(u.id);
      if (res.success) {
        fetchData();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (u: User) => {
    try {
      const res = await api.resetUserPassword(u.id);
      if (res.success) {
        setPasswordResetUser(u);
        setResetSuccessMessage(res.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to reset password');
    }
  };

  const handleToggleUserStatus = async (u: User) => {
    const nextStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateUser(u.id, { status: nextStatus, active: nextStatus === 'Active' });
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to update user status');
    }
  };

  // Role Management handlers
  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRolePermissions(
      availableModules.map(m => ({
        module: m.key,
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      }))
    );
    setShowRoleModal(true);
  };

  const openEditRoleModal = (r: CustomRole) => {
    setEditingRole(r);
    setRoleName(r.name);
    setRoleDescription(r.description || '');
    
    // Merge existing permissions with any newly added modules
    const mergedPerms = availableModules.map(m => {
      const existing = r.permissions.find(p => p.module === m.key);
      return (
        existing || {
          module: m.key,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }
      );
    });

    setRolePermissions(mergedPerms);
    setShowRoleModal(true);
  };

  const handleTogglePermission = (moduleKey: string, field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    setRolePermissions(prev =>
      prev.map(p => {
        if (p.module === moduleKey) {
          const updated = { ...p, [field]: !p[field] };
          if (field !== 'canView' && updated[field]) {
            updated.canView = true; // Auto enable view if any edit/create is on
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: roleName,
      description: roleDescription,
      permissions: rolePermissions,
    };

    try {
      if (editingRole) {
        await api.updateRole(editingRole.id, payload);
      } else {
        await api.createRole(payload);
      }
      setShowRoleModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save role');
    }
  };

  const handleDeleteRole = async (r: CustomRole) => {
    if (!window.confirm(`Are you sure you want to delete role "${r.name}"?`)) return;
    try {
      const res = await api.deleteRole(r.id);
      if (res.success) {
        fetchData();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete role');
    }
  };

  // Filtering users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);

    const matchesRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || u.status === selectedStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-700" />
            User Management & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer operator accounts, customizable roles, module permissions matrix, and audit login history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton filename="Madina_Street_Users" data={users} />
          {canManageUsers && activeTab === 'USERS' && (
            <button
              onClick={openAddUserModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Operator Account
            </button>
          )}
          {canManageUsers && activeTab === 'ROLES' && (
            <button
              onClick={openAddRoleModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Custom Role
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`pb-3 px-3 transition-colors relative ${
            activeTab === 'USERS' ? 'text-teal-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Operator Accounts ({users.length})
          {activeTab === 'USERS' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('ROLES')}
          className={`pb-3 px-3 transition-colors relative ${
            activeTab === 'ROLES' ? 'text-teal-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Roles & Granular Permissions ({roles.length})
          {activeTab === 'ROLES' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('LOGINS')}
          className={`pb-3 px-3 transition-colors relative ${
            activeTab === 'LOGINS' ? 'text-teal-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Login Audit History ({loginHistory.length})
          {activeTab === 'LOGINS' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user by name, email, username, phone..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div>
                <select
                  value={selectedRoleFilter}
                  onChange={e => setSelectedRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white"
                >
                  <option value="ALL">All Roles</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white"
                >
                  <option value="ALL">All Account Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">User Profile</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">Contact Phone</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                        No operator accounts found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {u.name}
                                {u.id === currentUser?.id && (
                                  <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-extrabold">You</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{u.email} • @{u.username || u.email.split('@')[0]}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-teal-50 text-teal-800 border border-teal-200/70">
                            {u.role}
                          </span>
                        </td>

                        <td className="p-4 text-slate-600 font-medium">
                          {u.phone || 'N/A'}
                        </td>

                        <td className="p-4">
                          <Badge
                            variant={
                              u.status === 'Active' ? 'success' : u.status === 'Suspended' ? 'danger' : 'neutral'
                            }
                          >
                            {u.status || (u.active ? 'Active' : 'Inactive')}
                          </Badge>
                        </td>

                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never logged in'}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManageUsers && (
                              <>
                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title={u.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                >
                                  {u.status === 'Active' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleResetPassword(u)}
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                                  title="Reset Password"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                                  title="Edit User"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                {u.id !== 'u-1' && u.email !== 'admin@madinastreet.org' && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSION MATRIX */}
      {activeTab === 'ROLES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roles.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {r.isSystem ? 'System Preset' : 'Custom Role'}
                    </span>
                    {!r.isSystem && canManageUsers && (
                      <button
                        onClick={() => handleDeleteRole(r)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mt-2 text-sm">{r.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.description || 'No description provided.'}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {r.permissions.filter(p => p.canView).length} modules enabled
                  </span>
                  {canManageUsers && (
                    <button
                      onClick={() => openEditRoleModal(r)}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800"
                    >
                      Configure Matrix →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Master Permission Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-700" />
                  Live Role Permission Security Matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Summary of read, write, update, and delete access across all society modules</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-3">Module Name</th>
                    {roles.map(r => (
                      <th key={r.id} className="p-3 text-center">{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {availableModules.map(m => (
                    <tr key={m.key} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{m.label}</td>
                      {roles.map(r => {
                        const perm = r.permissions.find(p => p.module === m.key);
                        const hasFull = perm?.canView && perm?.canCreate && perm?.canEdit && perm?.canDelete;
                        const hasView = perm?.canView;
                        return (
                          <td key={r.id} className="p-3 text-center">
                            {hasFull ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
                                <Check className="w-3 h-3" /> Full
                              </span>
                            ) : hasView ? (
                              <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                                <Check className="w-3 h-3" /> View/Edit
                              </span>
                            ) : (
                              <X className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOGIN HISTORY */}
      {activeTab === 'LOGINS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-teal-700" />
                Live Authentication & Session History
              </h3>
              <span className="text-xs text-slate-400 font-mono">Last 200 Sessions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">User Name</th>
                    <th className="p-4">Login Time</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">Browser & Client</th>
                    <th className="p-4">Operating System</th>
                    <th className="p-4">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loginHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                        No login activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    loginHistory.map(lh => (
                      <tr key={lh.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold text-slate-900">{lh.userName}</td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {new Date(lh.loginTime).toLocaleString()}
                        </td>
                        <td className="p-4 font-mono text-slate-600">{lh.ipAddress}</td>
                        <td className="p-4 text-slate-700 font-medium flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          {lh.browser}
                        </td>
                        <td className="p-4 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Laptop className="w-3.5 h-3.5 text-slate-400" />
                            {lh.os}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{lh.location}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? 'Edit Operator Account' : 'Create New Operator Account'}
        subtitle="Configure profile credentials, security role, and account status"
        maxWidth="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 bg-slate-50/50"
              placeholder="e.g. Muhammad Usman"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
                placeholder="name@madinastreet.org"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
                placeholder="usman_collector"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Security Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
                placeholder="0300-1234567"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Account Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Active', 'Inactive', 'Suspended'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`py-2 text-center rounded-xl font-bold border transition-colors ${
                    status === st
                      ? st === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : st === 'Suspended'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Avatar Profile Photo URL</label>
            <input
              type="url"
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowUserModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              Save Operator Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Role Permission Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? `Configure Permissions: ${editingRole.name}` : 'Create Custom Role'}
        subtitle="Define granular read, write, edit and delete permissions per module"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Role Title *</label>
              <input
                type="text"
                required
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                disabled={editingRole?.isSystem}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                placeholder="e.g. Area Supervisor"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={roleDescription}
                onChange={e => setRoleDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="Responsibilities of this role"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
              <span>Granular Permissions Matrix</span>
              <span className="text-[10px] text-slate-400 font-normal">Check allowed capabilities</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {availableModules.map(m => {
                const perm = rolePermissions.find(p => p.module === m.key) || {
                  module: m.key,
                  canView: false,
                  canCreate: false,
                  canEdit: false,
                  canDelete: false,
                };

                return (
                  <div key={m.key} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <span className="font-semibold text-slate-800">{m.label}</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={perm.canView}
                          onChange={() => handleTogglePermission(m.key, 'canView')}
                          className="rounded text-teal-700"
                        />
                        View
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={perm.canCreate}
                          onChange={() => handleTogglePermission(m.key, 'canCreate')}
                          className="rounded text-teal-700"
                        />
                        Create
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={perm.canEdit}
                          onChange={() => handleTogglePermission(m.key, 'canEdit')}
                          className="rounded text-teal-700"
                        />
                        Edit
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={perm.canDelete}
                          onChange={() => handleTogglePermission(m.key, 'canDelete')}
                          className="rounded text-teal-700"
                        />
                        Delete
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              Save Role Matrix
            </button>
          </div>
        </form>
      </Modal>

      {/* Password Reset Alert Modal */}
      <Modal
        isOpen={!!passwordResetUser}
        onClose={() => setPasswordResetUser(null)}
        title="Password Reset Successful"
        subtitle={`User: ${passwordResetUser?.name}`}
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 mb-1" />
            {resetSuccessMessage}
          </div>
          <p className="text-slate-600">
            A temporary password reset link has been dispatched to <strong>{passwordResetUser?.email}</strong>. The user can sign in and set their new password.
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPasswordResetUser(null)}
              className="px-4 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
