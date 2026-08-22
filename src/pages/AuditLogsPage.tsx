import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types/index';
import { ExportButton } from '../components/common/ExportButton';
import { Modal } from '../components/common/Modal';
import {
  ShieldCheck, Search, Filter, History, Calendar, User,
  FileText, ArrowDownToLine, RefreshCw, Eye, Tag
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (res.success) {
        setLogs(res.auditLogs);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const modules = Array.from(new Set(logs.map(l => l.module).filter(Boolean)));
  const actions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      (l.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.module || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ipAddress || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = selectedModule === 'ALL' || l.module === selectedModule;
    const matchesAction = selectedAction === 'ALL' || l.action === selectedAction;

    return matchesSearch && matchesModule && matchesAction;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'UPDATE':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'LOGIN':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'LOGOUT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'BACKUP':
      case 'RESTORE':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'SETTINGS_CHANGE':
      case 'PERMISSION_CHANGE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            Security & System Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, tamper-proof activity logs tracking user logins, collections, voucher approvals, and configuration changes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <ExportButton filename="Madina_Street_Audit_Trail" data={filteredLogs} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail by User, Description, IP..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
            />
          </div>

          <div>
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white"
            >
              <option value="ALL">All System Modules ({modules.length})</option>
              {modules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white"
            >
              <option value="ALL">All Action Types ({actions.length})</option>
              {actions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>Showing <strong className="text-slate-900">{filteredLogs.length}</strong> of {logs.length} logged actions</span>
          {(searchTerm || selectedModule !== 'ALL' || selectedAction !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedModule('ALL');
                setSelectedAction('ALL');
              }}
              className="text-teal-700 hover:text-teal-800 font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Operator User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Module</th>
                <th className="p-4">Event Description</th>
                <th className="p-4">IP Address</th>
                <th className="p-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-semibold">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{l.userName}</div>
                      <div className="text-[10px] text-teal-700 uppercase font-semibold">{l.userRole}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getActionBadgeColor(l.action)}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{l.module}</td>
                    <td className="p-4 text-slate-700 max-w-md truncate" title={l.description}>
                      {l.description}
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {l.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                        title="View Record Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Audit Log Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
        subtitle={`Log ID: ${selectedLog?.id || ''}`}
        maxWidth="md"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium block">Timestamp</span>
                <span className="font-bold text-slate-900 font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">IP Address</span>
                <span className="font-bold text-slate-900 font-mono">{selectedLog.ipAddress}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Operator User</span>
                <span className="font-bold text-slate-900">{selectedLog.userName} ({selectedLog.userRole})</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Target Module</span>
                <span className="font-bold text-teal-800">{selectedLog.module}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Action Type</span>
              <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase border ${getActionBadgeColor(selectedLog.action)}`}>
                {selectedLog.action}
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Event Description & Notes</span>
              <div className="p-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 leading-relaxed">
                {selectedLog.description}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
