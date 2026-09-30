import crypto from 'crypto';
import type { User, UserRole } from '../types/index.ts';

const DEFAULT_SALT = 'wcr_office_ops_salt';

export function hashPassword(password: string, salt = DEFAULT_SALT): string {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const computed = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
    return computed === hash;
  }
  // Fallback for simple tokens
  return password === storedHash;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  CEO: [
    'ALL_PERMISSIONS',
    'FULL_ACCESS',
    'VIEW_DASHBOARDS',
    'VIEW_CANDIDATES',
    'VIEW_DOCUMENTS',
    'DOWNLOAD_DOCUMENTS',
    'MANAGE_ROOMS',
    'MANAGE_INTERVIEWS',
    'VIEW_AUDIT_LOGS',
    'VIEW_REPORTS',
  ],
  CO_FOUNDER: [
    'ALL_PERMISSIONS',
    'FULL_ACCESS',
    'VIEW_DASHBOARDS',
    'VIEW_CANDIDATES',
    'VIEW_DOCUMENTS',
    'DOWNLOAD_DOCUMENTS',
    'MANAGE_ROOMS',
    'MANAGE_INTERVIEWS',
    'VIEW_AUDIT_LOGS',
    'VIEW_REPORTS',
  ],
  ADMIN: [
    'ALL_PERMISSIONS',
    'FULL_ACCESS',
    'MANAGE_USERS',
    'MANAGE_ROOMS',
    'MANAGE_SETTINGS',
    'EDIT_CANDIDATE',
    'DELETE_CANDIDATE',
    'VIEW_DOCUMENTS',
    'DOWNLOAD_DOCUMENTS',
    'VIEW_AUDIT_LOGS',
    'VIEW_REPORTS',
    'APPROVE_CHANGE_REQUESTS',
  ],
  HR: [
    'FULL_ACCESS',
    'HR_FULL_ACCESS',
    'VIEW_CANDIDATES',
    'EDIT_CANDIDATE',
    'DELETE_CANDIDATE',
    'VIEW_DOCUMENTS',
    'DOWNLOAD_DOCUMENTS',
    'ASSIGN_ROOMS',
    'MANAGE_INTERVIEWS',
    'VIEW_TIMELINE',
    'RECEIVE_ALERTS',
    'APPROVE_CHANGE_REQUESTS',
  ],
  INTERVIEWER: [
    'VIEW_ASSIGNED_CANDIDATES',
    'VIEW_RESUME',
    'START_INTERVIEW',
    'END_INTERVIEW',
    'SUBMIT_FEEDBACK',
  ],
  RECEPTION: [
    'RECEPTION_OPERATIONAL_VIEW',
    'CAPTURE_PHOTO',
    'CHECK_IN_CANDIDATE',
    'VIEW_ASSIGNED_ROOMS',
    'REQUEST_CHANGE',
  ],
  PANTRY: [
    'PANTRY_TASK_VIEW',
    'PANTRY_TASK_COMPLETE',
  ],
  EMPLOYEE: ['BASIC_VIEW'],
  MANAGER: ['TEAM_VIEW', 'INTERVIEW_VIEW'],
  VISITOR_COORDINATOR: ['VISITOR_VIEW', 'CHECK_IN_CANDIDATE'],
  FACILITIES: ['ROOM_VIEW', 'MAINTENANCE_TOGGLE'],
  SECURITY: ['GATE_VIEW', 'VISITOR_LOG'],
  SUPER_ADMIN: ['ALL_PERMISSIONS', 'FULL_ACCESS'],
};
