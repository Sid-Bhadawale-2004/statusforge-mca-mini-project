import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import {
  Radio,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';

export const AuthPage: React.FC = () => {
  const { login, signup, loginWithGoogle, acceptInvitation } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invitationToken = searchParams.get('inviteToken') || '';
  const initialResetToken = searchParams.get('resetToken') || '';

  const [tab, setTab] = useState<'login' | 'signup' | 'forgot' | 'invite'>(() =>
    invitationToken ? 'invite' : initialResetToken ? 'forgot' : 'login'
  );
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Signup form
  const [orgName, setOrgName] = useState<string>('');
  const [orgSlug, setOrgSlug] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [resetToken] = useState<string>(initialResetToken);
  const [newPassword, setNewPassword] = useState<string>('');
  const [invitePassword, setInvitePassword] = useState('');
  const [confirmInvitePassword, setConfirmInvitePassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({
        orgName,
        orgSlug: orgSlug || undefined,
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create organization.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(forgotEmail);
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.auth.resetPassword({ token: resetToken, newPassword });
      setSuccessMsg(res.message);
      setTab('login');
      setSearchParams({}, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invitePassword !== confirmInvitePassword) {
      setError('The passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await acceptInvitation(invitationToken, invitePassword);
      setSearchParams({}, { replace: true });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Could not accept this invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col justify-center items-center p-4 selection:bg-rose-500/30 selection:text-rose-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/20 via-transparent to-transparent" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2.5 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-xl shadow-rose-950/50">
              <div className="w-full h-full bg-[#070B14] rounded-[14px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <span className="text-2xl font-bold font-['Outfit'] tracking-tight text-white">
              STATUS<span className="text-rose-500">FORGE</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Incident Management & Real-time Communication Engine
          </p>
        </div>

        {/* Auth Box */}
        <div className="bg-[#0E1526] border border-[#1C2842] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Tabs */}
          {tab === 'login' || tab === 'signup' ? (
            <div className="flex bg-[#0A0F1D] p-1 rounded-2xl border border-[#1A253A] text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                  setSuccessMsg('');
                  setSearchParams({}, { replace: true });
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  tab === 'login' ? 'bg-[#18233C] text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setError('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  tab === 'signup' ? 'bg-[#18233C] text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                New Organization
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-1 border-b border-[#1A253A]">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              <span className="text-xs font-bold text-white font-['Outfit']">
                {tab === 'invite' ? 'Accept Team Invitation' : 'Password Recovery'}
              </span>
            </div>
          )}

          {/* Feedback Banners */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          {tab !== 'forgot' && tab !== 'invite' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(response) => {
                    if (!response.credential) {
                      setError('Google did not return a sign-in credential. Please try again.');
                      return;
                    }
                    void handleGoogleCredential(response.credential);
                  }}
                  onError={() => setError('Google sign-in could not be completed. Please try again.')}
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                  text="continue_with"
                />
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#1C2842] w-full" />
                <span className="bg-[#0E1526] px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider absolute">
                  or with email
                </span>
              </div>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    placeholder="admin@acme.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setError('');
                      setSuccessMsg('');
                      setForgotEmail(loginEmail);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : tab === 'signup' ? (
            /* Signup Form */
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Organization Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech Global"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      if (!orgSlug) {
                        setOrgSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)+/g, '')
                        );
                      }
                    }}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Public Status Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acme-tech"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
                  className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Admin Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="alex@acme.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Creating Organization...' : 'Create Organization'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : tab === 'invite' ? (
            <form onSubmit={handleAcceptInvitation} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Set a password to accept your team invitation and access StatusForge.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={invitePassword}
                  onChange={(event) => setInvitePassword(event.target.value)}
                  className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmInvitePassword}
                  onChange={(event) => setConfirmInvitePassword(event.target.value)}
                  className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !invitationToken}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {loading ? 'Accepting Invitation...' : 'Accept Invitation'}
              </button>
            </form>
          ) : (
            /* Forgot Password Flow */
            <div className="space-y-4">
              {!resetToken ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Enter the email associated with your account. We will email you a secure password reset link.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !forgotEmail}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? 'Sending...' : 'Email Reset Link'}</span>
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    Choose a new password for your StatusForge account.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      New Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password..."
                      className="w-full bg-[#131C30] border border-[#202E4C] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newPassword}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
