import React, { useState, useEffect, useCallback } from 'react';
import type {
  UserRole,
  Candidate,
  Interview,
  Room,
  Notification,
  PantryTask,
  Visitor,
  User,
} from './types/index.ts';
import { useRealtimeEvents } from './hooks/useRealtimeEvents.ts';
import { Navbar } from './components/Navbar.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { NotificationDrawer } from './components/NotificationDrawer.tsx';
import { CandidateCheckInForm } from './components/CandidateCheckInForm.tsx';
import { GeneralNewCandidateRegister } from './components/GeneralNewCandidateRegister.tsx';
import { CandidateDossierModal } from './components/CandidateDossierModal.tsx';
import { AssignRoomModal } from './components/AssignRoomModal.tsx';
import { EndInterviewModal } from './components/EndInterviewModal.tsx';
import { QRPassModal } from './components/QRPassModal.tsx';
import { WalkInModal } from './components/WalkInModal.tsx';

// Role Dashboards
import { HRDashboard } from './components/dashboards/HRDashboard.tsx';
import { AdminDashboard } from './components/dashboards/AdminDashboard.tsx';
import { CEODashboard } from './components/dashboards/CEODashboard.tsx';
import { InterviewerDashboard } from './components/dashboards/InterviewerDashboard.tsx';
import { ReceptionDashboard } from './components/dashboards/ReceptionDashboard.tsx';
import { PantryDashboard } from './components/dashboards/PantryDashboard.tsx';

import {
  Sparkles,
  QrCode,
  UserCheck,
  Smartphone,
  UserPlus,
  Shield,
  Key,
  X,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const [routePath, setRoutePath] = useState<string>(() => window.location.pathname);
  const [currentRole, setCurrentRole] = useState<UserRole>('HR');
  const [currentUserId, setCurrentUserId] = useState<string>('usr-hr-1');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Application Data States
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pantryTasks, setPantryTasks] = useState<PantryTask[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);

  // Modals & Drawers
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<
    | 'GENERAL_REGISTER'
    | 'CHECK_IN'
    | 'QR_PASS'
    | 'WALK_IN'
    | 'DOSSIER'
    | 'ASSIGN_ROOM'
    | 'END_INTERVIEW'
    | 'STAFF_LOGIN'
    | null
  >(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [checkInToken, setCheckInToken] = useState<string>('WCR-APPT-901');

  // Staff Login State
  const [loginEmail, setLoginEmail] = useState<string>('reception@whitecollarrealty.com');
  const [loginPassword, setLoginPassword] = useState<string>('wcr123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Listen to popstate for browser back/forward routing
  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check routes
  const isGeneralRegisterRoute =
    routePath === '/register' ||
    routePath.startsWith('/register/') ||
    routePath.startsWith('/candidate/register');

  const registerTokenMatch = routePath.match(/\/register\/([^/?#]+)/) || routePath.match(/\/candidate\/register\/([^/?#]+)/);
  const dedicatedRegisterToken = registerTokenMatch ? registerTokenMatch[1] : undefined;

  const isCandidateRoute = routePath.startsWith('/candidate/check-in');
  const urlTokenMatch = routePath.match(/\/candidate\/check-in\/([^/?#]+)/);
  const queryToken = new URLSearchParams(window.location.search).get('token');
  const dedicatedToken = urlTokenMatch ? urlTokenMatch[1] : (queryToken || 'WCR-APPT-901');

  // Fetch all live data from server
  const fetchAllData = useCallback(async () => {
    try {
      const [cRes, iRes, rRes, nRes, pRes] = await Promise.all([
        fetch(`/api/candidates?role=${currentRole}`),
        fetch('/api/interviews'),
        fetch('/api/rooms'),
        fetch(`/api/notifications?role=${currentRole}&userId=${currentUserId}`),
        fetch('/api/pantry/tasks'),
      ]);

      const [cData, iData, rData, nData, pData] = await Promise.all([
        cRes.json(),
        iRes.json(),
        rRes.json(),
        nRes.json(),
        pRes.json(),
      ]);

      if (cData.success) setCandidates(cData.candidates);
      if (iData.success) setInterviews(iData.interviews);
      if (rData.success) setRooms(rData.rooms);
      if (nData.success) setNotifications(nData.notifications);
      if (pData.success) setPantryTasks(pData.tasks);
    } catch (err) {
      console.error('Failed fetching data snapshot', err);
    }
  }, [currentRole, currentUserId]);

  // Hook into Realtime Server-Sent Events (SSE)
  const { connected: isRealtimeConnected } = useRealtimeEvents({
    role: currentRole,
    userId: currentUserId,
    onEvent: (event) => {
      console.log('[REALTIME EVENT RECEIVED]', event);
      // Seamless zero-refresh state update on any confirmed backend event!
      fetchAllData();
    },
  });

  // Re-fetch when switching roles or mounting
  useEffect(() => {
    if (!isCandidateRoute && !isGeneralRegisterRoute) {
      fetchAllData();
    }
  }, [fetchAllData, isCandidateRoute, isGeneralRegisterRoute]);

  // Handle Role Switching
  const handleSelectRole = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'INTERVIEWER') setCurrentUserId('usr-int-1');
    else if (role === 'ADMIN') setCurrentUserId('usr-admin-1');
    else if (role === 'CEO') setCurrentUserId('usr-ceo-1');
    else if (role === 'RECEPTION') setCurrentUserId('usr-rec-1');
    else if (role === 'PANTRY') setCurrentUserId('usr-pan-1');
    else setCurrentUserId('usr-hr-1');
  };

  // Staff Login Handler
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      setCurrentUser(data.user);
      handleSelectRole(data.user.role);
      setLoginSuccess(`Signed in as ${data.user.name} (${data.user.role})`);
      setTimeout(() => {
        setActiveModal(null);
        setLoginSuccess(null);
      }, 1000);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  // Notification action handler
  const handleNotificationAction = (actionKey: string, payload?: any) => {
    if (actionKey === 'ASSIGN_ROOM') {
      setSelectedCandidateId(payload?.candidateId || '');
      setSelectedInterview(payload?.interviewId ? interviews.find((i) => i.id === payload.interviewId) || null : null);
      setActiveModal('ASSIGN_ROOM');
    } else if (actionKey === 'VIEW_CANDIDATE') {
      setSelectedCandidateId(payload?.candidateId || '');
      setActiveModal('DOSSIER');
    } else if (actionKey === 'START_INTERVIEW') {
      if (payload?.interviewId) {
        handleStartInterview(payload.interviewId);
      }
    } else if (actionKey === 'COMPLETE_PANTRY_TASK') {
      if (payload?.taskId) {
        handleCompletePantryTask(payload.taskId);
      }
    } else if (actionKey === 'CHECKOUT_CANDIDATE') {
      if (payload?.candidateId) {
        handleCheckout(payload.candidateId);
      }
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Interviewer actions
  const handleStartInterview = async (interviewId: string) => {
    try {
      await fetch(`/api/interviews/${interviewId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerName: 'Nisha Verma (Senior Director)' }),
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Pantry complete task
  const handleCompletePantryTask = async (taskId: string) => {
    try {
      await fetch(`/api/pantry/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stewardName: 'Suresh Kumar (Pantry)' }),
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Reception physical checkout
  const handleCheckout = async (candidateId: string) => {
    try {
      await fetch('/api/visitors/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          receptionistName: 'Ananya Sen (Reception)',
        }),
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ==========================================
  // DEDICATED GENERAL WCR BLANK REGISTRATION ROUTE
  // https://<domain>/register
  // ==========================================
  if (isGeneralRegisterRoute) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col justify-center items-center font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
        <div className="w-full max-w-2xl">
          <GeneralNewCandidateRegister
            initialToken={dedicatedRegisterToken}
            onSuccess={() => {
              console.log('General New Candidate Self-Registration confirmed');
            }}
          />
          <div className="mt-6 text-center text-xs text-slate-500">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                setRoutePath('/');
              }}
              className="hover:text-amber-400 underline cursor-pointer"
            >
              &larr; Switch to Staff & Operations Console
            </button>
          </div>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  // ==========================================
  // DEDICATED SCHEDULED CANDIDATE SCAN ROUTE
  // https://<domain>/candidate/check-in/<token>
  // ==========================================
  if (isCandidateRoute) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col justify-center items-center font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
        <div className="w-full max-w-2xl">
          <CandidateCheckInForm
            initialToken={dedicatedToken}
            isStandalonePage={true}
            onSuccess={() => {
              console.log('Candidate check-in successfully submitted via QR phone route');
            }}
          />
          <div className="mt-6 text-center text-xs text-slate-500">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                setRoutePath('/');
              }}
              className="hover:text-amber-400 underline cursor-pointer"
            >
              &larr; Switch to Staff & Operations Console
            </button>
          </div>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  // ==========================================
  // STAFF & OPERATIONS CONSOLE (HR, ADMIN, CEO, INTERVIEWER, RECEPTION, PANTRY)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Application Navbar */}
      <Navbar
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        unreadCount={unreadCount}
        onOpenNotifications={() => setNotificationDrawerOpen(true)}
        onOpenQRPasses={() => setActiveModal('QR_PASS')}
        onOpenCheckIn={() => {
          setCheckInToken('WCR-APPT-901');
          setActiveModal('CHECK_IN');
        }}
        onOpenWalkIn={() => setActiveModal('WALK_IN')}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Interactive Testing Quick Launcher Strip */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-3xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white font-bold text-sm tracking-tight">
                WCR Dual QR Architecture & Desk Photo Verification
              </strong>
            </div>
            <p className="text-slate-400 text-xs">
              <strong className="text-emerald-400">1. General Reception QR</strong> (100% blank form, isolated session) &bull;{' '}
              <strong className="text-amber-400">2. Scheduled QR</strong> (Appointment pass) &bull;{' '}
              <strong className="text-cyan-400">3. Reception Live Photo</strong> (WebRTC desk verification).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Direct Blank Registration Test Button */}
            <button
              onClick={() => setActiveModal('GENERAL_REGISTER')}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
              title="Test General WCR Blank Self-Registration"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Test Blank Registration</span>
            </button>

            {/* Scheduled Check-In */}
            <button
              onClick={() => {
                setCheckInToken('WCR-APPT-901');
                setActiveModal('CHECK_IN');
              }}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span>Scheduled Check-In</span>
            </button>

            {/* Dual QR Station Standee */}
            <button
              onClick={() => setActiveModal('QR_PASS')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>QR Standees</span>
            </button>

            {/* Staff Login Modal */}
            <button
              onClick={() => setActiveModal('STAFF_LOGIN')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>Staff Login</span>
            </button>
          </div>
        </div>

        {/* Dynamic Role Dashboard View */}
        {currentRole === 'HR' && (
          <HRDashboard
            candidates={candidates}
            interviews={interviews}
            rooms={rooms}
            onOpenDossier={(candId) => {
              setSelectedCandidateId(candId);
              setActiveModal('DOSSIER');
            }}
            onAssignRoom={(candId, intvId) => {
              setSelectedCandidateId(candId);
              setSelectedInterview(intvId ? interviews.find((i) => i.id === intvId) || null : null);
              setActiveModal('ASSIGN_ROOM');
            }}
            onRefresh={fetchAllData}
          />
        )}

        {currentRole === 'ADMIN' && <AdminDashboard onRefresh={fetchAllData} />}

        {currentRole === 'CEO' && (
          <CEODashboard
            candidates={candidates}
            interviews={interviews}
            rooms={rooms}
            onOpenDossier={(candId) => {
              setSelectedCandidateId(candId);
              setActiveModal('DOSSIER');
            }}
          />
        )}

        {currentRole === 'INTERVIEWER' && (
          <InterviewerDashboard
            candidates={candidates}
            interviews={interviews}
            rooms={rooms}
            currentInterviewerId={currentUserId}
            onStartInterview={handleStartInterview}
            onOpenEndInterviewModal={(intv) => {
              setSelectedInterview(intv);
              setActiveModal('END_INTERVIEW');
            }}
            onOpenDossier={(candId) => {
              setSelectedCandidateId(candId);
              setActiveModal('DOSSIER');
            }}
          />
        )}

        {currentRole === 'RECEPTION' && (
          <ReceptionDashboard
            candidates={candidates}
            rooms={rooms}
            visitors={visitors}
            onCheckout={handleCheckout}
            onOpenCheckIn={() => {
              setCheckInToken('WCR-APPT-901');
              setActiveModal('CHECK_IN');
            }}
            onOpenWalkIn={() => setActiveModal('WALK_IN')}
            onOpenQR={() => setActiveModal('QR_PASS')}
            onRefresh={fetchAllData}
          />
        )}

        {currentRole === 'PANTRY' && (
          <PantryDashboard
            tasks={pantryTasks}
            rooms={rooms}
            onCompleteTask={handleCompletePantryTask}
            onRefresh={fetchAllData}
          />
        )}
      </main>

      {/* Floating Offline Indicator */}
      <OfflineIndicator />

      {/* Slide-over Notification Feed Drawer */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        notifications={notifications}
        role={currentRole}
        onActionClick={handleNotificationAction}
        onMarkRead={handleMarkNotificationRead}
      />

      {/* MODALS */}
      {/* 1. GENERAL WCR BLANK CANDIDATE SELF-REGISTRATION MODAL */}
      {activeModal === 'GENERAL_REGISTER' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs p-4 flex items-center justify-center">
          <GeneralNewCandidateRegister
            onSuccess={() => {
              fetchAllData();
            }}
            onCancel={() => setActiveModal(null)}
          />
        </div>
      )}

      {/* 2. SCHEDULED CANDIDATE CHECK-IN PORTAL MODAL */}
      {activeModal === 'CHECK_IN' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs p-4 flex items-center justify-center">
          <CandidateCheckInForm
            initialToken={checkInToken}
            onSuccess={() => {
              fetchAllData();
            }}
            onCancel={() => setActiveModal(null)}
          />
        </div>
      )}

      {/* 3. DUAL QR PASS STATION MODAL */}
      {activeModal === 'QR_PASS' && (
        <QRPassModal
          onClose={() => setActiveModal(null)}
          onLaunchCheckIn={(token) => {
            setCheckInToken(token);
            setActiveModal('CHECK_IN');
          }}
          onLaunchGeneralRegister={() => {
            setActiveModal('GENERAL_REGISTER');
          }}
        />
      )}

      {/* 4. WALK-IN VISITOR MODAL */}
      {activeModal === 'WALK_IN' && (
        <WalkInModal
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null);
            fetchAllData();
          }}
        />
      )}

      {/* 5. CANDIDATE DOSSIER MODAL */}
      {activeModal === 'DOSSIER' && selectedCandidateId && (
        <CandidateDossierModal
          candidateId={selectedCandidateId}
          currentRole={currentRole}
          onClose={() => {
            setSelectedCandidateId('');
            setActiveModal(null);
          }}
          onAssignRoom={(candId, intvId) => {
            setSelectedCandidateId(candId);
            setSelectedInterview(intvId ? interviews.find((i) => i.id === intvId) || null : null);
            setActiveModal('ASSIGN_ROOM');
          }}
        />
      )}

      {/* 6. HR ASSIGN ROOM MODAL */}
      {activeModal === 'ASSIGN_ROOM' && selectedCandidateId && (
        <AssignRoomModal
          candidateId={selectedCandidateId}
          candidateName={
            candidates.find((c) => c.id === selectedCandidateId)?.fullName || 'Candidate'
          }
          interviewId={selectedInterview?.id}
          onClose={() => {
            setActiveModal(null);
            setSelectedInterview(null);
          }}
          onSuccess={() => {
            setActiveModal(null);
            setSelectedInterview(null);
            fetchAllData();
          }}
        />
      )}

      {/* 7. INTERVIEWER END INTERVIEW DECISION MODAL */}
      {activeModal === 'END_INTERVIEW' && selectedInterview && (
        <EndInterviewModal
          interviewId={selectedInterview.id}
          candidateName={selectedInterview.candidateName}
          interviewerName={selectedInterview.interviewerName}
          currentRound={selectedInterview.roundName}
          onClose={() => {
            setActiveModal(null);
            setSelectedInterview(null);
          }}
          onSuccess={() => {
            setActiveModal(null);
            setSelectedInterview(null);
            fetchAllData();
          }}
        />
      )}

      {/* 8. STAFF LOGIN MODAL (EMAIL + PASSWORD) */}
      {activeModal === 'STAFF_LOGIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Staff Login</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loginError && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {loginError}
              </div>
            )}

            {loginSuccess && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{loginSuccess}</span>
              </div>
            )}

            <form onSubmit={handleStaffLogin} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Staff Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. reception@whitecollarrealty.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition"
                >
                  Authenticate Staff Session
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 space-y-1">
                <p>Quick demo logins:</p>
                <p>&bull; reception@whitecollarrealty.com (Reception)</p>
                <p>&bull; sneha.patel@whitecollarrealty.com (HR)</p>
                <p>&bull; nisha.verma@whitecollarrealty.com (Interviewer)</p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
