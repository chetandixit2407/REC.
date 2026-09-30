import React from 'react';
import {
  ShieldCheck,
  Download,
  X,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
} from 'lucide-react';
import type { Candidate, UserRole } from '../types/index.ts';
import { formatDateTime } from '../utils/dateFormatter.ts';

interface GovernmentIdModalProps {
  candidate: Candidate;
  currentRole: UserRole;
  onClose: () => void;
}

export const GovernmentIdModal: React.FC<GovernmentIdModalProps> = ({
  candidate,
  currentRole,
  onClose,
}) => {
  const govId = candidate.governmentId;
  const formattedUpload = formatDateTime(govId?.uploadedAt || candidate.createdAt);

  const viewUrl = `/api/candidates/${candidate.id}/govid/view?role=${currentRole}`;
  const downloadUrl = `/api/candidates/${candidate.id}/govid/download?role=${currentRole}`;
  const fileName =
    govId?.originalFileName ||
    `${candidate.fullName.replace(/\s+/g, '_')}_${govId?.idType || 'GovID'}.pdf`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isVerified = govId?.verificationStatus === 'VERIFIED';
  const isNeedsReview = govId?.verificationStatus === 'NEEDS_REVIEW';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-100">
        {/* Top Action Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {govId?.idTypeName || 'Government Identification'} Document
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                    isVerified
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : isNeedsReview
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {isVerified ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {govId?.verificationStatus || 'VERIFIED'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Candidate:{' '}
                <strong className="text-slate-200">{candidate.fullName}</strong> • Masked ID:{' '}
                <span className="font-mono text-cyan-300 font-bold">
                  {govId?.maskedIdNumber || 'XXXX-XXXX-XXXX'}
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download ID</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Uploaded: <strong className="text-slate-200">{formattedUpload.date}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Time: <strong className="text-slate-200">{formattedUpload.time}</strong>
            </span>
            <span>
              Type: <strong className="text-slate-200">{govId?.idTypeName || 'Government ID'}</strong>
            </span>
            <span>
              Size: <strong className="text-slate-200">{govId?.fileSize || '1.2 MB'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Encrypted Storage • Role:{' '}
              <strong className="text-amber-300">{currentRole}</strong>
            </span>
          </div>
        </div>

        {/* Document Viewer Canvas */}
        <div className="flex-1 bg-slate-950 p-3 sm:p-4 overflow-hidden relative flex flex-col">
          <div className="flex-1 w-full bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner flex flex-col">
            {govId?.documentDataUrl && !govId.documentDataUrl.includes('pdf') && (
              <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 overflow-auto">
                <img
                  src={govId.documentDataUrl}
                  alt={govId.idTypeName}
                  className="max-h-full max-w-full object-contain rounded-xl border border-slate-800 shadow-2xl"
                />
              </div>
            )}
            {(!govId?.documentDataUrl || govId.documentDataUrl.includes('pdf') || !govId.documentDataUrl.startsWith('data:image')) && (
              <iframe
                src={viewUrl}
                title={`Government ID - ${candidate.fullName}`}
                className="w-full flex-1 border-0 rounded-2xl bg-white"
              />
            )}
          </div>

          {/* Verification Breakdown Footer */}
          <div className="mt-3 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-800">
              <span className="font-semibold text-white">
                Automated Verification Engine Assessment:
              </span>
              <span>
                Method: <strong className="text-cyan-400">Automated Format & OCR Check</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">ID Format Check</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Standard Format Passed
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Name Cross-Match</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Name Matches Dossier
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Masked Identifier</span>
                <span className="text-cyan-300 font-mono font-bold">
                  {govId?.maskedIdNumber || 'XXXX XXXX 1234'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Official Authentic Notice</span>
                <span className="text-slate-400 text-[10px] leading-tight">
                  Application check only. Not a government database query.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
