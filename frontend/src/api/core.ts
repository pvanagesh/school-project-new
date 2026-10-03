import { apiClient } from './client';
import type { AcademicYear, AcademicYearFormValues, SchoolProfile, SchoolProfileFormValues } from '../types';

export async function fetchSchoolProfiles(): Promise<SchoolProfile[]> {
  const { data } = await apiClient.get<SchoolProfile[]>('/core/school-profile/');
  return data;
}

export async function createSchoolProfile(payload: SchoolProfileFormValues): Promise<SchoolProfile> {
  const { data } = await apiClient.post<SchoolProfile>('/core/school-profile/', payload);
  return data;
}

export async function updateSchoolProfile(
  id: number,
  payload: Partial<SchoolProfileFormValues>,
): Promise<SchoolProfile> {
  const { data } = await apiClient.patch<SchoolProfile>(`/core/school-profile/${id}/`, payload);
  return data;
}

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await apiClient.get<AcademicYear[]>('/core/academic-years/');
  return data;
}

export async function createAcademicYear(payload: AcademicYearFormValues): Promise<AcademicYear> {
  const { data } = await apiClient.post<AcademicYear>('/core/academic-years/', payload);
  return data;
}

export async function updateAcademicYear(
  id: number,
  payload: Partial<AcademicYearFormValues>,
): Promise<AcademicYear> {
  const { data } = await apiClient.patch<AcademicYear>(`/core/academic-years/${id}/`, payload);
  return data;
}

export async function deleteAcademicYear(id: number): Promise<void> {
  await apiClient.delete(`/core/academic-years/${id}/`);
}
