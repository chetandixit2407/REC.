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
} from '../types/index.ts';

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
    phone: false,
    email: false,
    address: false,
    resume: true,
    governmentId: true,
    validationResults: true,
    livePhoto: true,
    hrNotes: true,
    interviewStatus: true,
    room: true,
    pantryTask: false,
    salary: false,
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
    id: 'usr-hr-1',
    name: 'Sneha Patel',
    email: 'sneha.patel@whitecollarrealty.com',
    role: 'HR',
    department: 'Human Resources',
    phone: '+91 98765 43210',
  },
  {
    id: 'usr-admin-1',
    name: 'Vikram Malhotra',
    email: 'vikram.admin@whitecollarrealty.com',
    role: 'ADMIN',
    department: 'Office Operations & Admin',
    phone: '+91 98765 43211',
  },
  {
    id: 'usr-ceo-1',
    name: 'Rajesh Khurana',
    email: 'rajesh.khurana@whitecollarrealty.com',
    role: 'CEO',
    department: 'Executive Leadership',
    phone: '+91 98765 43212',
  },
  {
    id: 'usr-int-1',
    name: 'Nisha Verma',
    email: 'nisha.verma@whitecollarrealty.com',
    role: 'INTERVIEWER',
    department: 'Sales & Business Development',
    phone: '+91 98765 43213',
  },
  {
    id: 'usr-int-2',
    name: 'Rohan Gupta',
    email: 'rohan.gupta@whitecollarrealty.com',
    role: 'INTERVIEWER',
    department: 'Commercial Real Estate',
    phone: '+91 98765 43214',
  },
  {
    id: 'usr-rec-1',
    name: 'Ananya Sen',
    email: 'reception@whitecollarrealty.com',
    role: 'RECEPTION',
    department: 'Front Desk Operations',
    phone: '+91 98765 43215',
  },
  {
    id: 'usr-pan-1',
    name: 'Suresh Kumar',
    email: 'pantry.operations@whitecollarrealty.com',
    role: 'PANTRY',
    department: 'Pantry & Hospitality',
    phone: '+91 98765 43216',
  },
];

const defaultRooms: Room[] = [
  {
    id: 'room-1',
    name: 'Meeting Room 1',
    type: 'STANDARD_MEETING',
    capacity: 6,
    floor: 'Floor 3',
    status: 'AVAILABLE',
  },
  {
    id: 'room-2',
    name: 'Meeting Room 2',
    type: 'STANDARD_MEETING',
    capacity: 6,
    floor: 'Floor 3',
    status: 'AVAILABLE',
  },
  {
    id: 'room-3',
    name: 'Boardroom Alpha',
    type: 'EXECUTIVE_BOARDROOM',
    capacity: 14,
    floor: 'Floor 4',
    status: 'AVAILABLE',
  },
  {
    id: 'room-4',
    name: 'Interview Pod A',
    type: 'INTERVIEW_POD',
    capacity: 3,
    floor: 'Floor 3',
    status: 'AVAILABLE',
  },
  {
    id: 'room-5',
    name: 'Interview Pod B',
    type: 'INTERVIEW_POD',
    capacity: 3,
    floor: 'Floor 3',
    status: 'AVAILABLE',
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
        // Ensure field visibility has all modern fields
        if (!parsed.settings) parsed.settings = {};
        parsed.settings.fieldVisibility = {
          ...defaultFieldVisibility,
          ...(parsed.settings.fieldVisibility || {}),
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
