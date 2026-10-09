import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Server,
  Clock,
  Radio,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api.js';
import { API_ORIGIN } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { PublicStatusResponse, ServiceStatus } from '../types/index.js';

export const PublicStatusPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { organization: contextOrganization, isAuthenticated, isLoading: authLoading } = useAuth();
  const activeSlug = slug || (isAuthenticated ? contextOrganization?.slug : '') || '';

  const [data, setData] = useState<PublicStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!activeSlug) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.public.getStatus(activeSlug);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Status page not found');
    } finally {
      setLoading(false);
    }
  }, [activeSlug]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Connect to live public status socket room
  useEffect(() => {
    if (!activeSlug) return;

    const socket = io(API_ORIGIN || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join:status', activeSlug);
    });

    socket.on('status:update', () => {
      loadStatus();
    });

    socket.on('status:service:updated', () => {
      loadStatus();
    });

    return () => {
      socket.emit('leave:status', activeSlug);
      socket.disconnect();
    };
  }, [activeSlug, loadStatus]);

  if (loading || (!slug && authLoading)) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-rose-500" />
        Loading real-time status page...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-white font-['Outfit']">
          {activeSlug ? 'Status Page Not Found' : 'Organization Status Link Required'}
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          {activeSlug
            ? `No organization found matching slug '${activeSlug}'. Please check the URL or contact system administration.`
            : 'A public status page needs an organization-specific URL. Ask an organization member to share their Public Status link.'}
        </p>
        <Link
          to="/"
          className="mt-5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
        >
          Return to Platform
        </Link>
      </div>
    );
  }

  const { organization, overallHealth, overallStatusCode, services, activeIncidents, incidentHistory } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-[#E2E8F0] font-sans selection:bg-rose-500/30 selection:text-rose-200">
      {/* Top Navbar */}
      <header className="border-b border-[#141D30] bg-[#0A0F1D]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-[#070B14] rounded-[10px] flex items-center justify-center">
                <Radio className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-['Outfit'] tracking-tight">
                {organization.name}
              </h1>
              <p className="text-[11px] text-slate-400">Live Service Status & Incident Telemetry</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={() => loadStatus()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#121A2D] hover:bg-[#1A253E] border border-[#1E2B45] text-slate-300 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <Link
              to="/auth"
              className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold transition"
            >
              Staff Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Overall Health Status Banner */}
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-2xl flex items-center justify-between ${
            overallStatusCode === 'operational'
              ? 'bg-gradient-to-r from-[#0B2418] via-[#0D1C24] to-[#0A1324] border-emerald-500/40 text-emerald-300'
              : overallStatusCode === 'degraded'
              ? 'bg-gradient-to-r from-[#291B0B] via-[#1D171C] to-[#0A1324] border-amber-500/40 text-amber-300'
              : 'bg-gradient-to-r from-[#2E0F14] via-[#1E1120] to-[#0A1324] border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                overallStatusCode === 'operational'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : overallStatusCode === 'degraded'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {overallStatusCode === 'operational' && <CheckCircle2 className="w-7 h-7" />}
              {overallStatusCode === 'degraded' && <AlertTriangle className="w-7 h-7" />}
              {overallStatusCode === 'outage' && <ShieldAlert className="w-7 h-7" />}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-white">
                {overallHealth}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Updated {new Date(organization.updatedAt).toLocaleTimeString()} ({organization.timezone})
              </p>
            </div>
          </div>
        </div>

        {/* Active Incidents Banner */}
        {activeIncidents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold font-['Outfit'] uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              Active Incident Reports ({activeIncidents.length})
            </h3>

            <div className="space-y-4">
              {activeIncidents.map((inc) => (
                <div
                  key={inc._id}
                  className="rounded-2xl bg-[#0E1526] border border-rose-500/40 p-5 sm:p-6 space-y-4 shadow-xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A253E] pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {inc.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-600 text-white">
                          {inc.status}
                        </span>
                        <h4 className="text-base font-bold text-white">{inc.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Affected Service: <span className="text-slate-200 font-semibold">{inc.serviceName}</span>
                      </p>
                    </div>

                    <span className="text-xs font-mono text-slate-400">
                      Started: {new Date(inc.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{inc.description}</p>

                  {/* Public Updates Log */}
                  {inc.updates && inc.updates.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#172238]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Public Updates
                      </span>
                      <div className="space-y-2">
                        {inc.updates.map((up) => (
                          <div key={up._id} className="text-xs p-3 rounded-xl bg-[#121A2D] border border-[#1E2B45] space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span className="font-semibold text-rose-300 capitalize">{up.type}</span>
                              <span>{new Date(up.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-slate-200">{up.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monitored Services List */}
        <div className="rounded-2xl bg-[#0D1424] border border-[#18233A] p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1A253E] pb-3">
            <h3 className="text-base font-bold font-['Outfit'] text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-400" />
              Core Infrastructure Services
            </h3>
            <span className="text-xs text-slate-400 font-mono">90-Day Metrics</span>
          </div>

          <div className="divide-y divide-[#152035]">
            {services.map((svc) => (
              <div key={svc._id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white text-sm">{svc.name}</span>
                    <span className="text-xs font-mono text-slate-400">({svc.uptimePercentage ?? 100}% uptime)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{svc.description}</p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${
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
                  {svc.publicStateLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Past 7 Days Incident History */}
        <div className="rounded-2xl bg-[#0D1424] border border-[#18233A] p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1A253E] pb-3">
            <h3 className="text-base font-bold font-['Outfit'] text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Past 7 Days Incident Archive
            </h3>
            <span className="text-xs text-slate-400 font-mono">{incidentHistory.length} Resolved</span>
          </div>

          {incidentHistory.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              No incidents reported in the past 7 days. 100% operational integrity maintained.
            </p>
          ) : (
            <div className="space-y-4">
              {incidentHistory.map((inc) => (
                <div key={inc._id} className="p-4 rounded-xl bg-[#090F1E] border border-[#19243C] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300">
                        Resolved
                      </span>
                      <span className="font-bold text-white">{inc.title}</span>
                      <span className="text-slate-400 font-mono">#{inc.incidentNumber}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(inc.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-slate-300">{inc.description}</p>

                  {inc.rootCauseSummary && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-200">
                      <span className="font-semibold text-emerald-400 block text-[10px] uppercase">Root Cause:</span>
                      {inc.rootCauseSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-[#131B2D] text-xs text-slate-500 space-y-1">
          <p>StatusForge Incident Intelligence Engine &copy; 2026</p>
          <p className="text-[11px]">Subscribed to continuous automated status telemetry</p>
        </footer>
      </main>
    </div>
  );
};
