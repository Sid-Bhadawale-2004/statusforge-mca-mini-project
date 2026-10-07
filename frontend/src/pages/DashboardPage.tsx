import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Activity,
  Server,
  Zap,
  Users,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Incident, ServiceItem, AnalyticsOverview } from '../types/index.js';

export const DashboardPage: React.FC = () => {
  const { user, socket } = useAuth();
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [filter, setFilter] = useState<'all' | 'triggered' | 'acknowledged'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [incData, svcData, analData] = await Promise.all([
        api.incidents.list(),
        api.services.list(),
        api.analytics.overview(),
      ]);
      setIncidents(incData);
      setServices(svcData);
      setAnalytics(analData);
    } catch (err) {
      console.error('[DashboardPage] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadData();
    };

    socket.on('incident:created', handleUpdate);
    socket.on('incident:updated', handleUpdate);
    socket.on('incident:resolved', handleUpdate);
    socket.on('service:updated', handleUpdate);

    return () => {
      socket.off('incident:created', handleUpdate);
      socket.off('incident:updated', handleUpdate);
      socket.off('incident:resolved', handleUpdate);
      socket.off('service:updated', handleUpdate);
    };
  }, [socket, loadData]);

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.role === 'viewer') return;
    setActionLoadingId(id);
    try {
      await api.incidents.acknowledge(id);
      await loadData();
    } catch (err) {
      console.error('[DashboardPage] Acknowledge failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const unacknowledgedIncidents = incidents.filter((i) => i.status === 'triggered');
  const filteredIncidents = incidents.filter((i) => {
    if (filter === 'all') return i.status !== 'resolved';
    return i.status === filter;
  });

  const avgUptime =
    services.length > 0
      ? (services.reduce((acc, s) => acc + (s.uptimePercentage || 100), 0) / services.length).toFixed(2)
      : '100.00';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner for Unacknowledged Incidents */}
      {unacknowledgedIncidents.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-rose-950/80 via-rose-900/50 to-[#121829] border border-rose-500/40 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-rose-950/30">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  Action Required: {unacknowledgedIncidents.length} Unacknowledged Incident{unacknowledgedIncidents.length > 1 ? 's' : ''}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500 text-white">
                  Escalating
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Top Alert: #{unacknowledgedIncidents[0].incidentNumber} - {unacknowledgedIncidents[0].title}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {user?.role !== 'viewer' && (
              <button
                onClick={(e) => handleAcknowledge(unacknowledgedIncidents[0]._id, e)}
                disabled={actionLoadingId === unacknowledgedIncidents[0]._id}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/40 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{actionLoadingId === unacknowledgedIncidents[0]._id ? 'Saving...' : 'Acknowledge Now'}</span>
              </button>
            )}
            <button
              onClick={() => navigate('/incidents')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1A253E] hover:bg-[#233152] text-slate-200 text-xs font-semibold border border-[#2B3B5E] flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <span>View Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header + Stats Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Outfit'] text-white tracking-tight flex items-center gap-2">
            Operations Command Center
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-service telemetry, automated escalation chains, and active triage
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
              onClick={() => navigate('/incidents')}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Trigger Manual Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Incidents */}
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-5 space-y-2 relative overflow-hidden group hover:border-[#2C3E63] transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-['Outfit']">
              {analytics?.activeIncidents ?? 0}
            </span>
            <span className="text-xs text-rose-400 font-medium">
              ({analytics?.triggeredCount ?? 0} unacked)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {analytics?.resolvedCount ?? 0} resolved in current cycle
          </p>
        </div>

        {/* Card 2: Mean Time to Acknowledge */}
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-5 space-y-2 relative overflow-hidden group hover:border-[#2C3E63] transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">MTTA (Mean Ack Time)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-['Outfit']">
              {analytics?.avgMttaSeconds ?? 0}
            </span>
            <span className="text-xs text-slate-400">seconds</span>
          </div>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            Within 5m SLA target
          </p>
        </div>

        {/* Card 3: Mean Time to Resolve */}
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-5 space-y-2 relative overflow-hidden group hover:border-[#2C3E63] transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">MTTR (Mean Resolve Time)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-['Outfit']">
              {analytics?.avgMttrMinutes ?? 0}
            </span>
            <span className="text-xs text-slate-400">minutes</span>
          </div>
          <p className="text-[11px] text-slate-400">Across all microservices</p>
        </div>

        {/* Card 4: Global Availability */}
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-5 space-y-2 relative overflow-hidden group hover:border-[#2C3E63] transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Fleet Uptime</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-['Outfit']">
              {avgUptime}%
            </span>
            <span className="text-xs text-emerald-400 font-medium">90d avg</span>
          </div>
          <p className="text-[11px] text-slate-400">{services.length} services monitored</p>
        </div>
      </div>

      {/* Main Grid: Incident Queue (Left 7 cols) & Service Health Matrix (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Incident Triage Queue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1C2842] pb-3">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold font-['Outfit'] text-white">Incident Triage Queue</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#1A2640] text-slate-300 text-xs font-semibold">
                {filteredIncidents.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-[#0D1424] border border-[#1E293B] rounded-xl p-1 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  filter === 'all' ? 'bg-[#1C2945] text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('triggered')}
                className={`px-3 py-1 rounded-lg transition ${
                  filter === 'triggered' ? 'bg-rose-600/30 text-rose-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Triggered
              </button>
              <button
                onClick={() => setFilter('acknowledged')}
                className={`px-3 py-1 rounded-lg transition ${
                  filter === 'acknowledged' ? 'bg-amber-600/30 text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Acked
              </button>
            </div>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">All Clear in This View</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active incidents currently matching filter '{filter}'. Systems are running smoothly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((incident) => {
                const serviceName = incident.serviceId?.name || 'Service';
                const assignedName = incident.assignedUserId?.name || 'Unassigned';

                return (
                  <div
                    key={incident._id}
                    onClick={() => navigate('/incidents')}
                    className="rounded-2xl bg-[#0E1526] hover:bg-[#121B30] border border-[#1C2842] hover:border-[#2C3E63] p-4.5 transition cursor-pointer space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        {/* Severity Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            incident.severity === 'P1'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : incident.severity === 'P2'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {incident.severity}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            incident.status === 'triggered'
                              ? 'bg-rose-600 text-white animate-pulse'
                              : incident.status === 'acknowledged'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {incident.status}
                        </span>

                        <span className="text-xs font-mono text-slate-500">#{incident.incidentNumber}</span>
                      </div>

                      <span className="text-[11px] text-slate-500">
                        {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-rose-400 transition">
                        {incident.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {incident.description || 'No additional details provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#172238] text-xs">
                      <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Server className="w-3 h-3 text-slate-500" />
                          {serviceName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          {assignedName}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {incident.status === 'triggered' && user?.role !== 'viewer' && (
                          <button
                            onClick={(e) => handleAcknowledge(incident._id, e)}
                            disabled={actionLoadingId === incident._id}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-semibold border border-rose-500/30 transition cursor-pointer"
                          >
                            {actionLoadingId === incident._id ? 'Acking...' : 'Acknowledge'}
                          </button>
                        )}
                        <span className="text-slate-500 hover:text-white flex items-center gap-0.5 text-[11px]">
                          War-Room <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Service Health Matrix */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1C2842] pb-3">
            <h2 className="text-base font-bold font-['Outfit'] text-white">Monitored Services</h2>
            <button
              onClick={() => navigate('/services')}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Services</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc._id}
                className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-4.5 space-y-3 hover:border-[#28395A] transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{svc.name}</h4>
                    <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                      {svc.description || 'Monitored microservice'}
                    </p>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      svc.currentStatus === 'operational'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : svc.currentStatus === 'degraded'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        svc.currentStatus === 'operational'
                          ? 'bg-emerald-400'
                          : svc.currentStatus === 'degraded'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                    {svc.currentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#172238]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Uptime</span>
                    <span className="text-xs font-semibold text-slate-200 font-mono">
                      {svc.uptimePercentage ?? 100}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Active On-Call</span>
                    <span className="text-xs font-medium text-slate-200 truncate block">
                      {svc.onCallResponder?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
