import React, { useState, useEffect } from 'react';
import {
  Shield,
  Eye,
  Settings,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Sliders,
} from 'lucide-react';
import type { AuditLog, RoleFieldVisibility, UserRole } from '../../types/index.ts';

interface AdminDashboardProps {
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'visibility' | 'audit' | 'settings'>('visibility');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [visibilitySettings, setVisibilitySettings] = useState<Record<UserRole, RoleFieldVisibility> | null>(null);
  const [qrExpiryMinutes, setQrExpiryMinutes] = useState<number>(30);
  const [autoPantry, setAutoPantry] = useState<boolean>(true);
  const [reqLivePhoto, setReqLivePhoto] = useState<boolean>(true);
  const [reqResume, setReqResume] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchSettings();
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/bootstrap');
      const data = await res.json();
      if (data.success && data.settings) {
        setVisibilitySettings(data.settings.fieldVisibility);
        if (data.settings.qrSessionExpiryMinutes) {
          setQrExpiryMinutes(data.settings.qrSessionExpiryMinutes);
        }
        if (typeof data.settings.autoAssignPantryOnRoom === 'boolean') {
          setAutoPantry(data.settings.autoAssignPantryOnRoom);
        }
        if (typeof data.settings.requireLivePhoto === 'boolean') {
          setReqLivePhoto(data.settings.requireLivePhoto);
        }
        if (typeof data.settings.requireResume === 'boolean') {
          setReqResume(data.settings.requireResume);
        }
      }
    } catch (err) {
      console.error('Failed to load bootstrap settings', err);
    }
  };

  const handleSaveOfficeSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings/office', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrSessionExpiryMinutes: qrExpiryMinutes,
          autoAssignPantryOnRoom: autoPantry,
          requireLivePhoto: reqLivePhoto,
          requireResume: reqResume,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save office settings', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleField = async (role: UserRole, field: keyof RoleFieldVisibility) => {
    if (!visibilitySettings) return;
    const currentVal = visibilitySettings[role][field];
    const updated = {
      ...visibilitySettings,
      [role]: {
        ...visibilitySettings[role],
        [field]: !currentVal,
      },
    };
    setVisibilitySettings(updated);

    // Save to server
    setSavingSettings(true);
    try {
      await fetch('/api/settings/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          config: { [field]: !currentVal },
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update visibility', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const rolesList: UserRole[] = ['HR', 'ADMIN', 'CEO', 'INTERVIEWER', 'RECEPTION', 'PANTRY'];
  const fieldsList: { key: keyof RoleFieldVisibility; label: string }[] = [
    { key: 'candidateName', label: 'Candidate Name' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'email', label: 'Email Address' },
    { key: 'address', label: 'Full Address' },
    { key: 'resume', label: 'Resume Document' },
    { key: 'livePhoto', label: 'Live Capture Photo' },
    { key: 'salary', label: 'Expected Salary' },
    { key: 'hrNotes', label: 'Internal HR Notes' },
    { key: 'interviewStatus', label: 'Interview Status' },
    { key: 'room', label: 'Assigned Room' },
    { key: 'pantryTask', label: 'Pantry Tasks' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Operations & Security Administration
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-Based Access Control (RBAC), Field-Level Visibility Engine, and Central Audit Trail.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('visibility')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'visibility'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Role Visibility Matrix
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Log Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: FIELD VISIBILITY MATRIX */}
      {activeTab === 'visibility' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                Dynamic Field-Level Visibility & Confidentiality Engine
              </h3>
              <p className="text-xs text-slate-400">
                Click any checkbox to grant or revoke field access for that role in real time. (Prompt Rule #21 & #52)
              </p>
            </div>
            {saveSuccess && (
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Changes Persisted to Database
              </span>
            )}
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-300">
                <tr>
                  <th className="p-4 font-bold">Field / Information</th>
                  {rolesList.map((r) => (
                    <th key={r} className="p-4 font-bold text-center">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                        {r}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {fieldsList.map(({ key, label }) => (
                  <tr key={key} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-medium text-white">{label}</td>
                    {rolesList.map((role) => {
                      const isChecked = visibilitySettings ? visibilitySettings[role]?.[key] : false;
                      return (
                        <td key={role} className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleField(role, key)}
                            className="w-4 h-4 rounded-md accent-amber-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Privacy Protocol Notice */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-white block">Strict Operational Confidentiality Enforcement</strong>
              <span>
                By default, Pantry staff never receives phone numbers, resumes, or salary details; Reception only receives operational guidance; and CEO receives executive briefing metrics.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                Immutable System Audit Trail
              </h3>
              <p className="text-xs text-slate-400">
                Every workflow execution distinguishes between SYSTEM automations and USER actions with precise timestamps.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3.5 font-bold">Timestamp</th>
                  <th className="p-3.5 font-bold">Actor Type</th>
                  <th className="p-3.5 font-bold">Actor Name</th>
                  <th className="p-3.5 font-bold">Action</th>
                  <th className="p-3.5 font-bold">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          log.actorType === 'SYSTEM'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {log.actorType}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-white whitespace-nowrap">
                      {log.actorName} {log.actorRole ? `(${log.actorRole})` : ''}
                    </td>
                    <td className="p-3.5 font-mono text-amber-300 text-[11px] whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="p-3.5 text-slate-300 max-w-md">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* TAB 3: OFFICE OPERATIONS & QR LIFETIME CONFIGURATION */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  WCR Operations & QR Security Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure session lifetimes, auto-expiry rules, and mandatory check-in verification parameters.
                </p>
              </div>
              {saveSuccess && (
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settings Saved
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR Expiry Setting */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">QR Registration Session Lifetime</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Maximum duration before an active candidate self-registration session automatically expires. Form becomes unusable and locked once elapsed or submitted.
                </p>
                <div className="pt-1 flex items-center gap-3">
                  <select
                    value={qrExpiryMinutes}
                    onChange={(e) => setQrExpiryMinutes(Number(e.target.value))}
                    className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-hidden focus:border-amber-400"
                  >
                    <option value={15}>15 Minutes (High Security)</option>
                    <option value={30}>30 Minutes (Recommended)</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                  </select>
                  <span className="text-xs text-slate-400">Default: 30 minutes</span>
                </div>
              </div>

              {/* Requirement: Live Photo */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Mandatory Arrival Photo</h4>
                  <input
                    type="checkbox"
                    checked={reqLivePhoto}
                    onChange={(e) => setReqLivePhoto(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-amber-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Require candidate live webcam/phone snapshot for digital access badge creation and escort recognition.
                </p>
              </div>

              {/* Requirement: Resume Upload */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Mandatory Resume Document</h4>
                  <input
                    type="checkbox"
                    checked={reqResume}
                    onChange={(e) => setReqResume(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-amber-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Require candidate to attach PDF/Doc resume before advancing past review stage.
                </p>
              </div>

              {/* Requirement: Pantry Auto-Assign */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Auto Pantry Room Prep</h4>
                  <input
                    type="checkbox"
                    checked={autoPantry}
                    onChange={(e) => setAutoPantry(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-amber-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Automatically dispatch water & beverage preparation tasks to pantry stewards whenever an interview room is allocated.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveOfficeSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                {savingSettings ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Configuration...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Operations Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
