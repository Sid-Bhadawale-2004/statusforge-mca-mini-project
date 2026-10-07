import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  ArrowUpRight,
  Filter,
  Plus,
  Server,
  User as UserIcon,
  Bell,
  Check,
  X,
  FileText,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Incident, ServiceItem, IncidentSeverity, IncidentStatus } from '../types/index.js';

export const IncidentsPage: React.FC = () => {
  const { user, socket } = useAuth();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & form state
  const [newIncidentModalOpen, setNewIncidentModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [rootCauseText, setRootCauseText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New incident form state
  const [newServiceId, setNewServiceId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('P2');

  const loadIncidents = useCallback(async () => {
    try {
      const data = await api.incidents.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
      });
      setIncidents(data);
      if (!selectedIncidentId && data.length > 0) {
        setSelectedIncidentId(data[0]._id);
      }
    } catch (err) {
      console.error('[IncidentsPage] Failed to load incidents:', err);
    }
  }, [statusFilter, severityFilter, selectedIncidentId]);

  const loadServices = useCallback(async () => {
    try {
      const svcs = await api.services.list();
      setServices(svcs);
      if (svcs.length > 0 && !newServiceId) {
        setNewServiceId(svcs[0]._id);
      }
    } catch (err) {
      console.error('[IncidentsPage] Failed to load services:', err);
    }
  }, [newServiceId]);

  const loadIncidentDetail = useCallback(async (id: string) => {
    try {
      const detail = await api.incidents.get(id);
      setSelectedIncident(detail);
    } catch (err) {
      console.error('[IncidentsPage] Failed to load incident detail:', err);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
    loadServices();
  }, [loadIncidents, loadServices]);

  useEffect(() => {
    if (selectedIncidentId) {
      loadIncidentDetail(selectedIncidentId);
    }
  }, [selectedIncidentId, loadIncidentDetail]);

  // Realtime updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updatedInc: any) => {
      loadIncidents();
      if (selectedIncidentId && (updatedInc._id === selectedIncidentId || updatedInc.incidentId === selectedIncidentId)) {
        loadIncidentDetail(selectedIncidentId);
      }
    };

    socket.on('incident:created', handleUpdate);
    socket.on('incident:updated', handleUpdate);
    socket.on('incident:resolved', handleUpdate);

    return () => {
      socket.off('incident:created', handleUpdate);
      socket.off('incident:updated', handleUpdate);
      socket.off('incident:resolved', handleUpdate);
    };
  }, [socket, selectedIncidentId, loadIncidents, loadIncidentDetail]);

  const handleAcknowledge = async () => {
    if (!selectedIncidentId || user?.role === 'viewer') return;
    setIsSubmitting(true);
    try {
      await api.incidents.acknowledge(selectedIncidentId);
      await loadIncidentDetail(selectedIncidentId);
      await loadIncidents();
    } catch (err) {
      console.error('[IncidentsPage] Acknowledge error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIncidentId || user?.role === 'viewer') return;
    setIsSubmitting(true);
    try {
      await api.incidents.resolve(selectedIncidentId, { rootCauseSummary: rootCauseText });
      setResolveModalOpen(false);
      setRootCauseText('');
      await loadIncidentDetail(selectedIncidentId);
      await loadIncidents();
    } catch (err) {
      console.error('[IncidentsPage] Resolve error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedIncidentId || user?.role === 'viewer') return;
    setIsSubmitting(true);
    try {
      await api.incidents.escalate(selectedIncidentId);
      await loadIncidentDetail(selectedIncidentId);
      await loadIncidents();
    } catch (err) {
      console.error('[IncidentsPage] Escalate error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId || !commentText.trim()) return;
    setIsSubmitting(true);
    try {
      await api.incidents.addComment(selectedIncidentId, commentText);
      setCommentText('');
      await loadIncidentDetail(selectedIncidentId);
    } catch (err) {
      console.error('[IncidentsPage] Add comment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceId || !newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await api.incidents.create({
        serviceId: newServiceId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        severity: newSeverity,
      });
      setNewIncidentModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setSelectedIncidentId(created._id);
      await loadIncidents();
    } catch (err) {
      console.error('[IncidentsPage] Create incident error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.incidentNumber.toString().includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Left Column: Incidents List & Filters */}
      <div className="w-full md:w-96 border-r border-[#172238] bg-[#0A0F1E] flex flex-col shrink-0">
        {/* Top filter toolbar */}
        <div className="p-4 border-b border-[#172238] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-['Outfit'] text-white">Incident Queue</h2>
            {user?.role !== 'viewer' && (
              <button
                onClick={() => setNewIncidentModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trigger</span>
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Search incident title or #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#131C30] border border-[#202E4C] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="triggered">Triggered</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#131C30] border border-[#202E4C] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Severities</option>
              <option value="P1">P1 Critical</option>
              <option value="P2">P2 High</option>
              <option value="P3">P3 Medium</option>
              <option value="P4">P4 Low</option>
            </select>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#141E33]">
          {filteredList.map((inc) => {
            const isSelected = inc._id === selectedIncidentId;
            return (
              <div
                key={inc._id}
                onClick={() => setSelectedIncidentId(inc._id)}
                className={`p-4 transition cursor-pointer space-y-2 ${
                  isSelected ? 'bg-[#152038] border-l-4 border-l-rose-500' : 'hover:bg-[#0E1526]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inc.severity === 'P1'
                          ? 'bg-rose-500/20 text-rose-400'
                          : inc.severity === 'P2'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        inc.status === 'triggered'
                          ? 'bg-rose-600 text-white'
                          : inc.status === 'acknowledged'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">#{inc.incidentNumber}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-white line-clamp-1">{inc.title}</h4>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[160px]">{inc.serviceId?.name || 'Service'}</span>
                  <span className="truncate max-w-[100px] text-slate-300">
                    {inc.assignedUserId?.name?.split(' ')[0] || 'Unassigned'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Incident War-Room */}
      <div className="flex-1 bg-[#090D16] overflow-y-auto p-4 md:p-8 space-y-6">
        {selectedIncident ? (
          <>
            {/* War-Room Header Card */}
            <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        selectedIncident.severity === 'P1'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : selectedIncident.severity === 'P2'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {selectedIncident.severity}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        selectedIncident.status === 'triggered'
                          ? 'bg-rose-600 text-white animate-pulse'
                          : selectedIncident.status === 'acknowledged'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {selectedIncident.status}
                    </span>

                    <span className="text-xs font-mono text-slate-400">
                      Incident #{selectedIncident.incidentNumber}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold font-['Outfit'] text-white">
                    {selectedIncident.title}
                  </h2>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    {selectedIncident.description || 'No description provided.'}
                  </p>
                </div>

                {/* War-Room Action Buttons */}
                {user?.role !== 'viewer' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedIncident.status === 'triggered' && (
                      <button
                        onClick={handleAcknowledge}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-950/40 flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    {selectedIncident.status !== 'resolved' && (
                      <button
                        onClick={() => setResolveModalOpen(true)}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}

                    {selectedIncident.status !== 'resolved' && (
                      <button
                        onClick={handleEscalate}
                        disabled={isSubmitting}
                        className="px-3.5 py-2 rounded-xl bg-[#1A253E] hover:bg-[#233152] border border-[#2B3B5E] text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>Escalate Step</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Incident Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#172238] text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Service</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    {selectedIncident.serviceId?.name || 'Unknown'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Assigned Responder</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    {selectedIncident.assignedUserId?.name || 'Unassigned'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Trigger Source</span>
                  <span className="font-mono text-slate-300 mt-0.5 block">
                    {selectedIncident.source || 'manual'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Triggered At</span>
                  <span className="text-slate-300 mt-0.5 block">
                    {new Date(selectedIncident.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Root Cause Banner (if resolved) */}
              {selectedIncident.rootCauseSummary && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Root Cause Summary
                  </span>
                  <p className="text-xs text-emerald-200">{selectedIncident.rootCauseSummary}</p>
                </div>
              )}
            </div>

            {/* Escalation Ladder Visualizer */}
            {selectedIncident.escalationPolicy && selectedIncident.escalationPolicy.steps?.length > 0 && (
              <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    Escalation Chain: {selectedIncident.escalationPolicy.name}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Step {selectedIncident.currentEscalationStep + 1} of{' '}
                    {selectedIncident.escalationPolicy.steps.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedIncident.escalationPolicy.steps.map((step: any, idx: number) => {
                    const isCurrent = idx === selectedIncident.currentEscalationStep;
                    const isPassed = idx < selectedIncident.currentEscalationStep;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs transition ${
                          isCurrent
                            ? 'bg-rose-500/10 border-rose-500/40 text-white'
                            : isPassed
                            ? 'bg-[#121B2F] border-slate-700/50 text-slate-400'
                            : 'bg-[#0B101D] border-[#1C2842] text-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-1">
                          <span>Step {step.order}: {step.timeoutMinutes}m timeout</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white uppercase">
                              Active Step
                            </span>
                          )}
                          {isPassed && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-slate-300 font-medium">
                          {step.notifyUserId?.name || 'On-Call Responder'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase font-mono">
                          Channel: Email
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* War-Room Immutable Timeline */}
            <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#1C2842] pb-3">
                <h3 className="text-sm font-bold font-['Outfit'] text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  Incident Audit Timeline & Updates
                </h3>
                <span className="text-xs text-slate-400">
                  {selectedIncident.events?.length || 0} Events Logged
                </span>
              </div>

              {/* Timeline Items */}
              <div className="space-y-4">
                {selectedIncident.events?.map((ev: any) => (
                  <div key={ev._id} className="flex items-start space-x-3 text-xs">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        ev.type === 'created'
                          ? 'bg-rose-500/20 text-rose-400'
                          : ev.type === 'acknowledged'
                          ? 'bg-amber-500/20 text-amber-400'
                          : ev.type === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : ev.type === 'escalated'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {ev.type === 'created' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {ev.type === 'acknowledged' && <Check className="w-3.5 h-3.5" />}
                      {ev.type === 'resolved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {ev.type === 'escalated' && <ArrowUpRight className="w-3.5 h-3.5" />}
                      {ev.type === 'comment' && <MessageSquare className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex-1 rounded-xl bg-[#131C30] border border-[#1E2B45] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white capitalize">
                          {ev.actorUserId?.name || 'System Automation'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{ev.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Comment Input Form */}
              <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Post an internal update to the incident timeline..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-[#131C30] border border-[#202E4C] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 disabled:opacity-50 flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
            Select an incident from the queue to view war-room details.
          </div>
        )}
      </div>

      {/* Trigger New Incident Modal */}
      {newIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Trigger Manual Incident
              </h3>
              <button
                onClick={() => setNewIncidentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Target Service
                </label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
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
                  Severity Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['P1', 'P2', 'P3', 'P4'] as IncidentSeverity[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setNewSeverity(sev)}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        newSeverity === sev
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                          : 'bg-[#141C2E] text-slate-400 hover:text-white border border-[#26354D]'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Incident Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ingress latency spike >500ms"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Technical Details & Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed telemetry, observed error messages, affected regions..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setNewIncidentModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40"
                >
                  {isSubmitting ? 'Triggering...' : 'Trigger Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Resolve Incident #{selectedIncident?.incidentNumber}
              </h3>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Root Cause Analysis / Summary
                </label>
                <textarea
                  rows={4}
                  placeholder="Document the underlying failure root cause, mitigation steps performed, and follow-up work..."
                  value={rootCauseText}
                  onChange={(e) => setRootCauseText(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Resolving this incident will restore the service health status to{' '}
                <span className="text-emerald-400 font-semibold">Operational</span> if no other open
                incidents remain, and close the escalation policy timer.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40"
                >
                  {isSubmitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
