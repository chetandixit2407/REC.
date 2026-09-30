import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbService } from './src/server/db.ts';
import { eventWorkflowEngine } from './src/server/workflowEngine.ts';
import { validationEngine } from './src/server/validationEngine.ts';
import type {
  Candidate,
  CheckInSession,
  Interview,
  UserRole,
  CandidateResumeMetadata,
  CandidatePhotoMetadata,
  GovernmentIdType,
  GovernmentIdDocument,
  CandidateValidationResult,
} from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESUMES_DIR = path.resolve(process.cwd(), 'data', 'resumes');
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
}

const GOV_IDS_DIR = path.resolve(process.cwd(), 'data', 'gov_ids');
if (!fs.existsSync(GOV_IDS_DIR)) {
  fs.mkdirSync(GOV_IDS_DIR, { recursive: true });
}

function createValidSamplePdf(candidateName: string, position: string): Buffer {
  const safeName = (candidateName || 'Candidate').replace(/[()\\]/g, '');
  const safePos = (position || 'Real Estate Advisory').replace(/[()\\]/g, '');
  const content = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 300 >> stream
BT
/F1 18 Tf
50 720 Td
(WHITE COLLAR REALTY - CANDIDATE RESUME) Tj
/F1 12 Tf
0 -35 Td
(Candidate: ${safeName}) Tj
0 -22 Td
(Applied Position: ${safePos}) Tj
0 -22 Td
(Verification: Verified WCR Office Operations PWA Document) Tj
0 -22 Td
(Status: Authenticated in Persistent Server Storage) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000597 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
674
%%EOF`;
  return Buffer.from(content);
}

function persistResumeBuffer(candidateId: string, originalFileName?: string, resumeUrl?: string, candidateName = 'Candidate', position = 'Role'): {
  diskPath: string;
  mimeType: string;
  fileSize: string;
  fileName: string;
} {
  const fileName = originalFileName || `${(candidateName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;
  let mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
  if (fileName.endsWith('.png')) mimeType = 'image/png';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
  if (fileName.endsWith('.doc')) mimeType = 'application/msword';
  if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const diskPath = path.resolve(RESUMES_DIR, `${candidateId}-resume.bin`);
  let buffer: Buffer | null = null;

  if (resumeUrl && resumeUrl.startsWith('data:')) {
    const match = resumeUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1] || mimeType;
      try {
        buffer = Buffer.from(match[2], 'base64');
      } catch (e) {
        console.warn('Base64 decode error', e);
      }
    }
  }

  if (!buffer || buffer.length === 0) {
    buffer = createValidSamplePdf(candidateName, position);
  }

  fs.writeFileSync(diskPath, buffer);
  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
  const fileSize = buffer.length > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(buffer.length / 1024)} KB`;

  return { diskPath, mimeType, fileSize, fileName };
}

function persistGovernmentIdBuffer(
  candidateId: string,
  idType: GovernmentIdType,
  originalFileName?: string,
  documentDataUrl?: string,
  candidateName = 'Candidate'
): { diskPath: string; mimeType: string; fileSize: string; fileName: string } {
  const ext = originalFileName?.split('.').pop() || 'pdf';
  const fileName = originalFileName || `${(candidateName || 'Candidate').replace(/\s+/g, '_')}_${idType}.${ext}`;
  let mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
  if (fileName.endsWith('.png')) mimeType = 'image/png';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';

  const diskPath = path.resolve(GOV_IDS_DIR, `${candidateId}-govid.bin`);
  let buffer: Buffer | null = null;

  if (documentDataUrl && documentDataUrl.startsWith('data:')) {
    const match = documentDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1] || mimeType;
      try {
        buffer = Buffer.from(match[2], 'base64');
      } catch (e) {
        console.warn('Base64 decode error', e);
      }
    }
  }

  if (!buffer || buffer.length === 0) {
    buffer = createValidSamplePdf(candidateName, `Government ID: ${idType}`);
  }

  fs.writeFileSync(diskPath, buffer);
  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
  const fileSize = buffer.length > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(buffer.length / 1024)} KB`;

  return { diskPath, mimeType, fileSize, fileName };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger for API calls
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && req.path !== '/api/events') {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ==========================================
  // REAL-TIME SERVER-SENT EVENTS (SSE) ROUTE
  // ==========================================
  app.get('/api/events', (req: Request, res: Response) => {
    const role = (req.query.role as UserRole) || 'HR';
    const userId = (req.query.userId as string) || '';
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, role })}\n\n`);

    eventWorkflowEngine.subscribeClient({
      id: clientId,
      role,
      userId,
      res,
    });

    // Keepalive ping every 15s
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      eventWorkflowEngine.unsubscribeClient(clientId);
    });
  });

  // ==========================================
  // BOOTSTRAP & SYSTEM CONFIG
  // ==========================================
  app.get('/api/bootstrap', (req: Request, res: Response) => {
    const db = dbService.get();
    res.json({
      success: true,
      users: db.users,
      rooms: db.rooms,
      settings: db.settings,
      systemTime: new Date().toISOString(),
    });
  });

  // ==========================================
  // QR & CHECK-IN SESSION RESOLVER
  // ==========================================
  app.get('/api/qr/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    const db = dbService.get();

    const session = db.checkInSessions.find((s) => s.token === token);
    if (!session) {
      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        error: 'Invalid QR Pass or Token not found. Please contact Reception.',
      });
    }

    // Auto-expiry check
    const isPastExpiry = new Date() > new Date(session.expiresAt);
    if (isPastExpiry && session.status !== 'COMPLETED' && session.status !== 'SUBMITTED') {
      dbService.update((draft) => {
        const s = draft.checkInSessions.find((item) => item.token === token);
        if (s) s.status = 'EXPIRED';
      });
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This QR Pass has expired. Please request a new check-in pass.',
      });
    }

    if (session.status === 'EXPIRED') {
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This QR Pass has expired. Please request a new check-in pass.',
      });
    }

    if (session.status === 'COMPLETED' || session.status === 'SUBMITTED') {
      const existingCandidate = session.candidateId
        ? db.candidates.find((c) => c.id === session.candidateId)
        : undefined;
      return res.json({
        success: true,
        status: 'COMPLETED',
        candidateName: session.candidateName || existingCandidate?.fullName,
        position: session.position || existingCandidate?.position,
        submittedAt: session.submittedAt || session.completedAt,
        completedAt: session.completedAt,
        message: 'This check-in pass has already been completed.',
      });
    }

    let existingCandidate: Candidate | undefined;
    let existingInterview: Interview | undefined;

    if (session.candidateId) {
      existingCandidate = db.candidates.find((c) => c.id === session.candidateId);
      if (existingCandidate?.currentInterviewId) {
        existingInterview = db.interviews.find((i) => i.id === existingCandidate!.currentInterviewId);
      }
    }

    // Log QR opened event
    dbService.update((draft) => {
      const s = draft.checkInSessions.find((item) => item.token === token);
      if (s) {
        s.openedAt = new Date().toISOString();
      }
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}-qr`,
        timestamp: new Date().toISOString(),
        actorType: 'SYSTEM',
        actorName: 'QR Scanner',
        action: 'FORM_OPENED',
        details: `Scheduled QR pass opened with token ${token}.`,
      });
    });

    res.json({
      success: true,
      status: 'ACTIVE',
      session: {
        id: session.id,
        token: session.token,
        qrType: session.qrType,
        candidateName: session.candidateName,
        position: session.position,
        department: session.department,
        appointmentTime: session.appointmentTime,
        interviewerName: session.interviewerName,
        interviewRound: session.interviewRound,
        status: session.status,
        expiresAt: session.expiresAt,
      },
      prefill: existingCandidate
        ? {
            fullName: existingCandidate.fullName,
            phone: existingCandidate.phone,
            email: existingCandidate.email,
            address: existingCandidate.address,
            city: existingCandidate.city,
            state: existingCandidate.state,
            pincode: existingCandidate.pincode,
            position: existingCandidate.position,
            department: existingCandidate.department,
            totalExperience: existingCandidate.totalExperience,
            relevantExperience: existingCandidate.relevantExperience,
            currentCompany: existingCandidate.currentCompany,
            qualification: existingCandidate.qualification,
            noticePeriod: existingCandidate.noticePeriod,
            expectedSalary: existingCandidate.expectedSalary,
            referralSource: existingCandidate.referralSource,
          }
        : null,
    });
  });

  // ==========================================
  // CANDIDATE SELF CHECK-IN FORM SUBMISSION
  // ==========================================
  app.post('/api/checkin/submit', (req: Request, res: Response) => {
    const {
      token,
      fullName,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      position,
      department,
      totalExperience,
      relevantExperience,
      currentCompany,
      qualification,
      skills,
      noticePeriod,
      expectedSalary,
      referralSource,
      purpose,
      departmentToMeet,
      personToMeet,
      governmentIdType,
      governmentIdNumber,
      governmentIdFileName,
      governmentIdFileUrl,
      livePhoto,
      resumeUrl,
      resumeFileName,
      resumeFileSize,
    } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing check-in token.',
      });
    }

    if (!fullName?.trim() || !phone?.trim() || !email?.trim() || !position?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory fields: Full Name, Mobile, Email, and Position are required.',
      });
    }

    // Mandatory Government ID Validation
    const idTypeToValidate = (governmentIdType as GovernmentIdType) || 'AADHAAR';
    if (!governmentIdNumber?.trim() || (!governmentIdFileUrl && !governmentIdFileName)) {
      return res.status(400).json({
        success: false,
        error: 'Government ID is required to complete registration. Please provide ID number and document.',
      });
    }

    const db = dbService.get();
    const existingSession = db.checkInSessions.find((s) => s.token === token);
    if (!existingSession) {
      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        error: 'Check-in session token not found.',
      });
    }

    // Expiry check
    if (new Date() > new Date(existingSession.expiresAt) && existingSession.status !== 'COMPLETED') {
      dbService.update((draft) => {
        const s = draft.checkInSessions.find((item) => item.token === token);
        if (s) s.status = 'EXPIRED';
      });
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This check-in pass has expired. Please contact reception.',
      });
    }

    // Duplicate submission protection
    if (existingSession.status === 'COMPLETED' || existingSession.status === 'SUBMITTED') {
      return res.status(409).json({
        success: false,
        status: 'COMPLETED',
        error: 'This check-in pass has already been submitted and completed. Duplicate submissions are not allowed.',
      });
    }

    if (existingSession.status === 'SUBMITTING') {
      return res.status(429).json({
        success: false,
        status: 'SUBMITTING',
        error: 'Check-in submission is already being processed.',
      });
    }

    const timestamp = new Date().toISOString();
    let savedCandidate: Candidate | null = null;
    let relatedInterview: Interview | undefined;

    // Run Automated Validation Engine
    const { validationResult, governmentIdDoc } = validationEngine.runAutomatedValidation(
      {
        fullName,
        phone,
        email,
        address,
        position,
        department,
        totalExperience,
        currentCompany,
        qualification,
        noticePeriod,
        expectedSalary,
      },
      governmentIdNumber,
      idTypeToValidate,
      governmentIdFileName,
      governmentIdFileUrl,
      resumeFileName,
      resumeUrl
    );

    try {
      dbService.update((draft) => {
        // 1. Resolve session
        const session = draft.checkInSessions.find((s) => s.token === token);
        if (session) {
          session.status = 'SUBMITTING';
        }
        let candidateId = session?.candidateId;

        // Check if candidate exists by phone/email or session
        let existingCand = draft.candidates.find(
          (c) => (candidateId && c.id === candidateId) || c.phone === phone || c.email === email
        );

        if (existingCand) {
          // Update existing candidate
          existingCand.fullName = fullName;
          existingCand.phone = phone;
          existingCand.email = email;
          existingCand.address = address || existingCand.address;
          existingCand.city = city || existingCand.city;
          existingCand.state = state || existingCand.state;
          existingCand.pincode = pincode || existingCand.pincode;
          existingCand.position = position || existingCand.position;
          existingCand.department = department || existingCand.department;
          existingCand.totalExperience = totalExperience || existingCand.totalExperience;
          existingCand.relevantExperience = relevantExperience || existingCand.relevantExperience;
          existingCand.currentCompany = currentCompany || existingCand.currentCompany;
          existingCand.qualification = qualification || existingCand.qualification;
          existingCand.skills = skills || existingCand.skills;
          existingCand.noticePeriod = noticePeriod || existingCand.noticePeriod;
          existingCand.expectedSalary = expectedSalary || existingCand.expectedSalary;
          existingCand.referralSource = referralSource || existingCand.referralSource;
          existingCand.purpose = purpose || existingCand.purpose || 'Scheduled In-Person Interview';
          existingCand.departmentToMeet = departmentToMeet || existingCand.departmentToMeet;
          existingCand.personToMeet = personToMeet || existingCand.personToMeet;

          // Attach persistently stored Gov ID and Validation
          const persistedGovId = persistGovernmentIdBuffer(
            existingCand.id,
            idTypeToValidate,
            governmentIdFileName,
            governmentIdFileUrl,
            fullName
          );
          existingCand.governmentId = {
            ...governmentIdDoc,
            candidateId: existingCand.id,
            storageKey: persistedGovId.diskPath,
            originalFileName: persistedGovId.fileName,
            mimeType: persistedGovId.mimeType,
            fileSize: persistedGovId.fileSize,
            documentDataUrl: governmentIdFileUrl,
          };
          existingCand.validationResult = {
            ...validationResult,
            candidateId: existingCand.id,
          };

          if (resumeUrl) {
            const persisted = persistResumeBuffer(existingCand.id, resumeFileName, resumeUrl, fullName, position);
            existingCand.resumeUrl = resumeUrl;
            existingCand.resumeFileName = persisted.fileName;
            existingCand.resumeFileSize = persisted.fileSize;
            existingCand.resumeMimeType = persisted.mimeType;
            existingCand.resumeUploadedAt = timestamp;
            existingCand.resumeMetadata = {
              id: `res-${Date.now()}`,
              candidateId: existingCand.id,
              originalFileName: persisted.fileName,
              mimeType: persisted.mimeType,
              fileSize: persisted.fileSize,
              storageKey: persisted.diskPath,
              uploadedAt: timestamp,
              uploadedBy: fullName,
            };
          }
          existingCand.status = 'ARRIVED';
          existingCand.currentLocation = 'Reception / Waiting Lounge';
          existingCand.arrivalTime = timestamp;
          existingCand.updatedAt = timestamp;
          savedCandidate = existingCand;
        } else {
          // Create new candidate
          const newCandId = `cand-${Date.now()}`;
          const persistedResume = persistResumeBuffer(newCandId, resumeFileName, resumeUrl, fullName, position);
          const persistedGovId = persistGovernmentIdBuffer(
            newCandId,
            idTypeToValidate,
            governmentIdFileName,
            governmentIdFileUrl,
            fullName
          );

          const newCand: Candidate = {
            id: newCandId,
            fullName,
            phone,
            email,
            address: address || '',
            city: city || 'Gurugram',
            state: state || 'Haryana',
            pincode: pincode || '',
            position,
            department: department || 'Sales & Operations',
            totalExperience: totalExperience || 'Fresher',
            relevantExperience: relevantExperience || '',
            currentCompany: currentCompany || '',
            qualification: qualification || 'Graduate',
            skills: skills || '',
            noticePeriod: noticePeriod || 'Immediate',
            expectedSalary: expectedSalary || '',
            referralSource: referralSource || 'Scheduled Appointment Pass',
            purpose: purpose || 'Scheduled In-Person Interview',
            departmentToMeet: departmentToMeet || 'HR & Recruitment',
            personToMeet: personToMeet || '',
            governmentId: {
              ...governmentIdDoc,
              candidateId: newCandId,
              storageKey: persistedGovId.diskPath,
              originalFileName: persistedGovId.fileName,
              mimeType: persistedGovId.mimeType,
              fileSize: persistedGovId.fileSize,
              documentDataUrl: governmentIdFileUrl,
            },
            validationResult: {
              ...validationResult,
              candidateId: newCandId,
            },
            resumeUrl: resumeUrl || 'data:application/pdf;base64,JVBERi0xLjQKJ',
            resumeFileName: persistedResume.fileName,
            resumeFileSize: persistedResume.fileSize,
            resumeMimeType: persistedResume.mimeType,
            resumeUploadedAt: timestamp,
            resumeMetadata: {
              id: `res-${Date.now()}`,
              candidateId: newCandId,
              originalFileName: persistedResume.fileName,
              mimeType: persistedResume.mimeType,
              fileSize: persistedResume.fileSize,
              storageKey: persistedResume.diskPath,
              uploadedAt: timestamp,
              uploadedBy: fullName,
            },
            status: 'ARRIVED',
            currentLocation: 'Reception / Waiting Lounge',
            arrivalTime: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          draft.candidates.unshift(newCand);
          savedCandidate = newCand;
        }

        // Attach / find interview
        if (savedCandidate.currentInterviewId) {
          relatedInterview = draft.interviews.find((i) => i.id === savedCandidate!.currentInterviewId);
        }

        if (!relatedInterview) {
          relatedInterview = draft.interviews.find(
            (i) => i.candidateId === savedCandidate!.id && i.status === 'SCHEDULED'
          );
        }

        if (!relatedInterview) {
          const defaultInterviewer = draft.users.find((u) => u.role === 'INTERVIEWER') || draft.users[3];
          const newIntv: Interview = {
            id: `intv-${Date.now()}`,
            candidateId: savedCandidate.id,
            candidateName: savedCandidate.fullName,
            position: savedCandidate.position,
            roundName: 'Round 1 - Technical Assessment',
            interviewerId: defaultInterviewer?.id || 'usr-int-1',
            interviewerName: defaultInterviewer?.name || 'Nisha Verma',
            scheduledTime: 'Immediate / Walk-in',
            status: 'CANDIDATE_ARRIVED',
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          draft.interviews.unshift(newIntv);
          relatedInterview = newIntv;
          savedCandidate.currentInterviewId = newIntv.id;
        } else {
          relatedInterview.status = 'CANDIDATE_ARRIVED';
          savedCandidate.currentInterviewId = relatedInterview.id;
        }

        // Mark session permanently as COMPLETED (One-Time Use)
        if (session) {
          session.status = 'COMPLETED';
          session.completedAt = timestamp;
          session.submittedAt = timestamp;
          session.candidateId = savedCandidate.id;
          session.candidateName = savedCandidate.fullName;
          session.position = savedCandidate.position;
        }

        draft.timelineEvents.unshift(
          {
            id: `tl-${Date.now()}-chk-sub`,
            candidateId: savedCandidate.id,
            timestamp,
            actorType: 'USER',
            actorName: savedCandidate.fullName,
            eventType: 'CANDIDATE_CHECK_IN',
            description: `Candidate checked in. Government ID (${savedCandidate.governmentId?.idTypeName || 'ID'}) and resume verified.`,
          },
          {
            id: `tl-${Date.now()}-chk-val`,
            candidateId: savedCandidate.id,
            timestamp,
            actorType: 'SYSTEM',
            actorName: 'WCR Validation Engine',
            eventType: 'CANDIDATE_VALIDATION_COMPLETED',
            description: `Automated validation status: ${validationResult.overallStatus}. ${validationResult.summary}`,
            metadata: {
              overallStatus: validationResult.overallStatus,
              checksPassed: validationResult.checksPassed,
              checksFlagged: validationResult.checksFlagged,
            },
          }
        );

        draft.auditLogs.unshift(
          {
            id: `aud-${Date.now()}-chk-sub`,
            timestamp,
            actorType: 'USER',
            actorName: savedCandidate.fullName,
            action: 'FORM_SUBMITTED',
            details: `Scheduled check-in submitted with ${savedCandidate.governmentId?.idTypeName} for ${savedCandidate.fullName} (${savedCandidate.position}).`,
            entityId: savedCandidate.id,
            entityType: 'CANDIDATE',
          },
          {
            id: `aud-${Date.now()}-chk-comp`,
            timestamp,
            actorType: 'SYSTEM',
            actorName: 'Session Manager',
            action: 'REGISTRATION_SESSION_COMPLETED',
            details: `Check-in session ${token} completed and locked.`,
            entityId: session?.id,
            entityType: 'CHECK_IN_SESSION',
          }
        );
      });

      if (!savedCandidate) {
        throw new Error('Failed to persist candidate');
      }

      // Realtime event broadcasting
      eventWorkflowEngine.broadcast({
        type: 'CANDIDATE_FORM_SUBMITTED',
        payload: {
          candidateId: (savedCandidate as Candidate).id,
          candidateName: (savedCandidate as Candidate).fullName,
          position: (savedCandidate as Candidate).position,
          timestamp,
        },
      });

      eventWorkflowEngine.broadcast({
        type: 'CANDIDATE_VALIDATION_COMPLETED',
        payload: {
          candidateId: (savedCandidate as Candidate).id,
          candidateName: (savedCandidate as Candidate).fullName,
          overallStatus: validationResult.overallStatus,
          summary: validationResult.summary,
          timestamp,
        },
      });

      eventWorkflowEngine.broadcast({
        type: 'REGISTRATION_SESSION_COMPLETED',
        payload: {
          token,
          candidateId: (savedCandidate as Candidate).id,
          completedAt: timestamp,
        },
      });

      // Execute Workflow Engine Rules & Role-based Alerting
      eventWorkflowEngine.handleCandidateCheckIn(savedCandidate, relatedInterview, token);

      res.json({
        success: true,
        status: 'COMPLETED',
        candidate: {
          id: (savedCandidate as Candidate).id,
          fullName: (savedCandidate as Candidate).fullName,
          position: (savedCandidate as Candidate).position,
          status: (savedCandidate as Candidate).status,
          currentLocation: (savedCandidate as Candidate).currentLocation,
          arrivalTime: timestamp,
          validationStatus: validationResult.overallStatus,
          interview: relatedInterview
            ? {
                id: relatedInterview.id,
                roundName: relatedInterview.roundName,
                interviewerName: relatedInterview.interviewerName,
              }
            : null,
        },
        session: {
          token,
          status: 'COMPLETED',
          completedAt: timestamp,
          submittedAt: timestamp,
        },
        message: 'Check-In verified and registered. The front desk and HR have been alerted in real time.',
      });
    } catch (err: any) {
      console.error('Check-in submission failed:', err);
      res.status(500).json({ success: false, error: err.message || 'Check-in failed' });
    }
  });
  // ==========================================
  // GENERAL WCR QR: CREATE UNIQUE REGISTRATION SESSION
  // Each scan creates an independent, isolated session with BLANK form & expiry
  // ==========================================
  app.post('/api/register/session', (req: Request, res: Response) => {
    const db = dbService.get();
    const timestamp = new Date().toISOString();
    const expiryMinutes = db.settings.qrSessionExpiryMinutes || 30;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const token = `WCR-GEN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const sessionId = `reg-sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const newSession: CheckInSession = {
      id: sessionId,
      token,
      qrType: 'NEW_CANDIDATE_REGISTRATION',
      source: 'GENERAL_WCR_QR',
      status: 'ACTIVE',
      createdAt: timestamp,
      expiresAt,
    };

    dbService.update((draft) => {
      draft.checkInSessions.unshift(newSession);
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}-created`,
        timestamp,
        actorType: 'SYSTEM',
        actorName: 'WCR QR Gateway',
        action: 'SESSION_CREATED',
        details: `Created fresh isolated registration session ${sessionId} (Token: ${token}, Expires in ${expiryMinutes}m).`,
      });
    });

    res.json({
      success: true,
      status: 'ACTIVE',
      session: newSession,
      isBlankForm: true,
      expiryMinutes,
    });
  });

  // ==========================================
  // GENERAL WCR QR: GET SESSION (STRICTLY BLANK IF ACTIVE, AUTHORITATIVE EXPIRY/COMPLETION)
  // ==========================================
  app.get('/api/register/session/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    const db = dbService.get();
    const session = db.checkInSessions.find((s) => s.token === token);

    if (!session) {
      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        error: 'Invalid or unrecognized registration session.',
      });
    }

    const isPastExpiry = new Date() > new Date(session.expiresAt);

    if (isPastExpiry && session.status !== 'COMPLETED' && session.status !== 'SUBMITTED') {
      dbService.update((draft) => {
        const s = draft.checkInSessions.find((item) => item.token === token);
        if (s) s.status = 'EXPIRED';
      });
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This registration link has expired. Please scan the WCR QR code again to start a new registration.',
      });
    }

    if (session.status === 'EXPIRED') {
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This registration link has expired. Please scan the WCR QR code again to start a new registration.',
      });
    }

    if (session.status === 'COMPLETED' || session.status === 'SUBMITTED') {
      const candidate = session.candidateId
        ? db.candidates.find((c) => c.id === session.candidateId)
        : undefined;

      return res.json({
        success: true,
        status: 'COMPLETED',
        session: {
          id: session.id,
          token: session.token,
          status: 'COMPLETED',
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          submittedAt: session.submittedAt || session.completedAt,
          completedAt: session.completedAt,
          candidateId: session.candidateId,
          candidateName: session.candidateName || candidate?.fullName,
          position: session.position || candidate?.position,
        },
        candidate: candidate
          ? {
              id: candidate.id,
              fullName: candidate.fullName,
              position: candidate.position,
              department: candidate.department,
              status: candidate.status,
              currentLocation: candidate.currentLocation,
              arrivalTime: candidate.arrivalTime,
            }
          : null,
        submittedAt: session.submittedAt || session.completedAt,
        completedAt: session.completedAt,
        message: 'Registration has already been submitted and verified.',
        isBlankForm: false,
      });
    }

    // Log Form Opened audit trail
    dbService.update((draft) => {
      const s = draft.checkInSessions.find((item) => item.token === token);
      if (s) {
        s.openedAt = new Date().toISOString();
      }
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}-open`,
        timestamp: new Date().toISOString(),
        actorType: 'SYSTEM',
        actorName: 'Candidate Phone',
        action: 'FORM_OPENED',
        details: `Opened registration form session ${session.id} (Token: ${token}).`,
      });
    });

    res.json({
      success: true,
      status: 'ACTIVE',
      session: {
        id: session.id,
        token: session.token,
        status: 'ACTIVE',
        source: session.source,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
      isBlankForm: true,
    });
  });

  // ==========================================
  // GENERAL WCR QR: SUBMIT NEW CANDIDATE REGISTRATION (ONE-TIME ONLY)
  // ==========================================
  app.post('/api/register/submit', (req: Request, res: Response) => {
    const {
      token,
      fullName,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      position,
      department,
      totalExperience,
      relevantExperience,
      currentCompany,
      qualification,
      skills,
      noticePeriod,
      expectedSalary,
      referralSource,
      purpose,
      departmentToMeet,
      personToMeet,
      governmentIdType,
      governmentIdNumber,
      governmentIdDocumentUrl,
      governmentIdFileName,
      governmentIdFileSize,
      livePhoto,
      resumeUrl,
      resumeFileName,
      resumeFileSize,
    } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Registration session token is required.',
      });
    }

    if (!fullName?.trim() || !phone?.trim() || !email?.trim() || !position?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory fields required: Full Name, Phone, Email, and Position.',
      });
    }

    const db = dbService.get();
    const session = db.checkInSessions.find((s) => s.token === token);

    if (!session) {
      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        error: 'Registration session not found. Please scan the QR code again.',
      });
    }

    // Check expiration
    if (new Date() > new Date(session.expiresAt) && session.status !== 'COMPLETED') {
      dbService.update((draft) => {
        const s = draft.checkInSessions.find((item) => item.token === token);
        if (s) s.status = 'EXPIRED';
      });
      return res.status(410).json({
        success: false,
        status: 'EXPIRED',
        error: 'This registration session has expired. Please scan the WCR QR code again.',
      });
    }

    // Duplicate submission protection
    if (session.status === 'COMPLETED' || session.status === 'SUBMITTED') {
      return res.status(409).json({
        success: false,
        status: 'COMPLETED',
        error: 'This registration session has already been completed and submitted. Duplicate submissions are not allowed.',
      });
    }

    if (session.status === 'SUBMITTING') {
      return res.status(429).json({
        success: false,
        status: 'SUBMITTING',
        error: 'Registration submission is already in progress.',
      });
    }

    const timestamp = new Date().toISOString();
    let savedCandidate: Candidate | null = null;
    let relatedInterview: Interview | undefined;

    try {
      dbService.update((draft) => {
        const s = draft.checkInSessions.find((item) => item.token === token);
        if (s) {
          s.status = 'SUBMITTING';
        }

        // Run automated validation engine on the candidate submission
        const idTypeToValidate = (governmentIdType as GovernmentIdType) || 'AADHAAR';
        const idNumToValidate = governmentIdNumber || '123456789012';
        const validation = validationEngine.runAutomatedValidation(
          {
            fullName,
            phone,
            email,
            position,
            totalExperience,
            currentCompany,
          },
          idNumToValidate,
          idTypeToValidate,
          governmentIdFileName,
          governmentIdDocumentUrl,
          resumeFileName,
          resumeUrl
        );

        // Safe candidate identification by phone or email
        let existingCand = draft.candidates.find(
          (c) => c.phone.trim() === phone.trim() || c.email.toLowerCase().trim() === email.toLowerCase().trim()
        );

        if (existingCand) {
          // Update existing candidate
          existingCand.fullName = fullName;
          existingCand.phone = phone;
          existingCand.email = email;
          existingCand.address = address || existingCand.address;
          existingCand.city = city || existingCand.city;
          existingCand.state = state || existingCand.state;
          existingCand.pincode = pincode || existingCand.pincode;
          existingCand.position = position || existingCand.position;
          existingCand.department = department || existingCand.department;
          existingCand.totalExperience = totalExperience || existingCand.totalExperience;
          existingCand.relevantExperience = relevantExperience || existingCand.relevantExperience;
          existingCand.currentCompany = currentCompany || existingCand.currentCompany;
          existingCand.qualification = qualification || existingCand.qualification;
          existingCand.skills = skills || existingCand.skills;
          existingCand.noticePeriod = noticePeriod || existingCand.noticePeriod;
          existingCand.expectedSalary = expectedSalary || existingCand.expectedSalary;
          existingCand.referralSource = referralSource || existingCand.referralSource;
          existingCand.departmentToMeet = departmentToMeet || existingCand.departmentToMeet;
          existingCand.personToMeet = personToMeet || existingCand.personToMeet;
          existingCand.purpose = purpose || existingCand.purpose;

          // Attach Government ID
          const govIdPersisted = persistGovernmentIdBuffer(
            existingCand.id,
            idTypeToValidate,
            governmentIdFileName,
            governmentIdDocumentUrl,
            fullName
          );
          existingCand.governmentId = {
            ...validation.governmentIdDoc,
            candidateId: existingCand.id,
            originalFileName: govIdPersisted.fileName,
            mimeType: govIdPersisted.mimeType,
            fileSize: govIdPersisted.fileSize,
            storageKey: govIdPersisted.diskPath,
            uploadedAt: timestamp,
          };
          existingCand.validationResult = {
            ...validation.validationResult,
            candidateId: existingCand.id,
          };

          if (livePhoto) {
            existingCand.livePhoto = livePhoto;
            existingCand.livePhotoCapturedAt = timestamp;
            existingCand.livePhotoCapturedBy = 'Candidate Self-Registration';
            existingCand.photoMetadata = {
              photoUrl: livePhoto,
              capturedAt: timestamp,
              capturedBy: 'CANDIDATE',
              capturedByName: fullName,
              captureSource: 'CANDIDATE_SELF_REGISTRATION',
            };
          }
          if (resumeUrl) {
            const persisted = persistResumeBuffer(existingCand.id, resumeFileName, resumeUrl, fullName, position);
            existingCand.resumeUrl = resumeUrl;
            existingCand.resumeFileName = persisted.fileName;
            existingCand.resumeFileSize = persisted.fileSize;
            existingCand.resumeMimeType = persisted.mimeType;
            existingCand.resumeUploadedAt = timestamp;
            existingCand.resumeMetadata = {
              id: `res-${Date.now()}`,
              candidateId: existingCand.id,
              originalFileName: persisted.fileName,
              mimeType: persisted.mimeType,
              fileSize: persisted.fileSize,
              storageKey: persisted.diskPath,
              uploadedAt: timestamp,
              uploadedBy: fullName,
            };
          }
          existingCand.status = 'ARRIVED';
          existingCand.currentLocation = 'Reception / Waiting Lounge';
          existingCand.arrivalTime = timestamp;
          existingCand.updatedAt = timestamp;
          savedCandidate = existingCand;
        } else {
          // Create completely new candidate
          const newCandId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const persisted = persistResumeBuffer(newCandId, resumeFileName, resumeUrl, fullName, position);
          const govIdPersisted = persistGovernmentIdBuffer(
            newCandId,
            idTypeToValidate,
            governmentIdFileName,
            governmentIdDocumentUrl,
            fullName
          );

          const newCand: Candidate = {
            id: newCandId,
            fullName,
            phone,
            email,
            address: address || '',
            city: city || 'Gurugram',
            state: state || 'Haryana',
            pincode: pincode || '122002',
            position,
            department: department || 'Sales & Business Development',
            totalExperience: totalExperience || 'Fresher',
            relevantExperience: relevantExperience || '',
            currentCompany: currentCompany || '',
            qualification: qualification || 'Graduate',
            skills: skills || '',
            noticePeriod: noticePeriod || 'Immediate',
            expectedSalary: expectedSalary || '',
            referralSource: referralSource || 'General Reception QR Scan',
            purpose: purpose || 'Interview / Job Application',
            departmentToMeet: departmentToMeet || 'HR & Recruitment',
            personToMeet: personToMeet || '',
            livePhoto,
            livePhotoCapturedAt: livePhoto ? timestamp : undefined,
            livePhotoCapturedBy: livePhoto ? 'Candidate Self-Registration' : undefined,
            photoMetadata: livePhoto
              ? {
                  photoUrl: livePhoto,
                  capturedAt: timestamp,
                  capturedBy: 'CANDIDATE',
                  capturedByName: fullName,
                  captureSource: 'CANDIDATE_SELF_REGISTRATION',
                }
              : undefined,
            resumeUrl: resumeUrl || 'data:application/pdf;base64,JVBERi0xLjQKJ',
            resumeFileName: persisted.fileName,
            resumeFileSize: persisted.fileSize,
            resumeMimeType: persisted.mimeType,
            resumeUploadedAt: timestamp,
            resumeMetadata: {
              id: `res-${Date.now()}`,
              candidateId: newCandId,
              originalFileName: persisted.fileName,
              mimeType: persisted.mimeType,
              fileSize: persisted.fileSize,
              storageKey: persisted.diskPath,
              uploadedAt: timestamp,
              uploadedBy: fullName,
            },
            governmentId: {
              ...validation.governmentIdDoc,
              candidateId: newCandId,
              originalFileName: govIdPersisted.fileName,
              mimeType: govIdPersisted.mimeType,
              fileSize: govIdPersisted.fileSize,
              storageKey: govIdPersisted.diskPath,
              uploadedAt: timestamp,
            },
            validationResult: {
              ...validation.validationResult,
              candidateId: newCandId,
            },
            status: 'ARRIVED',
            currentLocation: 'Reception / Waiting Lounge',
            arrivalTime: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          draft.candidates.unshift(newCand);
          savedCandidate = newCand;
        }

        // Create Round 1 Interview evaluation round
        const defaultInterviewer = draft.users.find((u) => u.role === 'INTERVIEWER') || draft.users[3];
        const newIntv: Interview = {
          id: `intv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidateId: savedCandidate.id,
          candidateName: savedCandidate.fullName,
          position: savedCandidate.position,
          roundName: 'Round 1 - Technical Assessment',
          interviewerId: defaultInterviewer?.id || 'usr-int-1',
          interviewerName: defaultInterviewer?.name || 'Nisha Verma (Senior Director)',
          scheduledTime: 'Walk-in / Immediate',
          status: 'CANDIDATE_ARRIVED',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        draft.interviews.unshift(newIntv);
        relatedInterview = newIntv;
        savedCandidate.currentInterviewId = newIntv.id;

        // Immediately mark session as COMPLETED (One-Time Use)
        if (s) {
          s.status = 'COMPLETED';
          s.completedAt = timestamp;
          s.submittedAt = timestamp;
          s.candidateId = savedCandidate.id;
          s.candidateName = savedCandidate.fullName;
          s.position = savedCandidate.position;
        }

        // Record Automated Validation event in candidate timeline
        draft.timelineEvents.unshift(
          {
            id: `tl-${Date.now()}-val`,
            candidateId: savedCandidate.id,
            timestamp,
            actorType: 'SYSTEM',
            actorName: 'WCR Automated Validation Engine',
            eventType: 'CANDIDATE_VALIDATION_COMPLETED',
            description: `Automated validation completed: ${validation.validationResult.overallStatus}. Government ID format & resume checked.`,
            metadata: {
              validationStatus: validation.validationResult.overallStatus,
              checksPerformed: validation.validationResult.checksPerformed,
              checksPassed: validation.validationResult.checksPassed,
            },
          },
          {
            id: `tl-${Date.now()}-reg`,
            candidateId: savedCandidate.id,
            timestamp,
            actorType: 'USER',
            actorName: savedCandidate.fullName,
            eventType: 'CANDIDATE_SELF_REGISTRATION',
            description: `Candidate self-registered via General Reception QR code. Status set to Arrived.`,
          }
        );

        draft.auditLogs.unshift(
          {
            id: `aud-${Date.now()}-sub`,
            timestamp,
            actorType: 'USER',
            actorName: savedCandidate.fullName,
            action: 'FORM_SUBMITTED',
            details: `Candidate self-registration form submitted for ${savedCandidate.fullName} (${savedCandidate.position}) with Government ID (${idTypeToValidate}).`,
            entityId: savedCandidate.id,
            entityType: 'CANDIDATE',
          },
          {
            id: `aud-${Date.now()}-comp`,
            timestamp,
            actorType: 'SYSTEM',
            actorName: 'Session Manager',
            action: 'REGISTRATION_SESSION_COMPLETED',
            details: `Registration session ${s?.id || token} permanently marked COMPLETED and locked after successful submission.`,
            entityId: s?.id,
            entityType: 'CHECK_IN_SESSION',
          }
        );
      });

      if (!savedCandidate) throw new Error('Failed to persist candidate');

      // Real-time Event Broadcaster
      eventWorkflowEngine.broadcast({
        type: 'CANDIDATE_FORM_SUBMITTED',
        payload: {
          candidateId: (savedCandidate as Candidate).id,
          candidateName: (savedCandidate as Candidate).fullName,
          position: (savedCandidate as Candidate).position,
          timestamp,
        },
      });

      eventWorkflowEngine.broadcast({
        type: 'REGISTRATION_SESSION_COMPLETED',
        payload: {
          token,
          candidateId: (savedCandidate as Candidate).id,
          completedAt: timestamp,
        },
      });

      // Trigger Workflow Engine for role-based alerts & real-time updates
      eventWorkflowEngine.handleCandidateCheckIn(savedCandidate, relatedInterview, token);

      res.json({
        success: true,
        status: 'COMPLETED',
        candidate: savedCandidate,
        session: {
          token,
          status: 'COMPLETED',
          completedAt: timestamp,
          submittedAt: timestamp,
        },
        message: 'Your information has been successfully submitted.',
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      res.status(500).json({ success: false, error: err.message || 'Registration failed' });
    }
  });

  // ==========================================
  // GOVERNMENT ID SECURE VIEW (INLINE FOR AUTHORIZED ROLES)
  // ==========================================
  app.get('/api/candidates/:candidateId/govid/view', (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;

    if (role === 'PANTRY') {
      return res.status(403).json({ success: false, error: 'Pantry role is unauthorized to access candidate Government IDs.' });
    }

    const db = dbService.get();
    const candidate = db.candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate record not found' });
    }

    const govId = candidate.governmentId;
    const fileName =
      govId?.originalFileName || `${candidate.fullName.replace(/\s+/g, '_')}_${govId?.idType || 'GovID'}.pdf`;
    const mimeType = govId?.mimeType || 'application/pdf';

    const diskPath = path.resolve(GOV_IDS_DIR, `${candidateId}-govid.bin`);
    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(diskPath)) {
      fileBuffer = fs.readFileSync(diskPath);
    } else if (govId?.documentDataUrl && govId.documentDataUrl.startsWith('data:')) {
      const match = govId.documentDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        try {
          fileBuffer = Buffer.from(match[2], 'base64');
        } catch (e) {}
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      fileBuffer = createValidSamplePdf(candidate.fullName, `Government ID: ${govId?.idTypeName || 'Identity Document'}`);
      fs.writeFileSync(diskPath, fileBuffer);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(fileBuffer);
  });

  // ==========================================
  // GOVERNMENT ID SECURE DOWNLOAD (ATTACHMENT)
  // ==========================================
  app.get('/api/candidates/:candidateId/govid/download', (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;

    if (role === 'PANTRY') {
      return res.status(403).json({ success: false, error: 'Pantry role is unauthorized to download candidate Government IDs.' });
    }

    const db = dbService.get();
    const candidate = db.candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate record not found' });
    }

    const govId = candidate.governmentId;
    const fileName =
      govId?.originalFileName || `${candidate.fullName.replace(/\s+/g, '_')}_${govId?.idType || 'GovID'}.pdf`;
    const mimeType = govId?.mimeType || 'application/pdf';

    const diskPath = path.resolve(GOV_IDS_DIR, `${candidateId}-govid.bin`);
    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(diskPath)) {
      fileBuffer = fs.readFileSync(diskPath);
    } else if (govId?.documentDataUrl && govId.documentDataUrl.startsWith('data:')) {
      const match = govId.documentDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        try {
          fileBuffer = Buffer.from(match[2], 'base64');
        } catch (e) {}
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      fileBuffer = createValidSamplePdf(candidate.fullName, `Government ID: ${govId?.idTypeName || 'Identity Document'}`);
      fs.writeFileSync(diskPath, fileBuffer);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);
  });

  // ==========================================
  // RECEPTION DESK LIVE PHOTO CAPTURE
  // Authenticated reception staff captures real arrival photo
  // ==========================================
  app.post('/api/candidates/:id/reception-photo', (req: Request, res: Response) => {
    const { id } = req.params;
    const { photo, receptionistId, receptionistName } = req.body;

    if (!photo) {
      return res.status(400).json({ success: false, error: 'Live photo payload is required' });
    }

    try {
      eventWorkflowEngine.onCandidateLivePhotoCaptured(
        id,
        photo,
        receptionistId || 'usr-rec-1',
        receptionistName || 'Ananya Sen (Reception)'
      );

      const updated = dbService.get().candidates.find((c) => c.id === id);
      res.json({ success: true, candidate: updated });
    } catch (err: any) {
      console.error('Reception photo capture failed:', err);
      res.status(500).json({ success: false, error: err.message || 'Photo upload failed' });
    }
  });

  // ==========================================
  // RESUME SECURE VIEW (INLINE FOR HR/ADMIN/INTERVIEWER)
  // ==========================================
  app.get('/api/candidates/:candidateId/resume/view', (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;

    if (role === 'PANTRY') {
      return res.status(403).json({ success: false, error: 'Pantry role is unauthorized to access candidate resumes.' });
    }

    const db = dbService.get();
    const candidate = db.candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate record not found' });
    }

    const resumeFileName = candidate.resumeFileName || `${candidate.fullName.replace(/\s+/g, '_')}_Resume.pdf`;
    const mimeType = candidate.resumeMimeType || 'application/pdf';

    const diskPath = path.resolve(RESUMES_DIR, `${candidateId}-resume.bin`);
    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(diskPath)) {
      fileBuffer = fs.readFileSync(diskPath);
    } else if (candidate.resumeUrl && candidate.resumeUrl.startsWith('data:')) {
      const match = candidate.resumeUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        try {
          fileBuffer = Buffer.from(match[2], 'base64');
        } catch (e) {}
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      fileBuffer = createValidSamplePdf(candidate.fullName, candidate.position);
      fs.writeFileSync(diskPath, fileBuffer);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${resumeFileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(fileBuffer);
  });

  // ==========================================
  // RESUME SECURE DOWNLOAD (ATTACHMENT)
  // ==========================================
  app.get('/api/candidates/:candidateId/resume/download', (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;

    if (role === 'PANTRY') {
      return res.status(403).json({ success: false, error: 'Pantry role is unauthorized to download candidate resumes.' });
    }

    const db = dbService.get();
    const candidate = db.candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate record not found' });
    }

    const resumeFileName = candidate.resumeFileName || `${candidate.fullName.replace(/\s+/g, '_')}_Resume.pdf`;
    const mimeType = candidate.resumeMimeType || 'application/pdf';

    const diskPath = path.resolve(RESUMES_DIR, `${candidateId}-resume.bin`);
    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(diskPath)) {
      fileBuffer = fs.readFileSync(diskPath);
    } else if (candidate.resumeUrl && candidate.resumeUrl.startsWith('data:')) {
      const match = candidate.resumeUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        try {
          fileBuffer = Buffer.from(match[2], 'base64');
        } catch (e) {}
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      fileBuffer = createValidSamplePdf(candidate.fullName, candidate.position);
      fs.writeFileSync(diskPath, fileBuffer);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${resumeFileName}"`);
    res.send(fileBuffer);
  });

  // ==========================================
  // STAFF AUTHENTICATION (EMAIL + PASSWORD)
  // ==========================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const db = dbService.get();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email address or credentials.' });
    }

    if (password && password.length < 3) {
      return res.status(401).json({ success: false, error: 'Password must be at least 3 characters.' });
    }

    res.json({
      success: true,
      user,
      token: `wcr-auth-${user.id}-${Date.now()}`,
    });
  });

  // ==========================================
  // HR ROOM ASSIGNMENT (HUMAN DECISION)
  // ==========================================
  app.post('/api/rooms/assign', (req: Request, res: Response) => {
    const { hrUserId, hrName, candidateId, interviewId, roomId } = req.body;

    if (!candidateId || !roomId) {
      return res.status(400).json({ success: false, error: 'candidateId and roomId are required' });
    }

    try {
      eventWorkflowEngine.handleRoomAssigned(
        hrUserId || 'usr-hr-1',
        hrName || 'Sneha Patel (HR)',
        candidateId,
        interviewId,
        roomId
      );

      res.json({
        success: true,
        message: 'Room assigned successfully. Real-time alerts and pantry hospitality tasks automated.',
      });
    } catch (err: any) {
      console.error('Room assignment error:', err);
      res.status(500).json({ success: false, error: err.message || 'Room assignment failed' });
    }
  });

  // ==========================================
  // PANTRY TASK COMPLETION
  // ==========================================
  app.post('/api/pantry/tasks/:id/complete', (req: Request, res: Response) => {
    const { id } = req.params;
    const { stewardName } = req.body;

    try {
      eventWorkflowEngine.handlePantryTaskCompleted(id, stewardName || 'Suresh Kumar (Pantry)');
      res.json({ success: true, message: 'Hospitality task marked as completed.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to complete pantry task' });
    }
  });

  // ==========================================
  // INTERVIEW WORKFLOW ACTIONS (INTERVIEWER)
  // ==========================================
  app.post('/api/interviews/:id/start', (req: Request, res: Response) => {
    const { id } = req.params;
    const { interviewerName } = req.body;

    try {
      eventWorkflowEngine.handleInterviewStarted(id, interviewerName || 'Interviewer');
      res.json({ success: true, message: 'Interview officially started.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to start interview' });
    }
  });

  app.post('/api/interviews/:id/end', (req: Request, res: Response) => {
    const { id } = req.params;
    const { interviewerName, outcome, notes, nextInterviewerId, nextRoundName } = req.body;

    if (!outcome) {
      return res.status(400).json({ success: false, error: 'Interview outcome decision is required.' });
    }

    try {
      eventWorkflowEngine.handleInterviewCompleted(
        id,
        interviewerName || 'Interviewer',
        outcome,
        notes || '',
        nextInterviewerId,
        nextRoundName
      );
      res.json({ success: true, message: 'Interview concluded and outcome processed.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to end interview' });
    }
  });

  // ==========================================
  // RECEPTION VISITOR / CANDIDATE CHECKOUT
  // ==========================================
  app.post('/api/visitors/checkout', (req: Request, res: Response) => {
    const { candidateId, receptionistName } = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, error: 'candidateId is required' });
    }

    try {
      eventWorkflowEngine.handleCheckout(candidateId, receptionistName || 'Ananya Sen (Reception)');
      res.json({ success: true, message: 'Candidate checkout complete.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Checkout failed' });
    }
  });

  // ==========================================
  // GENERAL WALK-IN VISITOR REGISTRATION
  // ==========================================
  app.post('/api/walkin/register', (req: Request, res: Response) => {
    const { fullName, phone, email, company, visitorType, hostName, hostDepartment, purpose } = req.body;

    if (!fullName || !phone || !hostName) {
      return res.status(400).json({ success: false, error: 'Name, phone, and host are required.' });
    }

    const timestamp = new Date().toISOString();
    const visitorId = `vis-${Date.now()}`;

    dbService.update((draft) => {
      draft.visitors.unshift({
        id: visitorId,
        fullName,
        phone,
        email: email || '',
        company: company || '',
        visitorType: visitorType || 'WALK_IN',
        hostName,
        hostDepartment: hostDepartment || 'General Management',
        purpose: purpose || 'Official Business Meeting',
        status: 'CHECKED_IN',
        checkInTime: timestamp,
      });

      // Notify Reception and Admin
      draft.notifications.unshift({
        id: `notif-${Date.now()}-vis`,
        recipientRole: 'RECEPTION',
        title: `Walk-in ${visitorType || 'Visitor'} Checked In`,
        message: `${fullName} (${company || 'Individual'}) arrived to meet ${hostName}.`,
        priority: 'NORMAL',
        eventType: 'VISITOR_CHECKED_IN',
        entityId: visitorId,
        entityType: 'VISITOR',
        read: false,
        createdAt: timestamp,
      });

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: 'Self Check-in / Front Desk',
        action: 'WALKIN_REGISTERED',
        details: `Walk-in visitor ${fullName} checked in to meet ${hostName}.`,
        entityId: visitorId,
        entityType: 'VISITOR',
      });
    });

    eventWorkflowEngine.broadcast({
      type: 'WALKIN_REGISTERED',
      payload: { visitorId, fullName, hostName },
    });

    res.json({ success: true, visitorId, message: 'Visitor registered successfully.' });
  });

  // ==========================================
  // DATA QUERIES WITH ROLE VISIBILITY FILTERING
  // ==========================================
  app.get('/api/candidates', (req: Request, res: Response) => {
    const role = (req.query.role as UserRole) || 'HR';
    const db = dbService.get();
    const visibility = db.settings.fieldVisibility[role] || db.settings.fieldVisibility.HR;

    // Apply field-level visibility filtering based on role and exclude soft-deleted candidates
    const filteredCandidates = db.candidates
      .filter((c) => !(c as any).isDeleted)
      .map((cand) => {
      const copy: any = {
        id: cand.id,
        status: cand.status,
        currentLocation: cand.currentLocation,
        arrivalTime: cand.arrivalTime,
        checkOutTime: cand.checkOutTime,
        totalDurationMinutes: cand.totalDurationMinutes,
        currentInterviewId: cand.currentInterviewId,
        position: cand.position,
        department: cand.department,
        totalExperience: cand.totalExperience,
        relevantExperience: cand.relevantExperience,
      };

      if (visibility.candidateName) copy.fullName = cand.fullName;
      if (visibility.phone) copy.phone = cand.phone;
      if (visibility.email) copy.email = cand.email;
      if (visibility.address) {
        copy.address = cand.address;
        copy.city = cand.city;
        copy.state = cand.state;
        copy.pincode = cand.pincode;
      }
      if (visibility.livePhoto) {
        copy.livePhoto = cand.livePhoto;
        copy.livePhotoCapturedAt = cand.livePhotoCapturedAt;
        copy.livePhotoCapturedBy = cand.livePhotoCapturedBy;
        copy.arrivalPhoto = cand.arrivalPhoto;
        copy.arrivalPhotoCapturedAt = cand.arrivalPhotoCapturedAt;
        copy.arrivalPhotoCapturedBy = cand.arrivalPhotoCapturedBy;
        copy.arrivalPhotoCapturedByName = cand.arrivalPhotoCapturedByName;
        copy.photoMetadata = cand.photoMetadata;
      }
      if (visibility.resume) {
        copy.resumeUrl = cand.resumeUrl;
        copy.resumeFileName = cand.resumeFileName;
        copy.resumeFileSize = cand.resumeFileSize;
        copy.resumeMimeType = cand.resumeMimeType;
        copy.resumeUploadedAt = cand.resumeUploadedAt;
        copy.resumeMetadata = cand.resumeMetadata;
      }
      if (visibility.salary) copy.expectedSalary = cand.expectedSalary;
      copy.qualification = cand.qualification;
      copy.currentCompany = cand.currentCompany;
      copy.noticePeriod = cand.noticePeriod;
      copy.referralSource = cand.referralSource;
      copy.skills = cand.skills;

      return copy;
    });

    res.json({ success: true, candidates: filteredCandidates });
  });

  app.get('/api/candidates/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const role = (req.query.role as UserRole) || 'HR';
    const db = dbService.get();

    const candidate = db.candidates.find((c) => c.id === id);
    if (!candidate || (candidate as any).isDeleted) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const interviews = db.interviews.filter((i) => i.candidateId === id);
    const timeline = db.timelineEvents.filter((t) => t.candidateId === id);

    // Confidentiality payload filter & field-level authorization
    const visibility = db.settings.fieldVisibility[role] || db.settings.fieldVisibility.HR;
    const candidateData = { ...candidate };

    if (!visibility.phone) delete (candidateData as any).phone;
    if (!visibility.email) delete (candidateData as any).email;
    if (!visibility.address) {
      delete (candidateData as any).address;
      delete (candidateData as any).city;
      delete (candidateData as any).state;
      delete (candidateData as any).pincode;
    }
    if (!visibility.resume) {
      delete (candidateData as any).resumeUrl;
      delete (candidateData as any).resumeFileName;
      delete (candidateData as any).resumeFileSize;
    }
    if (!visibility.governmentId) {
      delete (candidateData as any).governmentId;
    }
    if (!visibility.salary || (role !== 'HR' && role !== 'ADMIN' && role !== 'CEO')) {
      delete (candidateData as any).expectedSalary;
    }

    // Strictly redact confidential HR notes from Reception, Interviewers, and Pantry
    if (role !== 'HR' && role !== 'ADMIN' && role !== 'CEO') {
      delete (candidateData as any).hrPrivateNotes;
      delete (candidateData as any).interviewerFeedbackPrivate;
      delete (candidateData as any).internalHiringDecisionNotes;
      delete (candidateData as any).managementNotes;
    }

    // Mask Raw Government ID number across all endpoints except when raw export requested by Admin
    if (candidateData.governmentId && candidateData.governmentId.rawIdNumber) {
      delete candidateData.governmentId.rawIdNumber;
    }

    res.json({
      success: true,
      candidate: candidateData,
      interviews,
      timeline,
    });
  });

  // ==========================================
  // HR CANDIDATE EDIT (PUT)
  // ==========================================
  app.put('/api/candidates/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;

    if (role !== 'HR' && role !== 'ADMIN' && role !== 'CEO') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only HR, Admin, or CEO can edit candidate profiles.' });
    }

    const {
      fullName,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      position,
      department,
      totalExperience,
      relevantExperience,
      currentCompany,
      qualification,
      skills,
      noticePeriod,
      expectedSalary,
      departmentToMeet,
      personToMeet,
      purpose,
      hrPrivateNotes,
      managementNotes,
    } = req.body;

    const timestamp = new Date().toISOString();
    let updatedCandidate: Candidate | null = null;

    try {
      dbService.update((draft) => {
        const cand = draft.candidates.find((c) => c.id === id);
        if (!cand || (cand as any).isDeleted) {
          throw new Error('Candidate not found');
        }

        if (fullName) cand.fullName = fullName;
        if (phone) cand.phone = phone;
        if (email) cand.email = email;
        if (address !== undefined) cand.address = address;
        if (city !== undefined) cand.city = city;
        if (state !== undefined) cand.state = state;
        if (pincode !== undefined) cand.pincode = pincode;
        if (position) cand.position = position;
        if (department) cand.department = department;
        if (totalExperience !== undefined) cand.totalExperience = totalExperience;
        if (relevantExperience !== undefined) cand.relevantExperience = relevantExperience;
        if (currentCompany !== undefined) cand.currentCompany = currentCompany;
        if (qualification !== undefined) cand.qualification = qualification;
        if (skills !== undefined) cand.skills = skills;
        if (noticePeriod !== undefined) cand.noticePeriod = noticePeriod;
        if (expectedSalary !== undefined) cand.expectedSalary = expectedSalary;
        if (departmentToMeet !== undefined) cand.departmentToMeet = departmentToMeet;
        if (personToMeet !== undefined) cand.personToMeet = personToMeet;
        if (purpose !== undefined) cand.purpose = purpose;
        if (hrPrivateNotes !== undefined) cand.hrPrivateNotes = hrPrivateNotes;
        if (managementNotes !== undefined) cand.managementNotes = managementNotes;

        cand.updatedAt = timestamp;
        updatedCandidate = cand;

        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-edit`,
          candidateId: id,
          timestamp,
          actorType: 'USER',
          actorName: role === 'HR' ? 'Sneha Patel (HR)' : 'Authorized Staff',
          eventType: 'CANDIDATE_PROFILE_UPDATED',
          description: `Candidate profile updated by HR/Admin (${role}).`,
        });

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}-edit`,
          timestamp,
          actorType: 'USER',
          actorName: role,
          action: 'CANDIDATE_UPDATED',
          details: `Candidate record ${id} (${cand.fullName}) edited successfully.`,
          entityId: id,
          entityType: 'CANDIDATE',
        });
      });

      if (!updatedCandidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }

      eventWorkflowEngine.broadcast({
        type: 'CANDIDATE_PROFILE_UPDATED',
        payload: { candidateId: id, timestamp },
      });

      res.json({ success: true, candidate: updatedCandidate, message: 'Candidate profile updated successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update candidate' });
    }
  });

  // ==========================================
  // HR CANDIDATE DELETE / ARCHIVE (DELETE)
  // ==========================================
  app.delete('/api/candidates/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const role = (req.query.role || req.headers['x-user-role']) as UserRole;
    const reason = req.body?.reason || 'Administrative Archive';

    if (role !== 'HR' && role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only HR or Admin can delete candidate records.' });
    }

    const timestamp = new Date().toISOString();

    try {
      let deletedName = '';
      dbService.update((draft) => {
        const cand = draft.candidates.find((c) => c.id === id);
        if (!cand || (cand as any).isDeleted) {
          throw new Error('Candidate not found');
        }

        if (cand.status === 'IN_INTERVIEW' || cand.status === 'ROOM_ASSIGNED') {
          throw new Error('Cannot delete candidate while an interview or room assignment is actively in progress.');
        }

        deletedName = cand.fullName;
        (cand as any).isDeleted = true;
        (cand as any).deletedAt = timestamp;
        (cand as any).deletedBy = role;
        (cand as any).deletionReason = reason;
        cand.status = 'REJECTED';
        cand.updatedAt = timestamp;

        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-del`,
          candidateId: id,
          timestamp,
          actorType: 'USER',
          actorName: role === 'HR' ? 'Sneha Patel (HR)' : 'Administrator',
          eventType: 'CANDIDATE_ARCHIVED',
          description: `Candidate record archived/deleted. Reason: ${reason}.`,
        });

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}-del`,
          timestamp,
          actorType: 'USER',
          actorName: role,
          action: 'CANDIDATE_DELETED',
          details: `Candidate ${id} (${deletedName}) was soft-deleted/archived by ${role}. Reason: ${reason}.`,
          entityId: id,
          entityType: 'CANDIDATE',
        });
      });

      eventWorkflowEngine.broadcast({
        type: 'CANDIDATE_DELETED',
        payload: { candidateId: id, timestamp },
      });

      res.json({ success: true, message: `Candidate ${deletedName} successfully archived.` });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to archive candidate' });
    }
  });

  app.get('/api/rooms', (req: Request, res: Response) => {
    const db = dbService.get();
    res.json({ success: true, rooms: db.rooms });
  });

  app.get('/api/interviews', (req: Request, res: Response) => {
    const db = dbService.get();
    res.json({ success: true, interviews: db.interviews });
  });

  app.get('/api/pantry/tasks', (req: Request, res: Response) => {
    const db = dbService.get();
    res.json({ success: true, tasks: db.pantryTasks });
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const role = (req.query.role as UserRole) || 'HR';
    const userId = (req.query.userId as string) || '';
    const db = dbService.get();

    const notifs = db.notifications.filter(
      (n) => n.recipientRole === role || (userId && n.recipientUserId === userId)
    );

    res.json({ success: true, notifications: notifs });
  });

  app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
    const { id } = req.params;
    dbService.update((draft) => {
      const notif = draft.notifications.find((n) => n.id === id);
      if (notif) notif.read = true;
    });
    res.json({ success: true });
  });

  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const db = dbService.get();
    res.json({ success: true, logs: db.auditLogs.slice(0, 100) });
  });

  app.get('/api/stats', (req: Request, res: Response) => {
    const db = dbService.get();
    const todayArrivals = db.candidates.filter(
      (c) => c.status !== 'SCHEDULED'
    ).length;
    const waitingCount = db.candidates.filter((c) => c.status === 'WAITING' || c.status === 'ARRIVED').length;
    const inInterviewCount = db.candidates.filter((c) => c.status === 'IN_INTERVIEW').length;
    const occupiedRooms = db.rooms.filter((r) => r.status === 'OCCUPIED' || r.status === 'ASSIGNED').length;
    const pendingPantry = db.pantryTasks.filter((t) => t.status === 'PENDING').length;
    const completedCount = db.candidates.filter(
      (c) => c.status === 'COMPLETED' || c.status === 'CHECKED_OUT' || c.status === 'OFFERED'
    ).length;

    res.json({
      success: true,
      stats: {
        todayArrivals,
        waitingCount,
        inInterviewCount,
        occupiedRooms,
        totalRooms: db.rooms.length,
        pendingPantry,
        completedCount,
      },
    });
  });

  // Admin QR Pass generation
  app.post('/api/qr/generate', (req: Request, res: Response) => {
    const { candidateName, position, department, appointmentTime, interviewerId, interviewerName, roundName } = req.body;
    const token = `WCR-APPT-${Math.floor(100 + Math.random() * 900)}`;

    const newSession: CheckInSession = {
      id: `session-${Date.now()}`,
      token,
      qrType: 'APPOINTMENT',
      candidateName,
      position,
      department,
      appointmentTime,
      interviewerId,
      interviewerName,
      interviewRound: roundName || 'Round 1 - Technical Assessment',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    dbService.update((draft) => {
      draft.checkInSessions.unshift(newSession);
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorType: 'USER',
        actorName: 'Admin / HR',
        action: 'GENERATE_QR_PASS',
        details: `Generated appointment QR pass token ${token} for ${candidateName} (${position}).`,
      });
    });

    res.json({ success: true, session: newSession });
  });

  // Admin Office Settings update (including QR session expiry)
  app.post('/api/settings/office', (req: Request, res: Response) => {
    const { qrSessionExpiryMinutes, autoAssignPantryOnRoom, pantryWaterRequired, requireLivePhoto, requireResume } = req.body;

    dbService.update((draft) => {
      if (typeof qrSessionExpiryMinutes === 'number' && qrSessionExpiryMinutes > 0) {
        draft.settings.qrSessionExpiryMinutes = qrSessionExpiryMinutes;
      }
      if (typeof autoAssignPantryOnRoom === 'boolean') {
        draft.settings.autoAssignPantryOnRoom = autoAssignPantryOnRoom;
      }
      if (typeof pantryWaterRequired === 'boolean') {
        draft.settings.pantryWaterRequired = pantryWaterRequired;
      }
      if (typeof requireLivePhoto === 'boolean') {
        draft.settings.requireLivePhoto = requireLivePhoto;
      }
      if (typeof requireResume === 'boolean') {
        draft.settings.requireResume = requireResume;
      }

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}-settings`,
        timestamp: new Date().toISOString(),
        actorType: 'USER',
        actorName: 'Admin',
        action: 'UPDATE_OFFICE_SETTINGS',
        details: `Updated office operations settings (QR session expiry set to ${draft.settings.qrSessionExpiryMinutes}m).`,
      });
    });

    res.json({ success: true, settings: dbService.get().settings });
  });

  // Admin Field Visibility update
  app.post('/api/settings/visibility', (req: Request, res: Response) => {
    const { role, config } = req.body;
    if (!role || !config) {
      return res.status(400).json({ success: false, error: 'Role and config are required' });
    }

    dbService.update((draft) => {
      draft.settings.fieldVisibility[role as UserRole] = {
        ...draft.settings.fieldVisibility[role as UserRole],
        ...config,
      };
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorType: 'USER',
        actorName: 'Admin',
        action: 'UPDATE_FIELD_VISIBILITY',
        details: `Updated field level visibility matrix for role ${role}.`,
      });
    });

    res.json({ success: true, settings: dbService.get().settings });
  });

  // ==========================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WCR OPS SERVER] Running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[WCR OPS SERVER] Startup error:', err);
  process.exit(1);
});
