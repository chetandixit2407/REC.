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
  DoorOpen,
  UserCheck,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { CameraCapture } from './CameraCapture.tsx';

interface CandidateCheckInFormProps {
  initialToken?: string;
  isStandalonePage?: boolean;
  onSuccess?: (candidate: any) => void;
  onCancel?: () => void;
}

export const CandidateCheckInForm: React.FC<CandidateCheckInFormProps> = ({
  initialToken = 'WCR-APPT-901',
  isStandalonePage = false,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<number>(1);
  const [tokenInput, setTokenInput] = useState<string>(initialToken);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    position: 'Sales Manager - Luxury Residential',
    totalExperience: '5.5 Years',
    relevantExperience: '4 Years in Luxury Real Estate',
    currentCompany: 'DLF Crest Sales',
    interviewType: 'Round 1 - Technical Assessment',
    visitPurpose: 'Scheduled In-Person Interview',
    referralSource: 'LinkedIn / Portal',
  });

  // Media
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Resume
  const [resumeFile, setResumeFile] = useState<{
    name: string;
    size: string;
    dataUrl: string;
  } | null>({
    name: 'Rahul_Sharma_Resume_WCR.pdf',
    size: '1.4 MB',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ',
  });

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCandidate, setSubmittedCandidate] = useState<any>(null);
  const [submissionTime, setSubmissionTime] = useState<string>('');

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

  // 2-second auto-exit after submission
  useEffect(() => {
    if (submittedCandidate) {
      const timer = setTimeout(() => {
        if (onSuccess) onSuccess(submittedCandidate);
        window.history.pushState({}, '', '/registration-complete');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [submittedCandidate, onSuccess]);

  // Real-time live status tracking for submitted candidate
  const [liveStatus, setLiveStatus] = useState<string>('ARRIVED');
  const [liveLocation, setLiveLocation] = useState<string>('Reception / Waiting Lounge');
  const [liveRoomName, setLiveRoomName] = useState<string>('');
  const [liveInterviewerName, setLiveInterviewerName] = useState<string>('Nisha Verma');
  const [liveNotice, setLiveNotice] = useState<string>('');

  // Load session from token on mount
  useEffect(() => {
    if (initialToken) {
      loadSession(initialToken);
    }
  }, [initialToken]);

  const loadSession = async (token: string) => {
    if (!token.trim()) return;
    setSessionLoading(true);
    setSessionError(null);
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(token.trim())}`);
      const data = await res.json();

      if (res.status === 410 || data.status === 'EXPIRED') {
        setSessionError('This scheduled QR pass has expired. Please request a new pass from reception.');
        setSessionData(null);
        return;
      }

      if (data.status === 'COMPLETED') {
        setSubmittedCandidate({
          id: token,
          fullName: data.candidateName || formData.fullName,
          position: data.position || formData.position,
        });
        setLiveNotice('Check-in has already been completed.');
        return;
      }

      if (!res.ok || !data.success) {
        setSessionError(data.error || 'Invalid QR code. Proceeding with walk-in registration.');
        setSessionData(null);
      } else {
        setSessionData(data.session);
        if (data.prefill) {
          setFormData((prev) => ({
            ...prev,
            ...data.prefill,
            interviewType: data.session?.interviewRound || prev.interviewType,
          }));
        } else if (data.session?.candidateName) {
          setFormData((prev) => ({
            ...prev,
            fullName: data.session.candidateName || prev.fullName,
            position: data.session.position || prev.position,
            interviewType: data.session.interviewRound || prev.interviewType,
          }));
        }
      }
    } catch (err: any) {
      setSessionError('Could not verify QR code. Please check your connection.');
    } finally {
      setSessionLoading(false);
    }
  };

  // Real-time EventSource listener for submitted candidate
  useEffect(() => {
    if (!submittedCandidate?.id) return;

    const es = new EventSource('/api/events?role=HR');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'ROOM_ASSIGNED' && event.payload?.candidateId === submittedCandidate.id) {
          setLiveStatus('ROOM_ASSIGNED');
          setLiveLocation(event.payload.roomName);
          setLiveRoomName(event.payload.roomName);
          setLiveNotice(`Room Allocated: Please proceed to ${event.payload.roomName}. Reception or steward will escort you.`);
        } else if (event.type === 'INTERVIEW_STARTED' && event.payload?.candidateId === submittedCandidate.id) {
          setLiveStatus('IN_INTERVIEW');
          setLiveNotice(`Interview in session with ${event.payload.interviewerName || 'Interviewer'}.`);
        } else if (event.type === 'INTERVIEW_COMPLETED' && event.payload?.candidateId === submittedCandidate.id) {
          if (event.payload.outcome === 'NEXT_INTERVIEW') {
            setLiveStatus('WAITING');
            setLiveLocation('Reception Lounge');
            setLiveNotice('Round Cleared! Please relax in the lounge while your next interviewer is briefed.');
          } else {
            setLiveStatus('COMPLETED');
            setLiveNotice('Interview rounds concluded. Please proceed to the front desk to complete checkout.');
          }
        } else if (event.type === 'VISITOR_CHECKED_OUT' && event.payload?.candidateId === submittedCandidate.id) {
          setLiveStatus('CHECKED_OUT');
          setLiveNotice('Physical checkout complete. Thank you for visiting White Collar Realty!');
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      es.close();
    };
  }, [submittedCandidate?.id]);

  // 2-second auto-exit redirect after successful check-in
  useEffect(() => {
    if (submittedCandidate) {
      const timer = setTimeout(() => {
        window.history.pushState({}, '', '/registration-complete');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [submittedCandidate]);

  const handlePhotoUploadFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLivePhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Resume Upload Handler
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

  // Validation per step
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.fullName.trim() || !formData.phone.trim()) {
        setSubmitError('Please complete mandatory personal fields: Full Name and Mobile Number.');
        return false;
      }
      const cleanPhone = formData.phone.trim().replace(/[\s-]/g, '');
      if (cleanPhone.length < 10) {
        setSubmitError('Please provide a valid 10-digit mobile number.');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.position.trim()) {
        setSubmitError('Position / Job Role is required.');
        return false;
      }
    }
    if (currentStep === 4) {
      if (!livePhoto) {
        setSubmitError('Live photo capture is required for security verification and digital badge generation.');
        return false;
      }
    }
    if (currentStep === 5) {
      if (!resumeFile) {
        setSubmitError('Please upload your resume to proceed.');
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
    if (!validateStep(1) || !validateStep(2) || !validateStep(4) || !validateStep(5)) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      token: tokenInput.trim(),
      ...formData,
      livePhoto,
      resumeUrl: resumeFile?.dataUrl,
      resumeFileName: resumeFile?.name,
      resumeFileSize: resumeFile?.size,
    };

    try {
      const res = await fetch('/api/checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete check-in');
      }

      setSubmittedCandidate(data.candidate);
      setSubmissionTime(data.submissionTime || data.session?.completedAt || new Date().toISOString());
      setLiveLocation(data.candidate.currentLocation || 'Reception / Waiting Lounge');
      setLiveStatus(data.candidate.status || 'ARRIVED');
      setLiveNotice('Check-in verified and saved to database. Coordinator alerted.');

      if (onSuccess) onSuccess(data.candidate);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS & LIVE WORKFLOW TRACKING SCREEN
  if (submittedCandidate) {
    const regId = submittedCandidate.id || tokenInput;
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
          </div>

          {/* Real-time Status Alert Banner */}
          {liveNotice && (
            <div className="p-3.5 bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center gap-2 text-xs text-amber-200 font-semibold shadow-md">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{liveNotice}</span>
            </div>
          )}

          {/* Authoritative Receipt Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 text-left space-y-3.5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pb-3 border-b border-slate-800">
              <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Registration ID:
                </span>
                <span className="text-sm font-mono font-bold text-amber-400 block mt-0.5">
                  {regId}
                </span>
              </div>

              <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Submission Time:
                </span>
                <span className="text-slate-200 font-mono text-[11px] font-semibold block mt-0.5">
                  {formatAuthoritativeTimestamp(submissionTime)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 py-1">
              {livePhoto ? (
                <img
                  src={livePhoto}
                  alt={submittedCandidate.fullName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-white">{submittedCandidate.fullName}</h3>
                <p className="text-xs text-amber-400 font-medium">{submittedCandidate.position}</p>
                <p className="text-[11px] text-slate-400">Status: <strong className="text-emerald-400">{liveStatus}</strong></p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-medium block mb-1">What Happens Next:</span>
              HR and front-desk coordinators have received your check-in. Please remain in the reception lounge.
            </div>
          </div>

          <div className="pt-3">
            {isStandalonePage ? (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-semibold text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Check-in Completed. Please wait in the reception lounge.</span>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setSubmittedCandidate(null);
                    setStep(1);
                    if (onCancel) onCancel();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
                >
                  Close Check-In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
              White Collar Realty
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Candidate Self Check-In
          </h1>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Progress Steps Header */}
      <div className="py-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span className="text-amber-400 font-bold">Step {step} of 6</span>
          <span className="text-slate-300">
            {step === 1 && '1. Personal Information'}
            {step === 2 && '2. Professional Background'}
            {step === 3 && '3. Visit & Interview Information'}
            {step === 4 && '4. Capture Live Photo'}
            {step === 5 && '5. Upload Resume'}
            {step === 6 && '6. Review & Submit'}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* Global Error Notice */}
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
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
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
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400 transition"
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
                Position / Job Role Applied For <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Sales Manager - Luxury Residential"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Current/Previous Company</label>
              <input
                type="text"
                value={formData.currentCompany}
                onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                placeholder="e.g. DLF / JLL / CBRE"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Total Experience</label>
              <input
                type="text"
                value={formData.totalExperience}
                onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
                placeholder="e.g. 5.5 Years"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Relevant Experience</label>
              <input
                type="text"
                value={formData.relevantExperience}
                onChange={(e) => setFormData({ ...formData, relevantExperience: e.target.value })}
                placeholder="e.g. 4 Years Luxury Residential"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: VISIT & INTERVIEW INFORMATION */}
      {step === 3 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Appointment Token / QR Context
              </span>
              <button
                type="button"
                onClick={() => loadSession(tokenInput)}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sessionLoading ? 'animate-spin' : ''}`} />
                Re-verify
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="e.g. WCR-APPT-901"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-hidden focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => loadSession(tokenInput)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Validate
              </button>
            </div>

            {sessionData && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Appointment Verified: {sessionData.token}
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block">Candidate:</span>
                    <span className="font-medium text-white">{sessionData.candidateName || formData.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Scheduled Time:</span>
                    <span className="font-medium text-white">{sessionData.appointmentTime || 'Today'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Interviewer:</span>
                    <span className="font-medium text-white">{sessionData.interviewerName || 'Nisha Verma'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Round:</span>
                    <span className="font-medium text-white">{sessionData.interviewRound || 'Round 1'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Interview Purpose
              </label>
              <input
                type="text"
                value={formData.visitPurpose}
                onChange={(e) => setFormData({ ...formData, visitPurpose: e.target.value })}
                placeholder="Scheduled In-Person Interview"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Interview Type / Round
              </label>
              <input
                type="text"
                value={formData.interviewType}
                onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
                placeholder="Round 1 - Technical Assessment"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Referral / Source (Where did you hear about WCR?)
            </label>
            <input
              type="text"
              value={formData.referralSource}
              onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
              placeholder="e.g. LinkedIn, Consultant, Employee Referral, Walk-in"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* STEP 4: CAPTURE LIVE PHOTO */}
      {step === 4 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Live Arrival Photo Verification</h3>
            <p className="text-xs text-slate-400">
              Live photo is mandatory for front-desk visual escort verification and interviewer candidate badges.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-5 bg-slate-950 border border-slate-800 rounded-2xl min-h-[260px]">
            {cameraActive ? (
              <div className="w-full max-w-md">
                <CameraCapture
                  title="Candidate Live Photo Verification"
                  subtitle="Please position your face within the frame and capture."
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
                  <p className="text-xs text-slate-300 font-medium">Ready to capture your arrival photo</p>
                  <p className="text-[11px] text-slate-500">Fast initialization with constraint fallbacks & auto-watermark</p>
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
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUploadFallback} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: RESUME UPLOAD */}
      {step === 5 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Upload Your Resume</h3>
            <p className="text-xs text-slate-400">
              Accepted formats: PDF, DOCX, PNG, JPG (Max size 10MB)
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-6 sm:p-8 text-center bg-slate-950/60 transition">
            {resumeFile ? (
              <div className="space-y-4">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{resumeFile.name}</h4>
                  <p className="text-xs text-slate-400">{resumeFile.size} • Verified Ready</p>
                </div>
                <div className="flex justify-center gap-3">
                  <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer">
                    Replace File
                    <input type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden" onChange={handleResumeUpload} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/50 text-rose-400 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer space-y-3">
                <div className="w-14 h-14 bg-slate-900 border border-slate-800 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-amber-400 hover:underline">
                    Click to browse
                  </span>{' '}
                  <span className="text-xs text-slate-400">or drag and drop your resume file</span>
                </div>
                <p className="text-[11px] text-slate-500">PDF, JPG, or PNG</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleResumeUpload}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW YOUR DETAILS & SUBMIT */}
      {step === 6 && (
        <div className="space-y-4 py-4 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Review Your Details</h3>
            <p className="text-xs text-slate-400">
              Please inspect your submission. Once confirmed, your arrival will be saved to the database and alerts will immediately route to HR and your interviewer.
            </p>
          </div>

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
                <h4 className="text-sm font-bold text-white">{formData.fullName}</h4>
                <p className="text-amber-400 font-medium">{formData.position}</p>
                <p className="text-[11px] text-slate-400">{formData.phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Experience:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.totalExperience}</span>
              </div>
              <div>
                <span className="text-slate-400">Company:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.currentCompany || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400">Relevant Experience:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.relevantExperience}</span>
              </div>
              <div>
                <span className="text-slate-400">Resume Attached:</span>{' '}
                <span className="text-emerald-400 font-medium">{resumeFile?.name || 'Uploaded'}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-900">
                <span className="text-slate-400">Interview Purpose:</span>{' '}
                <span className="text-slate-200 font-medium">{formData.visitPurpose} ({formData.interviewType})</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Appointment Token: <code className="text-amber-400">{tokenInput}</code></span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Database Sync Ready
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

        {step < 6 ? (
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
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black rounded-xl shadow-xl transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving to Database...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Submit Check-In
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
