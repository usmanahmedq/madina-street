import React, { useState, useEffect } from 'react';
import { StaffDesignation } from '../../types/index';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { ShieldCheck, Plus, Trash2, Award, Info } from 'lucide-react';

interface DesignationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDesignationChanged?: () => void;
}

export const DesignationManagerModal: React.FC<DesignationManagerModalProps> = ({ isOpen, onClose, onDesignationChanged }) => {
  const [designations, setDesignations] = useState<StaffDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDesignations = async () => {
    try {
      const res = await api.getStaffDesignations();
      if (res.success && res.designations) {
        setDesignations(res.designations);
      }
    } catch (e) {
      console.error('Error fetching staff designations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDesignations();
    }
  }, [isOpen]);

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.createStaffDesignation(newTitle.trim(), newDesc.trim());
      if (res.success) {
        setNewTitle('');
        setNewDesc('');
        fetchDesignations();
        if (onDesignationChanged) onDesignationChanged();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create custom designation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove designation '${title}'?`)) return;

    try {
      const res = await api.deleteStaffDesignation(id);
      if (res.success) {
        fetchDesignations();
        if (onDesignationChanged) onDesignationChanged();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete designation');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Staff Designations & Roles Setup" maxWidth="max-w-xl">
      <div className="space-y-6">
        {/* Create Custom Designation Form */}
        <form onSubmit={handleAddDesignation} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-teal-700" /> Create Custom Designation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700">Designation Title *</label>
              <input
                type="text"
                placeholder="e.g. Mosque Caretaker"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700">Short Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Mosque maintenance staff"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold mt-1"
              />
            </div>
          </div>

          <div className="text-right">
            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? 'Adding...' : 'Add Designation'}
            </button>
          </div>
        </form>

        {/* Existing Designations List */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-xs flex items-center justify-between">
            <span>Available Designations ({designations.length})</span>
            <span className="text-[10px] text-slate-400 font-normal">Default system designations cannot be deleted</span>
          </h3>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-60 overflow-y-auto bg-white">
            {loading ? (
              <div className="p-6 text-center text-slate-400">Loading designations...</div>
            ) : designations.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No custom designations configured.</div>
            ) : (
              designations.map(d => (
                <div key={d.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        {d.title}
                        {d.isDefault && (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            Default
                          </span>
                        )}
                      </p>
                      {d.description && <p className="text-[10px] text-slate-500">{d.description}</p>}
                    </div>
                  </div>

                  {!d.isDefault && (
                    <button
                      onClick={() => handleDelete(d.id, d.title)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Designation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
