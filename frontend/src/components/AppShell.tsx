import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  Activity,
  Server,
  Clock,
  GitBranch,
  Users,
  ExternalLink,
  Radio,
  LogOut,
  ChevronDown,
  Terminal,
  Bell,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { UserRole, ServiceItem } from '../types/index.js';
import { WebhookSimulatorModal } from './WebhookSimulatorModal.js';
import { api } from '../services/api.js';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, organization, logout, switchDemoRole, socket } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState<number>(0);

  // Load services for webhook simulator & active incident counts
  const loadServicesAndAlerts = async () => {
    try {
      const svcs = await api.services.list();
      setServices(svcs);

      const incidents = await api.incidents.list({ status: 'triggered' });
      setUnacknowledgedCount(incidents.length);
    } catch (err) {
      console.warn('[AppShell] Failed to fetch services or incidents:', err);
    }
  };

  useEffect(() => {
    loadServicesAndAlerts();
  }, [location.pathname]);

  // Listen to live socket events for badges
  useEffect(() => {
    if (!socket) return;

    const handleIncidentUpdate = () => {
      loadServicesAndAlerts();
    };

    socket.on('incident:created', handleIncidentUpdate);
    socket.on('incident:updated', handleIncidentUpdate);
    socket.on('incident:resolved', handleIncidentUpdate);

    return () => {
      socket.off('incident:created', handleIncidentUpdate);
      socket.off('incident:updated', handleIncidentUpdate);
      socket.off('incident:resolved', handleIncidentUpdate);
    };
  }, [socket]);

  const navLinks = [
    { to: '/', label: 'Command Center', icon: Activity },
    {
      to: '/incidents',
      label: 'Incidents War-Room',
      icon: ShieldAlert,
      badge: unacknowledgedCount > 0 ? unacknowledgedCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { to: '/services', label: 'Services Health', icon: Server },
    { to: '/schedules', label: 'On-Call Rotations', icon: Clock },
    { to: '/policies', label: 'Escalation Policies', icon: GitBranch },
    { to: '/users', label: 'Team & Access', icon: Users },
  ];

  const handleRoleChange = async (role: UserRole) => {
    setRoleDropdownOpen(false);
    await switchDemoRole(role);
  };

  const publicUrl = organization?.slug ? `/status/${organization.slug}` : '/status';

  return (
    <div className="min-h-screen bg-[#090D16] text-[#E2E8F0] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#1A2336] bg-[#0A0F1E]/95 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        {/* Left: Brand & Org Badge */}
        <div className="flex items-center space-x-4">
          <div
            onClick={() => navigate('/')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
                <Radio className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold font-['Outfit'] tracking-tight text-white flex items-center gap-1.5">
                STATUS<span className="text-rose-500">FORGE</span>
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center pl-3 border-l border-[#1E293B]">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#162035] text-slate-300 border border-[#22304C]">
              {organization?.name || 'Organization'}
            </span>
            <span className="ml-1.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              {organization?.plan || 'PRO'}
            </span>
          </div>
        </div>

        {/* Right: Quick actions & Demo Switcher */}
        <div className="flex items-center space-x-3">
          {/* Unacknowledged Alert Pill */}
          {unacknowledgedCount > 0 && (
            <button
              onClick={() => navigate('/incidents')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium radar-badge cursor-pointer hover:bg-rose-500/25 transition"
            >
              <Bell className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
              <span>{unacknowledgedCount} Unacknowledged Alert{unacknowledgedCount > 1 ? 's' : ''}</span>
            </button>
          )}

          {/* Webhook Simulator Trigger */}
          <button
            onClick={() => setSimulatorOpen(true)}
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#131B2D] hover:bg-[#1A253E] border border-[#22304D] text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-rose-400" />
            <span>Webhook Simulator</span>
          </button>

          {/* Public Status Page Button */}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#131B2D] hover:bg-[#1A253E] border border-[#22304D] text-slate-300 text-xs font-medium transition"
          >
            <span>Public Status</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Demo Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#151E33] border border-[#243352] text-xs font-medium text-slate-200 hover:border-slate-500 transition"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  user?.role === 'admin'
                    ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                    : user?.role === 'responder'
                    ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                    : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                }`}
              />
              <span className="capitalize font-semibold">{user?.role || 'Guest'}</span>
              <span className="text-slate-400 font-normal hidden md:inline">({user?.name?.split(' ')[0]})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0D1424] border border-[#23324E] shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-[#1A263D] mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    One-Click Role Switcher
                  </p>
                  <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                    Active: {user?.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    user?.role === 'admin'
                      ? 'bg-rose-500/15 text-rose-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Admin</span>
                  </div>
                  {user?.role === 'admin' && <CheckCircle className="w-3.5 h-3.5 text-rose-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('responder')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    user?.role === 'responder'
                      ? 'bg-amber-500/15 text-amber-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Responder</span>
                  </div>
                  {user?.role === 'responder' && <CheckCircle className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('viewer')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    user?.role === 'viewer'
                      ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Viewer</span>
                  </div>
                  {user?.role === 'viewer' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <div className="border-t border-[#1A263D] mt-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      logout();
                      navigate('/auth');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 border-r border-[#172033] bg-[#0A0E1A] hidden md:flex flex-col justify-between p-3 shrink-0">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Operations Hub
            </div>
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-rose-600/15 text-rose-300 font-semibold border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#12192B]'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Quick simulator shortcut box */}
          <div className="p-3 rounded-2xl bg-[#0F1626] border border-[#1C263A] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Inbound Webhooks</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Verify Datadog, Prometheus, or Grafana alert routing.
            </p>
            <button
              onClick={() => setSimulatorOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-[#1A253D] hover:bg-[#233152] text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Alert</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#090D16]">
          {children}
        </main>
      </div>

      {/* Simulator Modal */}
      <WebhookSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        services={services}
        onSuccess={() => loadServicesAndAlerts()}
      />
    </div>
  );
};
