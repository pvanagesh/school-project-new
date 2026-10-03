import { apiClient } from './client';
import type { AttendanceReport, EnrollmentReport, FeeReport, MarksReport } from '../types';

export async function fetchAttendanceReport(params: {
  date_from: string;
  date_to: string;
  class?: number;
  section?: number;
}): Promise<AttendanceReport> {
  const { data } = await apiClient.get<AttendanceReport>('/reports/attendance/', { params });
  return data;
}

export async function fetchMarksReport(params: { exam: number; section?: number }): Promise<MarksReport> {
  const { data } = await apiClient.get<MarksReport>('/reports/marks/', { params });
  return data;
}

export async function fetchFeeReport(params: {
  date_from: string;
  date_to: string;
  class?: number;
  section?: number;
}): Promise<FeeReport> {
  const { data } = await apiClient.get<FeeReport>('/reports/fees/', { params });
  return data;
}

export async function fetchEnrollmentReport(): Promise<EnrollmentReport> {
  const { data } = await apiClient.get<EnrollmentReport>('/reports/enrollment/');
  return data;
}
