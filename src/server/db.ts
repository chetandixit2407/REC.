import fs from 'fs';
import path from 'path';
import type {
  User,
  Candidate,
  Interview,
  Room,
  Notification,
  PantryTask,
  TimelineEvent,
  AuditLog,
  CheckInSession,
  Visitor,
  OfficeSettings,
  RoleFieldVisibility,
  CandidateChangeRequest,
  PasswordResetRequest,
  DomainEvent,
} from '../types/index.ts';
import { hashPassword, ROLE_PERMISSIONS } from './auth.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'wcr_database.json');

export interface DatabaseSchema {
  users: User[];
  candidates: Candidate[];
  interviews: Interview[];
  rooms: Room[];
  notifications: Notification[];
  pantryTasks: PantryTask[];
  timelineEvents: TimelineEvent[];
  auditLogs: AuditLog[];
  checkInSessions: CheckInSession[];
  visitors: Visitor[];
  settings: OfficeSettings;
  changeRequests?: CandidateChangeRequest[];
  passwordResetRequests?: PasswordResetRequest[];
  domainEvents?: DomainEvent[];
}

const defaultFieldVisibility: Record<string, RoleFieldVisibility> = {
  HR: {
    candidateName: true,
    phone: true,
    email: true,
    address: true,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: true,
    salary: true,
  },
  ADMIN: {
    candidateName: true,
    phone: true,
    email: true,
    address: true,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: true,
    salary: true,
  },
  CEO: {
    candidateName: true,
    phone: true,
    email: true,
    address: true,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: true,
    salary: true,
  },
  CO_FOUNDER: {
    candidateName: true,
    phone: true,
    email: true,
    address: true,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: true,
    salary: true,
  },
  INTERVIEWER: {
    candidateName: true,
    phone: true,
    email: true,
    address: false,
    resume: true,
    governmentId: false,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: false,
    salary: false,
  },
  RECEPTION: {
    candidateName: true,
    phone: true,
    email: true,
    address: true,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: false,
    interviewStatus: true,
    room: true,
    pantryTask: true,
    salary: false,
  },
  PANTRY: {
    candidateName: true,
    phone: false,
    email: false,
    address: false,
    resume: false,
    governmentId: false,
    validationResults: false,
    livePhoto: false,
    hrNotes: false,
    interviewStatus: false,
    room: true,
    pantryTask: true,
    salary: false,
  },
};

const defaultUsers: User[] = [
  {
    id: 'usr-ceo-lalit',
    userId: 'usr-ceo-lalit',
    name: 'Lalit Sir',
    email: 'lalit@whitecollarrealty.com',
    username: 'lalit.sir',
    passwordHash: hashPassword('wcr123'),
    role: 'CEO',
    designation: 'CEO',
    department: 'Executive Leadership',
    permissions: ROLE_PERMISSIONS.CEO,
    isActive: true,
    phone: '+91 98100 00001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-cofounder-kimmi',
    userId: 'usr-cofounder-kimmi',
    name: 'Kimmi Mam',
    email: 'kimmi@whitecollarrealty.com',
    username: 'kimmi.mam',
    passwordHash: hashPassword('wcr123'),
    role: 'CO_FOUNDER',
    designation: 'CO-Founder',
    department: 'Executive Leadership',
    permissions: ROLE_PERMISSIONS.CO_FOUNDER,
    isActive: true,
    phone: '+91 98100 00002',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-hr-nisha',
    userId: 'usr-hr-nisha',
    name: 'Nisha',
    email: 'nisha@whitecollarrealty.com',
    username: 'nisha.hr',
    passwordHash: hashPassword('wcr123'),
    role: 'HR',
    designation: 'Senior HR Manager',
    department: 'HR',
    permissions: ROLE_PERMISSIONS.HR,
    isActive: true,
    phone: '+91 98100 00003',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-hr-shriyanshi',
    userId: 'usr-hr-shriyanshi',
    name: 'Shriyanshi',
    email: 'shriyanshi@whitecollarrealty.com',
    username: 'shriyanshi.hr',
    passwordHash: hashPassword('wcr123'),
    role: 'HR',
    designation: 'HR Executive',
    department: 'HR',
    permissions: ROLE_PERMISSIONS.HR,
    isActive: true,
    phone: '+91 98100 00004',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-admin-sameer',
    userId: 'usr-admin-sameer',
    name: 'Sameer Sir',
    email: 'sameer@whitecollarrealty.com',
    username: 'sameer.admin',
    passwordHash: hashPassword('wcr123'),
    role: 'ADMIN',
    designation: 'Admin',
    department: 'Administration & Operations',
    permissions: ROLE_PERMISSIONS.ADMIN,
    isActive: true,
    phone: '+91 98100 00005',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-rec-ananya',
    userId: 'usr-rec-ananya',
    name: 'Ananya Sen',
    email: 'reception@whitecollarrealty.com',
    username: 'reception',
    passwordHash: hashPassword('wcr123'),
    role: 'RECEPTION',
    designation: 'Front Desk Coordinator',
    department: 'Front Desk & Reception',
    permissions: ROLE_PERMISSIONS.RECEPTION,
    isActive: true,
    phone: '+91 98100 00006',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-pan-ramesh',
    userId: 'usr-pan-ramesh',
    name: 'Ramesh Kumar',
    email: 'pantry@whitecollarrealty.com',
    username: 'pantry',
    passwordHash: hashPassword('wcr123'),
    role: 'PANTRY',
    designation: 'Hospitality & Pantry Executive',
    department: 'Pantry & Hospitality',
    permissions: ROLE_PERMISSIONS.PANTRY,
    isActive: true,
    phone: '+91 98100 00007',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultRooms: Room[] = [
  {
    id: 'room-lalit-cabin',
    roomId: 'room-lalit-cabin',
    name: 'Lalit Sir Cabin',
    roomName: 'Lalit Sir Cabin',
    type: 'CABIN',
    roomType: 'CABIN',
    capacity: 4,
    floor: 'Floor 4 (Executive Suite)',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'CEO & High-Level Strategic Decisions',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-kimmi-cabin',
    roomId: 'room-kimmi-cabin',
    name: 'Kimmi Mam Cabin',
    roomName: 'Kimmi Mam Cabin',
    type: 'CABIN',
    roomType: 'CABIN',
    capacity: 4,
    floor: 'Floor 4 (Executive Suite)',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Co-Founder & Strategic Advisory',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-prestige-loft',
    roomId: 'room-prestige-loft',
    name: 'The Prestige Loft (Waiting Area)',
    roomName: 'The Prestige Loft (Waiting Area)',
    type: 'WAITING_AREA',
    roomType: 'WAITING_AREA',
    capacity: 20,
    floor: 'Floor 3 (Main Lobby)',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Candidate & VIP Guest Reception Lounge',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-skyline',
    roomId: 'room-skyline',
    name: 'The Skyline',
    roomName: 'The Skyline',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 8,
    floor: 'Floor 3',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Senior Leadership & Sales Panel Evaluations',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-community',
    roomId: 'room-community',
    name: 'The Community',
    roomName: 'The Community',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 10,
    floor: 'Floor 3',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Group Interviews & Departmental Rounds',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-summit',
    roomId: 'room-summit',
    name: 'The Summit',
    roomName: 'The Summit',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 12,
    floor: 'Floor 4',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Executive Board & Final Hiring Rounds',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-wcr-air',
    roomId: 'room-wcr-air',
    name: 'WCR AIR',
    roomName: 'WCR AIR',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 6,
    floor: 'Floor 3',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Fast-Track Screenings & Technical Assessments',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-prime-loft',
    roomId: 'room-prime-loft',
    name: 'Prime Loft',
    roomName: 'Prime Loft',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 6,
    floor: 'Floor 3',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'HR Fitment & Initial Intake Interviews',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'room-regency',
    roomId: 'room-regency',
    name: 'Regency',
    roomName: 'Regency',
    type: 'MEETING_ROOM',
    roomType: 'MEETING_ROOM',
    capacity: 8,
    floor: 'Floor 3',
    status: 'AVAILABLE',
    isActive: true,
    preferredFor: 'Confidential Client & Candidate Discussions',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultCandidates: Candidate[] = [
  {
    id: 'cand-1',
    fullName: 'Rahul Sharma',
    phone: '+91 98112 34567',
    email: 'rahul.sharma@example.com',
    address: 'B-402, Golf Course Road',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    position: 'Sales Manager - Luxury Residential',
    department: 'Sales & Business Development',
    totalExperience: '6.5 Years',
    relevantExperience: '5 Years in Prime Real Estate',
    currentCompany: 'DLF Crest Real Estate',
    qualification: 'MBA in Marketing',
    noticePeriod: '15 Days',
    expectedSalary: '₹18,00,000 p.a.',
    referralSource: 'LinkedIn Job Portal',
    status: 'SCHEDULED',
    currentLocation: 'Waiting Area',
    appointmentId: 'appt-1',
    currentInterviewId: 'intv-1',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'cand-2',
    fullName: 'Sneha Kapoor',
    phone: '+91 98223 45678',
    email: 'sneha.kapoor@example.com',
    address: 'Plot 18, Sector 43',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122009',
    position: 'Commercial Leasing Executive',
    department: 'Commercial Real Estate',
    totalExperience: '4 Years',
    relevantExperience: '3.5 Years',
    currentCompany: 'JLL India',
    qualification: 'B.Com & Real Estate Finance',
    noticePeriod: 'Immediate',
    expectedSalary: '₹12,50,000 p.a.',
    referralSource: 'Employee Referral - Rohan Gupta',
    status: 'SCHEDULED',
    currentLocation: 'Waiting Area',
    appointmentId: 'appt-2',
    currentInterviewId: 'intv-2',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

const defaultInterviews: Interview[] = [
  {
    id: 'intv-1',
    candidateId: 'cand-1',
    candidateName: 'Rahul Sharma',
    position: 'Sales Manager - Luxury Residential',
    roundName: 'Round 1 - Technical Assessment',
    interviewerId: 'usr-int-1',
    interviewerName: 'Nisha Verma',
    scheduledTime: '11:00 AM',
    status: 'SCHEDULED',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'intv-2',
    candidateId: 'cand-2',
    candidateName: 'Sneha Kapoor',
    position: 'Commercial Leasing Executive',
    roundName: 'Round 1 - Technical Assessment',
    interviewerId: 'usr-int-2',
    interviewerName: 'Rohan Gupta',
    scheduledTime: '01:30 PM',
    status: 'SCHEDULED',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

const defaultCheckInSessions: CheckInSession[] = [
  {
    id: 'session-1',
    token: 'WCR-APPT-901',
    qrType: 'APPOINTMENT',
    candidateId: 'cand-1',
    candidateName: 'Rahul Sharma',
    position: 'Sales Manager - Luxury Residential',
    department: 'Sales & Business Development',
    appointmentTime: '11:00 AM',
    interviewerId: 'usr-int-1',
    interviewerName: 'Nisha Verma',
    interviewRound: 'Round 1 - Technical Assessment',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'session-2',
    token: 'WCR-APPT-902',
    qrType: 'APPOINTMENT',
    candidateId: 'cand-2',
    candidateName: 'Sneha Kapoor',
    position: 'Commercial Leasing Executive',
    department: 'Commercial Real Estate',
    appointmentTime: '01:30 PM',
    interviewerId: 'usr-int-2',
    interviewerName: 'Rohan Gupta',
    interviewRound: 'Round 1 - Technical Assessment',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'session-walkin',
    token: 'WCR-RECEPTION-WALKIN',
    qrType: 'GENERAL_RECEPTION',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

class DatabaseService {
  private db: DatabaseSchema;

  constructor() {
    this.db = this.initDatabase();
  }

  private initDatabase(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // 1. Replace existing room names with the 9 exact required rooms
        const existingRoomNames = new Set((parsed.rooms || []).map((r: any) => r.name));
        const requiredNames = [
          'Lalit Sir Cabin',
          'Kimmi Mam Cabin',
          'The Prestige Loft (Waiting Area)',
          'The Skyline',
          'The Community',
          'The Summit',
          'WCR AIR',
          'Prime Loft',
          'Regency',
        ];
        const hasAllRooms = requiredNames.every((n) => existingRoomNames.has(n));

        if (!hasAllRooms || !parsed.rooms || parsed.rooms.length < 9) {
          const currentOccupied = (parsed.rooms || []).filter(
            (r: any) => r.status === 'OCCUPIED' || r.status === 'ASSIGNED'
          );
          parsed.rooms = defaultRooms.map((dr, idx) => {
            if (currentOccupied[idx]) {
              return {
                ...dr,
                status: currentOccupied[idx].status,
                currentCandidateId: currentOccupied[idx].currentCandidateId,
                currentCandidateName: currentOccupied[idx].currentCandidateName,
                currentInterviewId: currentOccupied[idx].currentInterviewId,
              };
            }
            return { ...dr };
          });
        }

        // 2. Ensure individual accounts for Lalit Sir, Kimmi Mam, Nisha, Shriyanshi, Sameer Sir, Reception, Pantry
        const userMap = new Map<string, any>((parsed.users || []).map((u: any) => [u.email, u]));
        defaultUsers.forEach((du) => {
          if (!userMap.has(du.email)) {
            userMap.set(du.email, du);
          } else {
            const existing: any = userMap.get(du.email);
            existing.passwordHash = existing.passwordHash || du.passwordHash;
            existing.role = du.role;
            existing.name = du.name;
            existing.designation = du.designation || existing.designation;
            existing.department = du.department || existing.department;
            existing.permissions = du.permissions || existing.permissions;
            existing.isActive = existing.isActive !== undefined ? existing.isActive : true;
          }
        });
        parsed.users = Array.from(userMap.values());

        // 3. Ensure changeRequests & passwordResetRequests arrays exist
        parsed.changeRequests = parsed.changeRequests || [];
        parsed.passwordResetRequests = parsed.passwordResetRequests || [];

        // 4. Ensure field visibility has all modern fields + CO_FOUNDER
        if (!parsed.settings) parsed.settings = {};
        parsed.settings.fieldVisibility = {
          ...defaultFieldVisibility,
          ...(parsed.settings.fieldVisibility || {}),
          CO_FOUNDER: defaultFieldVisibility.CO_FOUNDER,
          RECEPTION: {
            ...defaultFieldVisibility.RECEPTION,
            ...(parsed.settings.fieldVisibility?.RECEPTION || {}),
            governmentId: true,
            validationResults: true,
            resume: true,
            email: true,
            address: true,
            candidateName: true,
            phone: true,
            livePhoto: true,
            room: true,
            pantryTask: true,
            salary: false,
            hrNotes: false,
          },
        };

        this.persist(parsed);
        return parsed;
      } catch (err) {
        console.error('Failed to parse database file, resetting to defaults', err);
      }
    }

    const initialDb: DatabaseSchema = {
      users: defaultUsers,
      candidates: defaultCandidates,
      interviews: defaultInterviews,
      rooms: defaultRooms,
      notifications: [
        {
          id: 'notif-welcome',
          recipientRole: 'ADMIN',
          title: 'System Initialized',
          message: 'WCR Office Operations Automation platform is active and ready.',
          priority: 'NORMAL',
          eventType: 'SYSTEM_BOOTSTRAP',
          entityId: 'system',
          entityType: 'VISITOR',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      pantryTasks: [],
      timelineEvents: [
        {
          id: 'tl-init',
          candidateId: 'cand-1',
          timestamp: new Date().toISOString(),
          actorType: 'SYSTEM',
          actorName: 'Workflow Engine',
          eventType: 'INTERVIEW_SCHEDULED',
          description: 'Candidate Rahul Sharma scheduled for Round 1 with Nisha Verma (11:00 AM). QR pass WCR-APPT-901 active.',
        },
      ],
      auditLogs: [
        {
          id: 'aud-init',
          timestamp: new Date().toISOString(),
          actorType: 'SYSTEM',
          actorName: 'System Bootstrapper',
          action: 'INIT_DATABASE',
          details: 'WCR office operations database initialized with default rooms, staff roles, and scheduled interviews.',
        },
      ],
      checkInSessions: defaultCheckInSessions,
      visitors: [],
      settings: {
        autoAssignPantryOnRoom: true,
        pantryWaterRequired: true,
        requireLivePhoto: true,
        requireResume: true,
        requireGovernmentId: true,
        allowedGovernmentIdTypes: ['AADHAAR', 'PAN', 'DRIVING_LICENSE', 'PASSPORT', 'VOTER_ID', 'OTHER'],
        allowedUploadFormats: ['pdf', 'png', 'jpg', 'jpeg'],
        qrSessionExpiryMinutes: 30,
        fieldVisibility: defaultFieldVisibility as any,
      },
    };

    this.persist(initialDb);
    return initialDb;
  }

  private persist(data: DatabaseSchema): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file', err);
    }
  }

  public get(): DatabaseSchema {
    return this.db;
  }

  public update(updater: (draft: DatabaseSchema) => void): DatabaseSchema {
    updater(this.db);
    this.persist(this.db);
    return this.db;
  }
}

export const dbService = new DatabaseService();
