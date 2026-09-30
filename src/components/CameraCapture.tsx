import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FlipHorizontal,
  Upload,
  X,
  ShieldCheck,
  Check,
  Video,
  Sparkles,
  Lock,
} from 'lucide-react';

interface CameraCaptureProps {
  preferredFacingMode?: 'user' | 'environment';
  title?: string;
  subtitle?: string;
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}

type CameraState = 'INITIALIZING' | 'STREAMING' | 'CAPTURED' | 'ERROR';

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  preferredFacingMode = 'user',
  title = 'Live Camera Verification',
  subtitle = 'Capture live arrival photograph with device camera.',
  onCapture,
  onCancel,
}) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(preferredFacingMode);
  const [cameraState, setCameraState] = useState<CameraState>('INITIALIZING');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [captureTimestamp, setCaptureTimestamp] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // Authoritative helper: Explicitly and unconditionally stop all media tracks
  const stopAllMediaTracks = useCallback((streamToStop?: MediaStream | null) => {
    const target = streamToStop || currentStreamRef.current;
    if (target) {
      try {
        const tracks = target.getTracks();
        tracks.forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {
            console.warn('Error stopping individual track', e);
          }
        });
      } catch (err) {
        console.warn('Error during stream tracks traversal', err);
      }
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('Error resetting video element srcObject', e);
      }
    }
    currentStreamRef.current = null;
    setActiveStream(null);
  }, []);

  // Enumerate available video inputs
  const refreshDevicesList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (isMountedRef.current) {
        setAvailableVideoDevices(videoInputs);
      }
    } catch (err) {
      console.warn('Could not enumerate media devices', err);
    }
  }, []);

  // Comprehensive multi-tier camera initialization with automatic constraint retries
  const initializeCamera = useCallback(
    async (targetMode: 'user' | 'environment', customDeviceId?: string | null) => {
      // 1. Teardown any running stream completely
      stopAllMediaTracks();
      setErrorMessage(null);
      setErrorType(null);
      setCameraState('INITIALIZING');
      setIsRetrying(true);

      // 2. Check Secure Context & API Availability
      if (typeof window !== 'undefined' && window.isSecureContext === false && window.location.hostname !== 'localhost') {
        if (isMountedRef.current) {
          setErrorType('SecurityError');
          setErrorMessage('Camera hardware requires a secure HTTPS connection. Please access over https://.');
          setCameraState('ERROR');
          setIsRetrying(false);
        }
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMountedRef.current) {
          setErrorType('NotSupported');
          setErrorMessage(
            'Browser camera API (getUserMedia) is not supported in this browser environment. Please use an updated Chrome, Safari, or Firefox browser.'
          );
          setCameraState('ERROR');
          setIsRetrying(false);
        }
        return;
      }

      // 3. Multi-Tier Progressive Constraint Matrix
      // Tier 1: Desired facingMode with ideal HD resolution
      // Tier 2: Desired facingMode standard constraint
      // Tier 3: Specific deviceId (if specified or available)
      // Tier 4: Inverse facingMode (if hardware only has front or rear camera)
      // Tier 5: Pure unconstrained video (fallback for any working webcam)
      const oppositeMode = targetMode === 'user' ? 'environment' : 'user';

      const constraintTiers: MediaStreamConstraints[] = [];

      if (customDeviceId) {
        constraintTiers.push({
          video: { deviceId: { exact: customDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        constraintTiers.push({
          video: { deviceId: { exact: customDeviceId } },
          audio: false,
        });
      }

      // Tier 1: Target facing mode with ideal resolution
      constraintTiers.push({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Tier 2: Target facing mode with standard constraint
      constraintTiers.push({
        video: {
          facingMode: targetMode,
        },
        audio: false,
      });

      // Tier 3: Inverse facing mode retry (for single camera devices)
      constraintTiers.push({
        video: {
          facingMode: { ideal: oppositeMode },
        },
        audio: false,
      });

      // Tier 4: Universal fallback
      constraintTiers.push({
        video: true,
        audio: false,
      });

      let acquiredStream: MediaStream | null = null;
      let lastCaughtError: any = null;

      for (let i = 0; i < constraintTiers.length; i++) {
        const constraints = constraintTiers[i];
        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (acquiredStream) {
            break;
          }
        } catch (err: any) {
          lastCaughtError = err;
          console.warn(`Camera initialization constraint tier [${i + 1}/${constraintTiers.length}] failed:`, err.name || err.message);
          // If permission explicitly denied, no need to loop further
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            break;
          }
        }
      }

      if (!acquiredStream || !isMountedRef.current) {
        if (acquiredStream) {
          stopAllMediaTracks(acquiredStream);
        }

        let userMsg = 'Unable to initialize device camera preview.';
        const errName = lastCaughtError?.name || 'UnknownError';
        setErrorType(errName);

        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          userMsg =
            'Camera permission was denied. Please tap the camera icon in your browser address bar or settings to allow camera access.';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          userMsg = 'No camera device found. Please verify camera hardware connection or upload a photo.';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          userMsg =
            'Camera hardware is in use by another application or tab. Please close other video apps and retry.';
        } else if (errName === 'OverconstrainedError') {
          userMsg = 'The requested camera settings were not satisfied by the camera sensor. Trying fallback...';
        } else if (errName === 'SecurityError') {
          userMsg = 'Camera access was blocked by browser security policy. Please ensure HTTPS is enabled.';
        } else if (lastCaughtError?.message) {
          userMsg = `Camera Error (${errName}): ${lastCaughtError.message}`;
        }

        if (isMountedRef.current) {
          setErrorMessage(userMsg);
          setCameraState('ERROR');
          setIsRetrying(false);
        }
        return;
      }

      // Stream successfully acquired!
      currentStreamRef.current = acquiredStream;
      setActiveStream(acquiredStream);
      await refreshDevicesList();

      // 4. Attach stream to video element safely
      if (videoRef.current) {
        const video = videoRef.current;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        video.srcObject = acquiredStream;

        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => {
              if (isMountedRef.current) {
                setCameraState('STREAMING');
                setIsRetrying(false);
              }
            })
            .catch((playErr) => {
              console.warn('Video element play() was delayed', playErr);
              if (isMountedRef.current) {
                setCameraState('STREAMING');
                setIsRetrying(false);
              }
            });
        };

        video.oncanplay = () => {
          if (isMountedRef.current) {
            setCameraState('STREAMING');
            setIsRetrying(false);
          }
        };
      } else {
        if (isMountedRef.current) {
          setCameraState('STREAMING');
          setIsRetrying(false);
        }
      }
    },
    [stopAllMediaTracks, refreshDevicesList]
  );

  // Mount & Unmount Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    initializeCamera(facingMode, selectedDeviceId);

    return () => {
      isMountedRef.current = false;
      stopAllMediaTracks();
    };
  }, [facingMode, selectedDeviceId, initializeCamera, stopAllMediaTracks]);

  // Snapping the photo frame with timestamp watermark
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // If user front camera, mirror horizontally for natural portrait view
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      // Reset transformation matrix for watermark
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // Add authoritative WCR watermark band at bottom
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const formattedTimestamp = `${dateStr} • ${timeStr}`;
      setCaptureTimestamp(formattedTimestamp);

      // Subtle bottom gradient overlay
      const gradient = ctx.createLinearGradient(0, height - 48, 0, height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - 48, width, 48);

      // Watermark text
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('WCR VERIFIED ARRIVAL', 16, height - 18);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formattedTimestamp, width - ctx.measureText(formattedTimestamp).width - 16, height - 18);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPhoto(dataUrl);
      setCameraState('CAPTURED');

      // Crucial: Stop media tracks immediately after snapshot is taken
      stopAllMediaTracks();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCaptureTimestamp('');
    initializeCamera(facingMode, selectedDeviceId);
  };

  const handleToggleFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setSelectedDeviceId(null);
  };

  const handleFallbackFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setCapturedPhoto(result);
          setCameraState('CAPTURED');
          setCaptureTimestamp(new Date().toLocaleString());
          stopAllMediaTracks();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Explicit confirmation: permanently stop all tracks before bubbling callback
  const handleConfirm = () => {
    if (capturedPhoto) {
      stopAllMediaTracks();
      onCapture(capturedPhoto);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Camera className="w-4 h-4" />
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {onCancel && (
          <button
            onClick={() => {
              stopAllMediaTracks();
              onCancel();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="p-4 space-y-4 text-center">
        {/* Error State Banner */}
        {cameraState === 'ERROR' && errorMessage && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex flex-col gap-2.5 text-left animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-bold">Camera Initialization Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-200/90">{errorMessage}</p>

            <div className="pt-2 border-t border-rose-500/20 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => initializeCamera(facingMode, selectedDeviceId)}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry Camera
              </button>

              <button
                type="button"
                onClick={handleToggleFacing}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700 transition"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Switch to {facingMode === 'user' ? 'Rear' : 'Front'} Lens
              </button>

              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700 transition">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Upload Photo File
                <input
                  type="file"
                  accept="image/*"
                  capture={facingMode === 'user' ? 'user' : 'environment'}
                  className="hidden"
                  onChange={handleFallbackFileUpload}
                />
              </label>
            </div>
          </div>
        )}

        {/* Viewport Frame */}
        <div className="relative w-full aspect-square max-h-[320px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-inner">
          {cameraState === 'CAPTURED' && capturedPhoto ? (
            <div className="relative w-full h-full animate-in fade-in">
              <img src={capturedPhoto} alt="Captured preview" className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3 bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Captured & Verified
              </div>
              {captureTimestamp && (
                <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-amber-300 font-mono border border-slate-800">
                  {captureTimestamp}
                </div>
              )}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'transform -scale-x-100' : ''
                } ${cameraState === 'STREAMING' ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Initializing Loading State */}
              {cameraState === 'INITIALIZING' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400 p-4">
                  <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-0.5 text-center">
                    <p className="text-xs font-semibold text-slate-200">Initializing Camera Hardware...</p>
                    <p className="text-[11px] text-slate-500">
                      Testing constraints ({facingMode === 'user' ? 'Front Portrait' : 'Rear Lens'})
                    </p>
                  </div>
                </div>
              )}

              {/* Camera Live Overlay HUD */}
              {cameraState === 'STREAMING' && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 backdrop-blur-xs rounded-full border border-slate-800 text-[10px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE PREVIEW
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleToggleFacing}
                      className="p-2 bg-slate-950/80 hover:bg-slate-800 backdrop-blur-xs rounded-xl border border-slate-800 text-slate-200 hover:text-amber-400 transition cursor-pointer"
                      title="Switch Camera (Front/Rear)"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Face Framing Target Overlay */}
                  <div className="absolute inset-10 border-2 border-dashed border-amber-400/40 rounded-2xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] text-amber-400/60 font-semibold bg-slate-950/60 px-2 py-0.5 rounded-full">
                      Align Face Here
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="pt-2">
          {cameraState === 'STREAMING' ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCapture}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Camera className="w-4 h-4" />
                Capture Live Photo
              </button>

              <button
                type="button"
                onClick={handleToggleFacing}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer"
                title="Switch Camera"
              >
                <FlipHorizontal className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          ) : cameraState === 'CAPTURED' ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Retake
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Confirm & Attach Photo
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => initializeCamera(facingMode, selectedDeviceId)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition shadow"
              >
                <RefreshCw className="w-4 h-4" />
                Initialize Camera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
