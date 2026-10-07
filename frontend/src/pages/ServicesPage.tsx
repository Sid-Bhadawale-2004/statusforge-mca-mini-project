import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  Shield,
  Clock,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { ServiceItem, ServiceStatus } from '../types/index.js';
import { WebhookSimulatorModal } from '../components/WebhookSimulatorModal.js';

export const ServicesPage: React.FC = () => {
  const { user, socket } = useAuth();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simServiceId, setSimServiceId] = useState<string | undefined>(undefined);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialStatus, setInitialStatus] = useState<ServiceStatus>('operational');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visible secrets & copied state
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const data = await api.services.list();
      setServices(data);
    } catch (err) {
      console.error('[ServicesPage] Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadServices();
    socket.on('service:updated', handleUpdate);
    return () => {
      socket.off('service:updated', handleUpdate);
    };
  }, [socket, loadServices]);

  const handleStatusChange = async (serviceId: string, newStatus: ServiceStatus) => {
    if (user?.role === 'viewer') return;
    try {
      await api.services.update(serviceId, { currentStatus: newStatus });
      await loadServices();
    } catch (err) {
      console.error('[ServicesPage] Failed to update service status:', err);
    }
  };

  const handleRotateSecret = async (serviceId: string) => {
    if (user?.role === 'viewer') return;
    const confirmRotate = window.confirm(
      'Are you sure you want to rotate the webhook secret? Any existing monitoring integrations using the current secret must be updated.'
    );
    if (!confirmRotate) return;

    try {
      await api.services.rotateWebhook(serviceId);
      await loadServices();
    } catch (err) {
      console.error('[ServicesPage] Failed to rotate secret:', err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (user?.role !== 'admin') return;
    const confirmDel = window.confirm(
      'Are you sure you want to delete this service? This will remove its on-call schedules and escalation policies.'
    );
    if (!confirmDel) return;

    try {
      await api.services.delete(serviceId);
      await loadServices();
    } catch (err) {
      console.error('[ServicesPage] Failed to delete service:', err);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await api.services.create({
        name: name.trim(),
        description: description.trim(),
        currentStatus: initialStatus,
      });
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      await loadServices();
    } catch (err) {
      console.error('[ServicesPage] Failed to create service:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Outfit'] text-white tracking-tight flex items-center gap-2">
            Monitored Microservices
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1A2640] text-slate-300 font-semibold font-mono">
              {services.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure telemetry ingress endpoints, webhook secrets, and instant health status overrides
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadServices()}
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
              <span>Add New Service</span>
            </button>
          )}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((svc) => {
          const webhookUrl = `${window.location.origin}/api/v1/webhooks/services/${svc._id}`;
          const isSecretVisible = visibleSecrets[svc._id] || false;

          return (
            <div
              key={svc._id}
              className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-5 hover:border-[#2C3E63] transition shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Title & Status Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-slate-400" />
                      {svc.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {svc.description || 'Continuous monitoring active.'}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
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

                {/* Health State Toggles */}
                {user?.role !== 'viewer' && (
                  <div className="bg-[#121A2D] border border-[#1E2B45] rounded-xl p-1.5 flex items-center gap-1 text-xs">
                    {(['operational', 'degraded', 'outage'] as ServiceStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(svc._id, status)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                          svc.currentStatus === status
                            ? status === 'operational'
                              ? 'bg-emerald-600 text-white shadow'
                              : status === 'degraded'
                              ? 'bg-amber-600 text-white shadow'
                              : 'bg-rose-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}

                {/* Uptime & On-Call Summary */}
                <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-[#121A2D] border border-[#1E2B45]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">90d SLA Uptime</span>
                    <span className="font-bold text-white font-mono mt-0.5 block">
                      {svc.uptimePercentage ?? 100}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">On-Call Responder</span>
                    <span className="font-semibold text-slate-200 mt-0.5 truncate block">
                      {svc.onCallResponder?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Webhook Endpoint & Secret Integration Card */}
                <div className="rounded-xl bg-[#090E1A] border border-[#182338] p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-rose-400" />
                      Inbound Webhook Integration
                    </span>
                    <button
                      onClick={() => {
                        setSimServiceId(svc._id);
                        setSimulatorOpen(true);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Terminal className="w-3 h-3" />
                      Test Alert
                    </button>
                  </div>

                  {/* Webhook URL */}
                  <div className="flex items-center justify-between bg-[#111728] rounded-lg px-2.5 py-1.5 border border-[#1D2942]">
                    <span className="font-mono text-[11px] text-slate-300 truncate max-w-[280px]">
                      {webhookUrl}
                    </span>
                    <button
                      onClick={() => copyToClipboard(webhookUrl, `url-${svc._id}`)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Copy URL"
                    >
                      {copiedId === `url-${svc._id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Webhook Secret */}
                  <div className="flex items-center justify-between bg-[#111728] rounded-lg px-2.5 py-1.5 border border-[#1D2942]">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Secret:</span>
                      <span className="font-mono text-[11px] text-emerald-400">
                        {isSecretVisible ? svc.webhookSecret : '••••••••••••••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => toggleSecretVisibility(svc._id)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        {isSecretVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(svc.webhookSecret, `sec-${svc._id}`)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        {copiedId === `sec-${svc._id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#172238] text-xs">
                {user?.role !== 'viewer' ? (
                  <button
                    onClick={() => handleRotateSecret(svc._id)}
                    className="text-slate-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rotate Secret</span>
                  </button>
                ) : (
                  <span />
                )}

                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleDeleteService(svc._id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Delete Service"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Service Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-rose-500" />
                Add Monitored Microservice
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. User Authentication API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Functionality and SLA commitments for this service..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Initial Status
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as ServiceStatus)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded</option>
                  <option value="outage">Outage</option>
                </select>
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/40"
                >
                  {isSubmitting ? 'Creating...' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webhook Simulator Modal */}
      <WebhookSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        services={services}
        preselectedServiceId={simServiceId}
        onSuccess={() => loadServices()}
      />
    </div>
  );
};
