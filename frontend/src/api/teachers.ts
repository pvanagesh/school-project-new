import { apiClient } from './client';
import type { Teacher, TeacherFormValues } from '../types';

export async function fetchMyTeacherProfile(): Promise<Teacher> {
  const { data } = await apiClient.get<Teacher>('/teachers/me/');
  return data;
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const { data } = await apiClient.get<Teacher[]>('/teachers/teachers/');
  return data;
}

export async function createTeacher(payload: TeacherFormValues): Promise<Teacher> {
  const { data } = await apiClient.post<Teacher>('/teachers/teachers/', payload);
  return data;
}

export async function updateTeacher(id: number, payload: Partial<TeacherFormValues>): Promise<Teacher> {
  const { data } = await apiClient.patch<Teacher>(`/teachers/teachers/${id}/`, payload);
  return data;
}

export async function deleteTeacher(id: number): Promise<void> {
  await apiClient.delete(`/teachers/teachers/${id}/`);
}
