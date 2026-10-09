import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  RefreshCw,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { User, UserRole, AuditLogItem } from '../types/index.js';

export const UsersPage: React.FC = () => {
  const { user } = useAuth();

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('responder');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [membersData, logsData] = await Promise.all([
        api.users.list(),
        api.auditLogs.list(),
      ]);
      setTeamMembers(membersData);
      setAuditLogs(logsData);
    } catch (err) {
      console.error('[UsersPage] Failed to load users or audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    if (user?.role !== 'admin') return;
    try {
      await api.users.update(memberId, { role: newRole });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (user?.role !== 'admin') return;
    const confirmDel = window.confirm('Are you sure you want to remove this team member from the organization?');
    if (!confirmDel) return;

    try {
      await api.users.delete(memberId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await api.users.create({
        name: name.trim(),
        email: email.trim(),
        role,
        phone: phone.trim(),
        title: title.trim(),
      });
      setModalOpen(false);
      setInviteNotice(`Invitation email sent to ${email.trim()}.`);
      setName('');
      setEmail('');
      setPhone('');
      setTitle('');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Outfit'] text-white tracking-tight flex items-center gap-2">
            Team & Access Control
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1A2640] text-slate-300 font-semibold font-mono">
              {teamMembers.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage responders, assign role-based permissions (Admin, Responder, Viewer), and inspect audit trail
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

          {isAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Team Member</span>
            </button>
          )}
        </div>
      </div>

      {inviteNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{inviteNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#1E293B] pb-1">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
            activeTab === 'members'
              ? 'bg-[#18233A] text-white border border-[#26375A]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Organization Members ({teamMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[#18233A] text-white border border-[#26375A]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab Content: Members Table */}
      {activeTab === 'members' && (
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0F1D] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1C2842]">
                <tr>
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Contact Info</th>
                  <th className="px-6 py-3.5">Title / Department</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162238] text-slate-300">
                {teamMembers.map((member) => (
                  <tr key={member._id} className="hover:bg-[#121B30] transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#192642] to-[#121B30] border border-[#2A3B5F] flex items-center justify-center font-bold text-white text-xs">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{member.name}</div>
                          <div className="text-[11px] text-slate-400">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member._id, e.target.value as UserRole)}
                          className="bg-[#141C2E] border border-[#25354F] rounded-lg px-2.5 py-1 text-xs text-white capitalize focus:outline-none focus:border-rose-500"
                        >
                          <option value="admin">Admin</option>
                          <option value="responder">Responder</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            member.role === 'admin'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : member.role === 'responder'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {member.role}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{member.email}</span>
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-300">
                      {member.title || 'Team Member'}
                    </td>

                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {member._id !== user?._id && (
                          <button
                            onClick={() => handleDeleteMember(member._id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl bg-[#0E1526] border border-[#1C2842] p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold font-['Outfit'] text-white">Immutable Security Audit Logs</h3>
          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log._id}
                className="p-3.5 rounded-xl bg-[#0A0F1D] border border-[#172238] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{log.actorName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-[#162238] text-slate-400">
                      {log.actorRole}
                    </span>
                    <span className="text-rose-400 font-semibold">{log.action}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Resource: {log.resourceType} ({log.resourceId})
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-500 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0D1424] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-500" />
                Add Team Member
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Lee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jordan.lee@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 capitalize"
                  >
                    <option value="admin">Admin (Full Control)</option>
                    <option value="responder">Responder (Acknowledge & Resolve)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+1-555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Infrastructure Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#141C2E] border border-[#26354D] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
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
                  {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
