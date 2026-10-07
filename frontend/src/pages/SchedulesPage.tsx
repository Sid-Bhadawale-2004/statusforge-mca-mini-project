import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  User as UserIcon,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Server,
  ArrowRight,
  Shield,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { OnCallSchedule, ServiceItem, User, RotationType } from '../types/index.js';

export const SchedulesPage: React.FC = () => {
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form state
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [scheduleName, setScheduleName] = useState('');
  const [rotationType, setRotationType] = useState<RotationType>('weekly');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [schedData, svcData, usrData] = await Promise.all([
        api.schedules.list(),
        api.services.list(),
        api.users.list(),
      ]);
      setSchedules(schedData);
      setServices(svcData);
      setUsers(usrData);

      if (svcData.length > 0 && !selectedServiceId) {
        setSelectedServiceId(svcData[0]._id);
      }
      if (usrData.length > 0 && selectedMemberIds.length === 0) {
        setSelectedMemberIds(usrData.map((u) => u._id));
      }
    } catch (err) {
      console.error('[SchedulesPage] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, selectedMemberIds.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId || !scheduleName.trim() || selectedMemberIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.schedules.create({
        serviceId: selectedServiceId,
        name: scheduleName.trim(),
        rotationType,
        rotationMembers: selectedMemberIds,
        startDate: new Date().toISOString(),
      });
      setCreateModalOpen(false);
      setScheduleName('');
      await loadData();
    } catch (err) {
      console.error('[SchedulesPage] Create schedule error:', err);
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
            On-Call Rotations & Shifts
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1A2640] text-slate-300 font-semibold font-mono">
              {schedules.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Predictive shift calculation, engineer handoff forecasts, and automated paging targets
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
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-6">
        {schedules.map((schedule) => {
          const currentResp = schedule.currentResponder;
          const upcomingResp = schedule.upcomingResponder;

          return (
            <div
              key={schedule._id}
              className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-6 shadow-xl"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A2438] pb-4">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-white font-['Outfit']">{schedule.name}</h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#19243C] text-slate-300 border border-[#233355]">
                      {schedule.rotationType} Rotation
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-500" />
                    Bound to: <span className="text-slate-200 font-medium">{schedule.serviceName}</span>
                  </p>
                </div>

                {/* Shift Time Window */}
                <div className="text-right text-xs">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Active Shift Window</span>
                  <span className="font-mono text-slate-300">
                    {schedule.shiftStartsAt ? new Date(schedule.shiftStartsAt).toLocaleDateString() : ''} -{' '}
                    {schedule.shiftEndsAt ? new Date(schedule.shiftEndsAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>

              {/* Active Responder Hero Box + Next Up Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Responder */}
                <div className="rounded-xl bg-gradient-to-br from-[#121E36] to-[#0A101E] border border-rose-500/30 p-4 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      Active On-Call Primary
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">Paging Target</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 font-bold text-lg">
                      {currentResp ? currentResp.name.charAt(0) : '?'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {currentResp ? currentResp.name : 'No active responder'}
                      </h4>
                      <p className="text-xs text-slate-400">{currentResp?.title || 'Engineer'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1C2C4E] text-[11px] text-slate-300">
                    {currentResp?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {currentResp.email}
                      </span>
                    )}
                    {currentResp?.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {currentResp.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Upcoming Next In Line */}
                <div className="rounded-xl bg-[#0B1120] border border-[#1A253A] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Next Shift Handoff
                    </span>
                    <span className="text-[10px] text-slate-500">Upcoming</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-[#152038] border border-[#223152] flex items-center justify-center text-slate-300 font-bold text-lg">
                      {upcomingResp ? upcomingResp.name.charAt(0) : '?'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {upcomingResp ? upcomingResp.name : 'Unassigned'}
                      </h4>
                      <p className="text-xs text-slate-400">{upcomingResp?.title || 'Engineer'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#182338] text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Starts upon current shift completion
                    </span>
                  </div>
                </div>
              </div>

              {/* 5-Shift Forecast Timeline */}
              {schedule.shiftsPreview && schedule.shiftsPreview.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    5-Shift Forecast Roster
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {schedule.shiftsPreview.map((shift, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                          shift.isCurrent
                            ? 'bg-rose-500/10 border-rose-500/40 text-white'
                            : 'bg-[#0B101D] border-[#182338] text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold uppercase tracking-wider">
                            {shift.isCurrent ? 'Now' : `Shift +${idx}`}
                          </span>
                          {shift.isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </div>

                        <div className="font-bold text-slate-200 truncate">
                          {shift.responder ? shift.responder.name : 'Unassigned'}
                        </div>

                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(shift.start).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Schedule Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-500" />
                Configure On-Call Schedule
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Service
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {services.map((svc) => (
                    <option key={svc._id} value={svc._id}>
                      {svc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Schedule Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Reliability Tier-1 Rotation"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Rotation Frequency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRotationType('weekly')}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      rotationType === 'weekly'
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#141C2E] text-slate-400 hover:text-white border border-[#26354D]'
                    }`}
                  >
                    Weekly (7-day handoff)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotationType('daily')}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      rotationType === 'daily'
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#141C2E] text-slate-400 hover:text-white border border-[#26354D]'
                    }`}
                  >
                    Daily (24-hour handoff)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Rotation Members (Select Order)
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {users.map((u) => {
                    const isSelected = selectedMemberIds.includes(u._id);
                    return (
                      <div
                        key={u._id}
                        onClick={() => toggleMemberSelection(u._id)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-rose-500/10 border-rose-500/40 text-white'
                            : 'bg-[#141C2E] border-[#26354D] text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <span className="font-semibold">{u.name}</span>
                          <span className="text-[11px] text-slate-400 ml-2">({u.role})</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedMemberIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
