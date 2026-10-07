import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Mail,
  Server,
  User as UserIcon,
  X,
  Check,
  Edit2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { EscalationPolicy, ServiceItem, User, EscalationStep } from '../types/index.js';

export const PoliciesPage: React.FC = () => {
  const { user } = useAuth();

  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  // Form state
  const [serviceId, setServiceId] = useState('');
  const [policyName, setPolicyName] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [steps, setSteps] = useState<EscalationStep[]>([
    { order: 1, timeoutMinutes: 5, notifyUserId: '', channel: 'email' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [polData, svcData, usrData] = await Promise.all([
        api.policies.list(),
        api.services.list(),
        api.users.list(),
      ]);
      setPolicies(polData);
      setServices(svcData);
      setUsers(usrData);

      if (svcData.length > 0 && !serviceId) {
        setServiceId(svcData[0]._id);
      }
      if (usrData.length > 0 && !steps[0].notifyUserId) {
        setSteps([{ order: 1, timeoutMinutes: 5, notifyUserId: usrData[0]._id, channel: 'email' }]);
      }
    } catch (err) {
      console.error('[PoliciesPage] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId, steps]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreateModal = () => {
    setEditingPolicyId(null);
    setPolicyName('');
    setRepeatCount(1);
    setSteps([
      { order: 1, timeoutMinutes: 5, notifyUserId: users[0]?._id || '', channel: 'email' },
      { order: 2, timeoutMinutes: 10, notifyUserId: users[1]?._id || users[0]?._id || '', channel: 'email' },
    ]);
    setModalOpen(true);
  };

  const handleOpenEditModal = (pol: EscalationPolicy) => {
    setEditingPolicyId(pol._id);
    setServiceId(pol.serviceId);
    setPolicyName(pol.name);
    setRepeatCount(pol.repeatCount || 1);
    setSteps(
      pol.steps.map((s, idx) => ({
        order: idx + 1,
        timeoutMinutes: s.timeoutMinutes,
        notifyUserId: (s.notifyUserId as any)?._id || (s.user as any)?._id || s.notifyUserId,
        channel: 'email',
      }))
    );
    setModalOpen(true);
  };

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        timeoutMinutes: 10,
        notifyUserId: users[0]?._id || '',
        channel: 'email',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) =>
      prev.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, order: idx + 1 }))
    );
  };

  const handleStepChange = (index: number, field: keyof EscalationStep, value: any) => {
    setSteps((prev) =>
      prev.map((step, idx) => (idx === index ? { ...step, [field]: value } : step))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim() || steps.length === 0) return;
    setIsSubmitting(true);
    try {
      if (editingPolicyId) {
        await api.policies.update(editingPolicyId, {
          name: policyName.trim(),
          steps,
          repeatCount,
        });
      } else {
        await api.policies.create({
          serviceId,
          name: policyName.trim(),
          steps,
          repeatCount,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[PoliciesPage] Error saving policy:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Outfit'] text-white tracking-tight flex items-center gap-2">
            Escalation Policy Ladders
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1A2640] text-slate-300 font-semibold font-mono">
              {policies.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Build multi-tier notification step ladders that auto-advance when incidents go unacknowledged
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#12192B] hover:bg-[#1A233D] border border-[#202E4C] text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {user?.role !== 'viewer' && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Build New Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-6">
        {policies.map((policy) => (
          <div
            key={policy._id}
            className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-5 shadow-xl"
          >
            {/* Title & Service Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A2438] pb-4">
              <div>
                <div className="flex items-center space-x-2.5">
                  <h3 className="text-lg font-bold text-white font-['Outfit']">{policy.name}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#19243C] text-slate-300 border border-[#233355]">
                    {policy.steps.length} Steps
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  Service: <span className="text-slate-200 font-medium">{policy.serviceName || 'Service'}</span>
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400">
                  Repeat: <span className="font-semibold text-slate-200">{policy.repeatCount} time(s)</span>
                </span>
                {user?.role !== 'viewer' && (
                  <button
                    onClick={() => handleOpenEditModal(policy)}
                    className="p-1.5 rounded-lg bg-[#152038] hover:bg-[#1D2B4D] text-slate-300 hover:text-white transition"
                    title="Edit Policy"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Step Ladder Steps Visualizer */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Escalation Chain Execution Order
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {policy.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0A0F1D] border border-[#19243A] space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Step {step.order}
                      </span>
                      <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        After {step.timeoutMinutes}m unacked
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {step.user?.name || 'On-Call Target'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.user?.title || step.user?.email || 'Engineer'}</p>
                    </div>

                    <div className="flex items-center space-x-1.5 pt-2 border-t border-[#152035] text-[10px] text-slate-400 font-mono uppercase">
                      <Mail className="w-3 h-3 text-blue-400" />
                      <span>Paging via Email</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Policy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-rose-500" />
                {editingPolicyId ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingPolicyId && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Service
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {services.map((svc) => (
                      <option key={svc._id} value={svc._id}>
                        {svc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Gateway Tier Escalation"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Chain Repeat Count (If unacknowledged)
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Number(e.target.value))}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Dynamic Step Rows */}
              <div className="space-y-3 pt-2 border-t border-[#1C2842]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Escalation Chain Steps
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#141C2E] border border-[#26354D] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                    >
                      <div className="sm:col-span-1 font-bold text-rose-400">
                        #{step.order}
                      </div>

                      <div className="sm:col-span-4">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Notify User</label>
                        <select
                          value={step.notifyUserId}
                          onChange={(e) => handleStepChange(idx, 'notifyUserId', e.target.value)}
                          className="w-full bg-[#0D1424] border border-[#243350] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          {users.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Timeout (Minutes)</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={step.timeoutMinutes}
                          onChange={(e) =>
                            handleStepChange(idx, 'timeoutMinutes', Number(e.target.value))
                          }
                          className="w-full bg-[#0D1424] border border-[#243350] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          disabled={steps.length <= 1}
                          className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40"
                >
                  {isSubmitting ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
