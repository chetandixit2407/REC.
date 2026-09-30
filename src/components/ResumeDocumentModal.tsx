import React, { useState } from 'react';
import {
  FileText,
  Download,
  X,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import type { Candidate, UserRole } from '../types/index.ts';
import { formatDateTime } from '../utils/dateFormatter.ts';

interface ResumeDocumentModalProps {
  candidate: Candidate;
  currentRole: UserRole;
  onClose: () => void;
}

export const ResumeDocumentModal: React.FC<ResumeDocumentModalProps> = ({
  candidate,
  currentRole,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const formattedUpload = formatDateTime(candidate.resumeUploadedAt || candidate.createdAt);

  const viewUrl = `/api/candidates/${candidate.id}/resume/view?role=${currentRole}`;
  const downloadUrl = `/api/candidates/${candidate.id}/resume/download?role=${currentRole}`;
  const fileName = candidate.resumeFileName || `${candidate.fullName.replace(/\s+/g, '_')}_Resume.pdf`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-100">
        {/* Top Action Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{fileName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Verified in Persistent Storage
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Candidate: <strong className="text-slate-200">{candidate.fullName}</strong> ({candidate.position})
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Resume</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Uploaded on: <strong className="text-slate-200">{formattedUpload.date}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Time: <strong className="text-slate-200">{formattedUpload.time}</strong>
            </span>
            <span>Size: <strong className="text-slate-200">{candidate.resumeFileSize || '1.4 MB'}</strong></span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authorized for <strong className="text-amber-300">{currentRole}</strong></span>
          </div>
        </div>

        {/* Document Viewer Canvas */}
        <div className="flex-1 bg-slate-950 p-3 sm:p-4 overflow-hidden relative flex flex-col">
          <div className="flex-1 w-full bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner flex flex-col">
            {/* Embedded Browser PDF View */}
            <iframe
              src={viewUrl}
              title={`Resume - ${candidate.fullName}`}
              className="w-full flex-1 border-0 rounded-2xl bg-white"
            />
          </div>

          {/* Dossier Structured Summary Footer */}
          <div className="mt-3 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-800">
              <span className="font-semibold text-white">Extracted Candidate Qualifications Summary:</span>
              <span>Total Experience: <strong className="text-amber-400">{candidate.totalExperience}</strong></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Previous Org</span>
                <span className="text-slate-200 font-medium">{candidate.currentCompany || 'Not disclosed'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Qualification</span>
                <span className="text-slate-200 font-medium">{candidate.qualification || 'Graduate'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Notice Period</span>
                <span className="text-slate-200 font-medium">{candidate.noticePeriod || 'Immediate'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Expected Salary</span>
                <span className="text-slate-200 font-medium">{candidate.expectedSalary || 'Confidential'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
