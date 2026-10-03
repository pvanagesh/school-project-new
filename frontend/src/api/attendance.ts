import { apiClient } from './client';
import type { AttendanceBulkEntry, AttendanceRecord, PastAttendanceEditGrant } from '../types';

export async function fetchAttendance(sectionId: number, date: string): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>('/attendance/attendance/', {
    params: { section: sectionId, date },
  });
  return data;
}

export async function bulkMarkAttendance(date: string, entries: AttendanceBulkEntry[]): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.post<AttendanceRecord[]>('/attendance/attendance/bulk_mark/', { date, entries });
  return data;
}

// Locks a section's attendance for a date so it can no longer be changed
// that day. Call once the full roster has been saved via bulkMarkAttendance.
export async function confirmAttendanceDay(sectionId: number, date: string): Promise<{ detail: string; locked_count: number }> {
  const { data } = await apiClient.post('/attendance/attendance/confirm_day/', { section: sectionId, date });
  return data;
}

// For a Teacher/Class Teacher: their own grants. For Principal/Super Admin
// (pass teacherId): a specific teacher's grant history.
export async function fetchPastAttendanceGrants(teacherId?: number): Promise<PastAttendanceEditGrant[]> {
  const { data } = await apiClient.get<PastAttendanceEditGrant[]>('/attendance/past-attendance-grants/', {
    params: teacherId ? { teacher: teacherId } : undefined,
  });
  return data;
}

export async function createPastAttendanceGrant(teacherId: number): Promise<PastAttendanceEditGrant> {
  const { data } = await apiClient.post<PastAttendanceEditGrant>('/attendance/past-attendance-grants/', {
    teacher: teacherId,
  });
  return data;
}
