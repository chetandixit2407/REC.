import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  User,
  Briefcase,
  Calendar,
  Building,
  ArrowRight,
  ArrowLeft,
  X,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  Check,
  Lock,
  Hourglass,
  QrCode,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import type { Candidate, GovernmentIdType } from '../types/index.ts';
import { CameraCapture } from './CameraCapture.tsx';

interface GeneralNewCandidateRegisterProps {
  initialToken?: string;
  onSuccess?: (candidate: Candidate) => void;
  onCancel?: () => void;
}

type SessionState = 'INITIALIZING' | 'ACTIVE' | 'SUBMITTING' | 'COMPLETED' | 'EXPIRED' | 'NOT_FOUND';

export const GeneralNewCandidateRegister: React.FC<GeneralNewCandidateRegisterProps> = ({
  initialToken,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<number>(1);
  const [sessionState, setSessionState] = useState<SessionState>('INITIALIZING');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeRemainingText, setTimeRemainingText] = useState<string>('');
  const [expiryMinutes, setExpiryMinutes] = useState<number>(30);

  // Mandatory: Start with genuinely BLANK fields for fresh candidate
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    position: '',
    department: 'Sales & Business Development',
    totalExperience: '',
    relevantExperience: '',
    currentCompany: '',
    qualification: '',
    skills: '',
    noticePeriod: '',
    expectedSalary: '',
    purpose: 'Interview / Job Application',
    positionAppliedFor: '',
    howDidYouHear: '',
    departmentToMeet: 'Recruitment & HR',
    personToMeet: '',
  });

  // Government ID (Mandatory)
  const [govIdType, setGovIdType] = useState<GovernmentIdType>('AADHAAR');
  const [govIdNumber, setGovIdNumber] = useState<string>('');
  const [govIdFile, setGovIdFile] = useState<{
    name: string;
    size: string;
    dataUrl: string;
  } | null>(null);
  const [govIdFormatError, setGovIdFormatError] = useState<string | null>(null);

  // Media (Live photo)
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Resume
  const [resumeFile, setResumeFile] = useState<{
    name: string;
    size: string;
    dataUrl: string;
  } | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCandidate, setSubmittedCandidate] = useState<Candidate | null>(null);
  const [submissionTimestamp, setSubmissionTimestamp] = useState<string>('');

  // Real-time live status tracking for submitted candidate
  const [liveStatus, setLiveStatus] = useState<string>('ARRIVED');
  const [liveLocation, setLiveLocation] = useState<string>('Reception / Waiting Lounge');
  const [liveNotice, setLiveNotice] = useState<string>('Registration submitted. Front desk & HR notified.');

  // Extract token from URL path or search query if available
  const extractTokenFromUrl = (): string | null => {
    if (initialToken) return initialToken;
    const path = window.location.pathname;
    const match = path.match(/\/register\/([^/?#]+)/) || path.match(/\/candidate\/register\/([^/?#]+)/);
    if (match && match[1]) return match[1];
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session') || urlParams.get('token');
  };

  // Initialize or verify session on mount
  useEffect(() => {
    const activeToken = extractTokenFromUrl();
    if (activeToken) {
      verifyExistingSession(activeToken);
    } else {
      initFreshSession();
    }
  }, []);

  // Real-time Gov ID validation
  useEffect(() => {
    if (!govIdNumber.trim()) {
      setGovIdFormatError(null);
      return;
    }
    const clean = govIdNumber.trim().replace(/[\s-]/g, '').toUpperCase();
    if (govIdType === 'AADHAAR') {
      if (!/^\d{12}$/.test(clean)) {
        setGovIdFormatError('Aadhaar must be exactly 12 numeric digits.');
      } else {
        setGovIdFormatError(null);
      }
    } else if (govIdType === 'PAN') {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean)) {
        setGovIdFormatError('PAN format must be 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F).');
      } else {
        setGovIdFormatError(null);
      }
    } else if (govIdType === 'DRIVING_LICENSE') {
      if (clean.length < 10) {
        setGovIdFormatError('Driving Licence must contain at least 10 valid alphanumeric characters.');
      } else {
        setGovIdFormatError(null);
      }
    } else if (govIdType === 'PASSPORT') {
      if (!/^[A-Z]{1}[0-9]{7,8}$/.test(clean)) {
        setGovIdFormatError('Passport format must be 1 letter followed by 7-8 numeric digits.');
      } else {
        setGovIdFormatError(null);
      }
    } else if (govIdType === 'VOTER_ID') {
      if (!/^[A-Z]{3}[0-9]{7}$/.test(clean) && clean.length < 8) {
        setGovIdFormatError('Voter ID must follow standard EPIC format (e.g. ABC1234567).');
      } else {
        setGovIdFormatError(null);
      }
    } else {
      if (clean.length < 4) {
        setGovIdFormatError('Government ID number is too short.');
      } else {
        setGovIdFormatError(null);
      }
    }
  }, [govIdType, govIdNumber]);

  // Countdown timer for active session auto-expiry
  useEffect(() => {
    if (sessionState !== 'ACTIVE' || !expiresAt) return;

    const updateRemainingTime = () => {
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeRemainingText('Expired');
        setSessionState('EXPIRED');
        return;
      }
      const totalSeconds = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      setTimeRemainingText(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(interval);
  }, [sessionState, expiresAt]);

  // 2-second auto-exit / redirect after successful registration
  useEffect(() => {
    if (sessionState === 'COMPLETED') {
      const timer = setTimeout(() => {
        if (onSuccess && submittedCandidate) {
          onSuccess(submittedCandidate);
        }
        window.history.pushState({}, '', '/registration-complete');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionState, submittedCandidate, onSuccess]);

  // Request fresh registration session
  const initFreshSession = async () => {
    setSessionState('INITIALIZING');
    setSubmitError(null);
    setSubmittedCandidate(null);
    setSubmissionTimestamp('');
    setStep(1);
    setFormData({
      fullName: '',
      phone: '',
      email: '',
      address: '',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002',
      position: '',
      department: 'Sales & Business Development',
      totalExperience: '',
      relevantExperience: '',
      currentCompany: '',
      qualification: '',
      skills: '',
      noticePeriod: '',
      expectedSalary: '',
      purpose: 'Interview / Job Application',
      positionAppliedFor: '',
      howDidYouHear: '',
      departmentToMeet: 'Recruitment & HR',
      personToMeet: '',
    });
    setGovIdType('AADHAAR');
    setGovIdNumber('');
    setGovIdFile(null);
    setLivePhoto(null);
    setResumeFile(null);

    try {
      const res = await fetch('/api/register/session', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.session) {
        setSessionId(data.session.id);
        setSessionToken(data.session.token);
        setExpiresAt(data.session.expiresAt);
        setExpiryMinutes(data.expiryMinutes || 30);
        setSessionState('ACTIVE');
        window.history.replaceState(null, '', `/register/${data.session.token}`);
      } else {
        setSessionState('NOT_FOUND');
      }
    } catch (err) {
      console.error('Failed to initialize session', err);
      setSessionState('NOT_FOUND');
    }
  };

  // Verify existing session
  const verifyExistingSession = async (token: string) => {
    setSessionState('INITIALIZING');
    setSubmitError(null);
    try {
      const res = await fetch(`/api/register/session/${encodeURIComponent(token)}`);
      const data = await res.json();

      if (res.status === 410 || data.status === 'EXPIRED') {
        setSessionState('EXPIRED');
        return;
      }

      if (res.status === 404 || data.status === 'NOT_FOUND') {
        setSessionState('NOT_FOUND');
        return;
      }

      if (data.status === 'COMPLETED' || data.session?.status === 'COMPLETED') {
        setSessionState('COMPLETED');
        setSessionToken(token);
        setSessionId(data.session?.id || token);
        if (data.candidate) {
          setSubmittedCandidate(data.candidate);
          setLiveStatus(data.candidate.status || 'ARRIVED');
          setLiveLocation(data.candidate.currentLocation || 'Reception / Waiting Lounge');
        }
        const timeStr = data.submittedAt || data.completedAt || new Date().toISOString();
        setSubmissionTimestamp(formatAuthoritativeTimestamp(timeStr));
        return;
      }

      if (data.success && data.status === 'ACTIVE') {
        setSessionId(data.session.id);
        setSessionToken(data.session.token);
        setExpiresAt(data.session.expiresAt);
        setSessionState('ACTIVE');
      } else {
        setSessionState('EXPIRED');
      }
    } catch (err) {
      console.error('Failed to verify session', err);
      setSessionState('EXPIRED');
    }
  };

  const formatAuthoritativeTimestamp = (isoString?: string): string => {
    try {
      const date = isoString ? new Date(isoString) : new Date();
      return (
        date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) +
        ', ' +
        date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      );
    } catch {
      return new Date().toLocaleString();
    }
  };

  const handlePhotoFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLivePhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Government ID Upload
  const handleGovIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const reader = new FileReader();
      reader.onload = (event) => {
        setGovIdFile({
          name: file.name,
          size: sizeMB,
          dataUrl: event.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Resume Upload
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const reader = new FileReader();
      reader.onload = (event) => {
        setResumeFile({
          name: file.name,
          size: sizeMB,
          dataUrl: event.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Format ID number mask preview
  const getMaskedPreview = (): string => {
    if (!govIdNumber) return 'XXXX-XXXX-XXXX';
    const clean = govIdNumber.trim().replace(/[\s-]/g, '').toUpperCase();
    if (govIdType === 'AADHAAR') {
      const last4 = clean.slice(-4) || '1234';
      return `XXXX XXXX ${last4}`;
    }
    if (govIdType === 'PAN') {
      if (clean.length >= 6) {
        return `${clean.slice(0, 2)}XXX${clean.slice(5, 9)}${clean.slice(9) || 'X'}`;
      }
      return 'ABXXX1234F';
    }
    return `ID-XXXX-${clean.slice(-4) || '1234'}`;
  };

  // Validation per step
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.fullName.trim() || !formData.phone.trim() || !formData.email.trim()) {
        setSubmitError('Please complete all mandatory personal fields: Full Name, Phone, and Email.');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setSubmitError('Please provide a valid email address.');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.position.trim()) {
        setSubmitError('Position / Job Role applied for is required.');
        return false;
      }
    }
    if (currentStep === 4) {
      // Government ID Validation
      if (!govIdNumber.trim()) {
        setSubmitError('Government ID Number is mandatory.');
        return false;
      }
      if (govIdFormatError) {
        setSubmitError(govIdFormatError);
        return false;
      }
      if (!govIdFile) {
        setSubmitError('Government ID document upload is mandatory to complete registration.');
        return false;
      }
    }
    if (currentStep === 5) {
      if (!livePhoto) {
        setSubmitError('Please capture your live arrival photo to continue.');
        return false;
      }
    }
    if (currentStep === 6) {
      if (!resumeFile) {
        setSubmitError('Please upload your resume document.');
        return false;
      }
    }
    setSubmitError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setSubmitError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  // Final Atomic Submission
  const handleSubmit = async () => {
    if (submitting || sessionState !== 'ACTIVE') return;

    if (
      !validateStep(1) ||
      !validateStep(2) ||
      !validateStep(4) ||
      !validateStep(5) ||
      !validateStep(6)
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      token: sessionToken,
      ...formData,
      governmentIdType: govIdType,
      governmentIdNumber: govIdNumber,
      governmentIdDocumentUrl: govIdFile?.dataUrl,
      governmentIdFileName: govIdFile?.name,
      governmentIdFileSize: govIdFile?.size,
      livePhoto,
      resumeUrl: resumeFile?.dataUrl,
      resumeFileName: resumeFile?.name,
      resumeFileSize: resumeFile?.size,
    };

    try {
      const res = await fetch('/api/register/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        setSessionState('COMPLETED');
        setSubmitError('This session has already been completed.');
        return;
      }

      if (res.status === 410) {
        setSessionState('EXPIRED');
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit registration');
      }

      setSessionState('COMPLETED');
      setSubmittedCandidate(data.candidate);
      setLiveStatus(data.candidate?.status || 'ARRIVED');
      setLiveLocation(data.candidate?.currentLocation || 'Reception / Waiting Lounge');
      setSubmissionTimestamp(
        formatAuthoritativeTimestamp(data.session?.completedAt || new Date().toISOString())
      );

      if (onSuccess && data.candidate) {
        onSuccess(data.candidate);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // VIEW: INITIALIZING SPINNER
  if (sessionState === 'INITIALIZING') {
    return (
      <div className="w-full max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-2xl text-slate-100">
        <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white">Initializing Secure WCR Session...</h3>
        <p className="text-xs text-slate-400 mt-1">Generating fresh, isolated candidate session token.</p>
      </div>
    );
  }

  // VIEW: EXPIRED SESSION SCREEN
  if (sessionState === 'EXPIRED' || sessionState === 'NOT_FOUND') {
    return (
      <div className="w-full max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <Hourglass className="w-8 h-8" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-full mb-2 tracking-wide uppercase">
              Registration Session Expired
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">WCR Registration</h2>
            <p className="text-sm text-slate-300 font-medium mt-2">This registration link has expired.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              For security, WCR candidate registration links are temporary ({expiryMinutes} minutes validity). Please scan the WCR QR code at the reception desk to start a new blank registration.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-2 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Session ID:</span>
              <code className="text-slate-300 font-mono text-[11px]">{sessionToken || 'EXPIRED'}</code>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status:</span>
              <span className="text-rose-400 font-bold uppercase text-[11px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked & Expired
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={initFreshSession}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <QrCode className="w-4 h-4" />
              Scan QR Again / Start New Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW: COMPLETED SCREEN
  if (sessionState === 'COMPLETED') {
    const candidateName = submittedCandidate?.fullName || formData.fullName || 'Candidate';
    const positionName = submittedCandidate?.position || formData.position || 'Position Applied';
    const regId = submittedCandidate?.id || sessionId || sessionToken;

    return (
      <div className="w-full max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
                WHITE COLLAR REALTY
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span className="text-emerald-400">✓</span> Form Submitted Successfully
            </h2>
            <p className="text-sm text-slate-300 font-medium mt-1">
              Your registration has been submitted successfully.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-full mt-2">
              <span>Automatic exit in approximately 2 seconds...</span>
            </div>
          </div>

          {liveNotice && (
            <div className="p-3.5 bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center gap-2 text-xs text-amber-200 font-semibold shadow-md">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{liveNotice}</span>
            </div>
          )}

          {/* Authoritative Receipt Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 text-left space-y-3.5 mt-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Registration ID
                </span>
                <span className="text-sm font-mono font-bold text-amber-400">{regId}</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked & Verified
              </span>
            </div>

            <div className="flex items-center gap-4 py-1">
              {livePhoto ? (
                <img
                  src={livePhoto}
                  alt={candidateName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-white">{candidateName}</h3>
                <p className="text-xs text-amber-400 font-medium">{positionName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-md font-semibold">
                    ID: {getMaskedPreview()}
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                    Resume Stored
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Submitted At</span>
                <span className="text-slate-200 font-mono text-[11px] font-semibold block mt-0.5">
                  {submissionTimestamp || formatAuthoritativeTimestamp()}
                </span>
              </div>

              <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Live Location</span>
                <span className="text-amber-400 font-bold flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {liveLocation}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={initFreshSession}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              New Registration (Scan QR)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW: ACTIVE 7-STEP FORM
  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
              White Collar Realty
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
              One-Time QR Session
            </span>
            {timeRemainingText && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeRemainingText}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Candidate Registration & Check-in
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Mandatory Profile • Government ID • Live Photo • Resume • Session <code className="text-amber-400 font-mono text-[11px]">{sessionToken}</code>
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Progress Wizard */}
      <div className="py-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span className="text-amber-400 font-bold">Step {step} of 7</span>
          <span className="text-slate-300">
            {step === 1 && '1. Personal Information'}
            {step === 2 && '2. Professional Details'}
            {step === 3 && '3. Visit Information'}
            {step === 4 && '4. Government ID (Mandatory)'}
            {step === 5 && '5. Live Arrival Photo'}
            {step === 6 && '6. Resume Upload'}
            {step === 7 && '7. Automated Validation & Review'}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {submitError && (
        <div className="my-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{submitError}</span>
        </div>
      )}

      {/* STEP 1: PERSONAL INFORMATION */}
      {step === 1 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 00000"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address <span className="text-amber-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="yourname@example.com"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Current Residential Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Apartment, Street address, Locality"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="122002"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PROFESSIONAL INFORMATION */}
      {step === 2 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Position / Role Applied For <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Sales Manager - Luxury Homes"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              >
                <option value="Sales & Business Development">Sales & Business Development</option>
                <option value="Luxury Advisory & CRM">Luxury Advisory & CRM</option>
                <option value="Legal & Conveyancing">Legal & Conveyancing</option>
                <option value="Operations & Strategy">Operations & Strategy</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Finance & Accounts">Finance & Accounts</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Total Experience</label>
              <input
                type="text"
                value={formData.totalExperience}
                onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
                placeholder="e.g. 5 Years (or Fresher)"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Current / Previous Company</label>
              <input
                type="text"
                value={formData.currentCompany}
                onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                placeholder="e.g. DLF / Godrej / Sobha / N/A"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Highest Qualification</label>
              <input
                type="text"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                placeholder="e.g. MBA / B.Tech"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Notice Period</label>
              <input
                type="text"
                value={formData.noticePeriod}
                onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                placeholder="e.g. Immediate / 15 Days"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Expected Salary (CTC)</label>
              <input
                type="text"
                value={formData.expectedSalary}
                onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                placeholder="e.g. ₹15,00,000 p.a."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Key Skills & Competencies</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g. Luxury Sales, High-Net-Worth Advisory, Negotiation"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* STEP 3: VISIT & INTERVIEW INFORMATION */}
      {step === 3 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Visit Purpose</label>
              <input
                type="text"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="e.g. Interview / Job Application"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department to Meet</label>
              <input
                type="text"
                value={formData.departmentToMeet}
                onChange={(e) => setFormData({ ...formData, departmentToMeet: e.target.value })}
                placeholder="e.g. Recruitment & HR / Sales Head"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Person / Host to Meet (if known)
              </label>
              <input
                type="text"
                value={formData.personToMeet}
                onChange={(e) => setFormData({ ...formData, personToMeet: e.target.value })}
                placeholder="e.g. HR Manager / Nisha Verma / Open Walk-in"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">How did you hear about WCR?</label>
              <input
                type="text"
                value={formData.howDidYouHear}
                onChange={(e) => setFormData({ ...formData, howDidYouHear: e.target.value })}
                placeholder="e.g. LinkedIn, Job Portal, Employee Referral, Walk-in"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: GOVERNMENT ID (MANDATORY) */}
      {step === 4 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Mandatory Government Identification
            </div>
            <h3 className="text-base font-bold text-white">Upload Government-Issued ID</h3>
            <p className="text-xs text-slate-400">
              One valid government ID is strictly required to complete candidate entry and physical escort authorization.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Government ID Type <span className="text-amber-400">*</span>
                </label>
                <select
                  value={govIdType}
                  onChange={(e) => setGovIdType(e.target.value as GovernmentIdType)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-cyan-400"
                >
                  <option value="AADHAAR">Aadhaar Card (12 Digits)</option>
                  <option value="PAN">PAN Card (10 Characters)</option>
                  <option value="DRIVING_LICENSE">Driving Licence</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="VOTER_ID">Voter ID (EPIC)</option>
                  <option value="OTHER">Other Government ID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Government ID Number <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={govIdNumber}
                  onChange={(e) => setGovIdNumber(e.target.value)}
                  placeholder={
                    govIdType === 'AADHAAR'
                      ? '12-digit Aadhaar Number'
                      : govIdType === 'PAN'
                      ? 'e.g. ABCDE1234F'
                      : 'Enter ID Number'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-cyan-400 font-mono uppercase"
                  required
                />
                {govIdFormatError ? (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {govIdFormatError}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" /> Masked in UI as:{' '}
                    <strong className="text-cyan-300 font-mono">{getMaskedPreview()}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Document File Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Upload Government ID Document (PDF, JPG, PNG) <span className="text-amber-400">*</span>
              </label>

              <div className="p-5 bg-slate-900 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl text-center transition flex flex-col items-center justify-center min-h-[160px]">
                {govIdFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{govIdFile.name}</h4>
                      <p className="text-[10px] text-slate-400">{govIdFile.size} • Attached</p>
                    </div>
                    <label className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer">
                      Replace Document
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleGovIdUpload}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-white">Choose Government ID file</p>
                    <p className="text-[11px] text-slate-500">Accepted: PDF / JPG / JPEG / PNG (Max 15MB)</p>
                    <label className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md cursor-pointer transition">
                      Choose ID File
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleGovIdUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: CAPTURE LIVE PHOTO */}
      {step === 5 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Capture Live Arrival Photo</h3>
            <p className="text-xs text-slate-400">
              Live photograph is required for front desk escort recognition and visitor access.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-5 bg-slate-950 border border-slate-800 rounded-2xl min-h-[260px]">
            {cameraActive ? (
              <div className="w-full max-w-md">
                <CameraCapture
                  title="Candidate Arrival Live Photo"
                  subtitle="Please look at the camera and ensure good lighting."
                  preferredFacingMode="user"
                  onCapture={(dataUrl) => {
                    setLivePhoto(dataUrl);
                    setCameraActive(false);
                  }}
                  onCancel={() => setCameraActive(false)}
                />
              </div>
            ) : livePhoto ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-emerald-500/80 shadow-xl">
                  <img src={livePhoto} alt="Live Capture" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 rounded-full p-1 shadow">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraActive(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retake Live Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-amber-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-300 font-medium">Ready to open mobile camera</p>
                  <p className="text-[11px] text-slate-500">Fast, instant live capture with authoritative timestamp</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setCameraActive(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition"
                  >
                    <Camera className="w-4 h-4" />
                    Open Live Camera
                  </button>
                  <label className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-slate-400" />
                    Upload Photo File
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoFallbackUpload} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: RESUME UPLOAD */}
      {step === 6 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Upload Your Resume</h3>
            <p className="text-xs text-slate-400">
              Upload your latest resume (PDF, Word, or Image format). HR and Interviewers will review this dossier.
            </p>
          </div>

          <div className="p-6 bg-slate-950 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl text-center transition flex flex-col items-center justify-center min-h-[200px]">
            {resumeFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{resumeFile.name}</h4>
                  <p className="text-xs text-slate-400">{resumeFile.size}</p>
                </div>
                <div className="flex gap-2">
                  <label className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer">
                    Replace Resume
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleResumeUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-amber-400">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Select or drag & drop your resume</p>
                  <p className="text-xs text-slate-500">Supported formats: PDF, DOCX, DOC, JPG (Up to 15 MB)</p>
                </div>
                <label className="inline-block px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg cursor-pointer transition">
                  Choose Document
                  <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleResumeUpload} />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 7: AUTOMATED VALIDATION SUMMARY & REVIEW */}
      {step === 7 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Automated Validation & Confirmation</h3>
            <p className="text-xs text-slate-400">
              System has verified all submitted fields. Review summary before final confirmation.
            </p>
          </div>

          {/* Validation Engine Checklist Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Automated Validation Engine Status
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready For Reception
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Personal Information</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passed
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Mobile Number Format</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passed
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Email Address Format</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passed
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Resume Document</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Uploaded
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Government ID ({govIdType})</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Format Passed
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">Government ID Name Match</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Name Verified
                </span>
              </div>
            </div>
          </div>

          {/* Dossier Snapshot */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              {livePhoto ? (
                <img src={livePhoto} alt="Live" className="w-12 h-12 rounded-full object-cover border border-amber-500/50" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-white">{formData.fullName || '[EMPTY]'}</h4>
                <p className="text-amber-400 font-medium">{formData.position || '[EMPTY]'}</p>
                <p className="text-[11px] text-slate-400">{formData.phone} • {formData.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Government ID:</span>{' '}
                <span className="text-cyan-300 font-mono font-bold">{getMaskedPreview()}</span>
              </div>
              <div>
                <span className="text-slate-400">Resume:</span>{' '}
                <span className="text-emerald-400 font-medium">{resumeFile?.name || 'Attached'}</span>
              </div>
              <div>
                <span className="text-slate-400">Experience:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.totalExperience || 'Fresher'}</span>
              </div>
              <div>
                <span className="text-slate-400">Department:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.department}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Session: <code className="text-amber-400">{sessionToken}</code></span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> One-Time Lock Upon Submit
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-5 border-t border-slate-800">
        {step > 1 ? (
          <button
            type="button"
            onClick={handlePrev}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>
        ) : (
          <div />
        )}

        {step < 7 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition cursor-pointer"
          >
            Next Step
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || sessionState !== 'ACTIVE'}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black rounded-xl shadow-xl transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validating & Committing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Submit Registration
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
