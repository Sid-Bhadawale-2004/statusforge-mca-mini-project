import React, { useState } from 'react';
import { X, Send, Terminal, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Copy, Check } from 'lucide-react';
import { ServiceItem } from '../types/index.js';
import { API_BASE, API_ORIGIN, api } from '../services/api.js';

interface WebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceItem[];
  preselectedServiceId?: string;
  onSuccess?: () => void;
}

export const WebhookSimulatorModal: React.FC<WebhookSimulatorModalProps> = ({
  isOpen,
  onClose,
  services,
  preselectedServiceId,
  onSuccess,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preselectedServiceId || (services[0]?._id ?? '')
  );
  const [preset, setPreset] = useState<string>('p1_segfault');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentService = services.find((s) => s._id === selectedServiceId) || services[0];
  const webhookSecret = currentService?.webhookSecret || '<SERVICE_WEBHOOK_SECRET>';
  const serviceId = currentService?._id || 'SERVICE_ID';

  const presets: Record<string, { title: string; desc: string; sev: string; status: string; extId: string }> = {
    p1_segfault: {
      title: 'CRITICAL: Ingress Gateway Pods CrashLoopBackOff',
      desc: 'Memory buffer overflow in HTTP/2 stream decoding. 503 error rate currently at 64%.',
      sev: 'P1',
      status: 'firing',
      extId: `dd-alert-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    p2_dbpool: {
      title: 'Database Connection Pool Exhaustion (>95% Active)',
      desc: 'Primary PostgreSQL replica pool depleted. Query latency p99 spiked to 4,200ms.',
      sev: 'P2',
      status: 'firing',
      extId: `prom-dbpool-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    p3_memory: {
      title: 'Node Resident Memory Above Warning Threshold (>85%)',
      desc: 'Container node cgroup memory utilization exceeds 85% for 10 consecutive minutes.',
      sev: 'P3',
      status: 'firing',
      extId: `prom-mem-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    resolve_recovery: {
      title: 'Ingress Gateway Pods Health Restored (Auto-Recovery)',
      desc: 'All pods returned to 1/1 Running state. Latency normalized to 18ms baseline.',
      sev: 'P1',
      status: 'resolved',
      extId: `dd-alert-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  };

  const activePreset = presets[preset] || presets.p1_segfault;

  const payloadObj = customPayload
    ? JSON.parse(customPayload || '{}')
    : {
        title: activePreset.title,
        description: activePreset.desc,
        severity: activePreset.sev,
        status: activePreset.status,
        externalId: activePreset.extId,
        source: 'statusforge_simulator',
        timestamp: new Date().toISOString(),
      };

  const webhookUrl = `${API_ORIGIN || window.location.origin}${API_BASE}/webhooks/services/${serviceId}`;
  const curlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: ${webhookSecret}" \\
  -d '${JSON.stringify(payloadObj, null, 2)}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!currentService) return;
    setIsLoading(true);
    setResult(null);

    try {
      const response = await api.webhooks.trigger(currentService._id, currentService.webhookSecret, payloadObj);
      setResult(response);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'Webhook simulation error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#0D1322] border border-[#1E293B] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] bg-[#0A0F1D]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Monitoring Webhook Simulator</h3>
              <p className="text-xs text-slate-400">
                Simulate inbound alerts from Datadog, Prometheus, Grafana, or AWS CloudWatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Service Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Monitored Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
            >
              {services.map((svc) => (
                <option key={svc._id} value={svc._id}>
                  {svc.name} ({svc.currentStatus.toUpperCase()} - Secret: {svc.webhookSecret.substring(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Alert Presets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Alert Scenario
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPreset('p1_segfault');
                  setCustomPayload('');
                }}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  preset === 'p1_segfault'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : 'bg-[#141C2E] border-[#26354D] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  P1 Critical Ingress Outage
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">Envoy proxy segfault & 503 storm</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreset('p2_dbpool');
                  setCustomPayload('');
                }}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  preset === 'p2_dbpool'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-[#141C2E] border-[#26354D] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  P2 DB Pool Exhausted
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">Postgres pool &gt;95% saturation</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreset('p3_memory');
                  setCustomPayload('');
                }}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  preset === 'p3_memory'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'bg-[#141C2E] border-[#26354D] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  P3 High Node Memory (&gt;85%)
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">Cgroup memory warning alert</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreset('resolve_recovery');
                  setCustomPayload('');
                }}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  preset === 'resolve_recovery'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#141C2E] border-[#26354D] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-Resolve Recovery
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">Healthy signal resolves open incident</div>
              </button>
            </div>
          </div>

          {/* cURL Command Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Exact cURL Request
              </label>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to Clipboard' : 'Copy cURL'}
              </button>
            </div>
            <pre className="bg-[#060911] border border-[#1A2336] rounded-xl p-3 text-[11px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {curlCommand}
            </pre>
          </div>

          {/* Server Response Card */}
          {result && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Simulator Response (Status: {result.success ? '200 OK / 201 Created' : 'Error'})
              </label>
              <pre
                className={`border rounded-xl p-3 text-[11px] font-mono overflow-x-auto ${
                  result.success
                    ? 'bg-[#081812] border-emerald-500/30 text-emerald-300'
                    : 'bg-[#1D0E12] border-rose-500/30 text-rose-300'
                }`}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1E293B] bg-[#0A0F1D]">
          <span className="text-xs text-slate-400">
            Auth: <span className="font-mono text-slate-300">X-Webhook-Secret</span> header validated
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || !currentService}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-900/30 disabled:opacity-50 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Triggering...' : 'Dispatch Test Alert'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
