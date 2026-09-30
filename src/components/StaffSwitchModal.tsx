import React, { useState } from 'react';
import {
  X,
  Shield,
  Award,
  Users,
  Building,
  Coffee,
  UserCheck,
  Key,
  CheckCircle2,
  Lock,
  ArrowRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { UserRole, User } from '../types/index.ts';

interface StaffSwitchModalProps {
  currentUser: User | null;
  onSelectUser: (user: { email: string; password?: string; role: UserRole; name: string; id: string }) => void;
  onLogout: () => void;
  onOpenForgotPassword: () => void;
  onClose: () => void;
}

export const StaffSwitchModal: React.FC<StaffSwitchModalProps> = ({
  currentUser,
  onSelectUser,
  onLogout,
  onOpenForgotPassword,
  onClose,
}) => {
  const [activeMode, setActiveMode] = useState<'QUICK_SELECT' | 'PASSWORD_LOGIN'>('QUICK_SELECT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('wcr123');
  const [error, setError] = useState<string | null>(null);

  const staffProfiles = [
    {
      id: 'usr-ceo-lalit',
      name: 'Lalit Sir',
      role: 'CEO' as UserRole,
      designation: 'Chief Executive Officer',
      department: 'Executive Leadership',
      email: 'lalit@whitecollarrealty.com',
      icon: Award,
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Strategic leadership, pipeline overview, high-level approvals.',
    },
    {
      id: 'usr-cofounder-kimmi',
      name: 'Kimmi Mam',
      role: 'CO_FOUNDER' as UserRole,
      designation: 'CO-Founder',
      department: 'Executive Leadership',
      email: 'kimmi@whitecollarrealty.com',
      icon: Award,
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      description: 'Strategic advisory, Round 2 leadership interviews, candidate evaluations.',
    },
    {
      id: 'usr-hr-nisha',
      name: 'Nisha',
      role: 'HR' as UserRole,
      designation: 'Senior HR Manager',
      department: 'HR & Recruitment',
      email: 'nisha@whitecollarrealty.com',
      icon: Users,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Intake triage, room allocations, Round 1 evaluations, HR candidate pipeline.',
    },
    {
      id: 'usr-hr-shriyanshi',
      name: 'Shriyanshi',
      role: 'HR' as UserRole,
      designation: 'HR Executive',
      department: 'HR & Recruitment',
      email: 'shriyanshi@whitecollarrealty.com',
      icon: Users,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'HR screenings, document verification, candidate coordination.',
    },
    {
      id: 'usr-admin-sameer',
      name: 'Sameer Sir',
      role: 'ADMIN' as UserRole,
      designation: 'Administrator',
      department: 'Administration & Operations',
      email: 'sameer@whitecollarrealty.com',
      icon: Shield,
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      description: 'Full admin access, ID & password management, security audit, room settings.',
    },
    {
      id: 'usr-rec-ananya',
      name: 'Ananya Sen',
      role: 'RECEPTION' as UserRole,
      designation: 'Front Desk Coordinator',
      department: 'Front Desk & Reception',
      email: 'reception@whitecollarrealty.com',
      icon: Building,
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      description: 'Candidate check-in, live arrival photo capture, waiting lounge management.',
    },
    {
      id: 'usr-pan-ramesh',
      name: 'Ramesh Kumar',
      role: 'PANTRY' as UserRole,
      designation: 'Hospitality & Pantry Executive',
      department: 'Pantry & Hospitality',
      email: 'pantry@whitecollarrealty.com',
      icon: Coffee,
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      description: 'Room preparation & water hospitality tasks only (confidential data masked).',
    },
  ];

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }
      onSelectUser({
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        id: data.user.id,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Staff Identity & Dashboard Access</h2>
              <p className="text-xs text-slate-400">
                Each employee operates on their own isolated personal dashboard & permissions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveMode('QUICK_SELECT')}
            className={`pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeMode === 'QUICK_SELECT'
                ? 'border-amber-400 text-amber-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Staff Quick Switch (Isolated Accounts)
          </button>
          <button
            onClick={() => setActiveMode('PASSWORD_LOGIN')}
            className={`pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeMode === 'PASSWORD_LOGIN'
                ? 'border-amber-400 text-amber-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Password Credentials Sign-In
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeMode === 'QUICK_SELECT' ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Switching users purges client-side cached tasks and notifications, initializing a completely isolated session.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {staffProfiles.map((p) => {
                  const isCurrent = currentUser?.id === p.id || currentUser?.email === p.email;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectUser({
                          id: p.id,
                          name: p.name,
                          email: p.email,
                          role: p.role,
                          password: 'wcr123',
                        });
                        onClose();
                      }}
                      className={`p-4 rounded-2xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                {p.name}
                                {isCurrent && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Active Account" />
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-400">{p.designation}</p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${p.badgeColor}`}>
                            {p.role}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">{p.email}</span>
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          {isCurrent ? 'Active Now' : 'Sign In'} <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomLogin} className="space-y-4 max-w-md mx-auto py-2">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Staff Email or Username
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. nisha@whitecollarrealty.com or nisha.hr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenForgotPassword();
                    }}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Default test password for all staff: <strong className="text-amber-300 font-mono">wcr123</strong>
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
              >
                Sign In to Isolated Dashboard
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Active: <strong className="text-white">{currentUser?.name || 'Guest'}</strong> (
            {currentUser?.role || 'None'})
          </div>

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out & Clear Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
