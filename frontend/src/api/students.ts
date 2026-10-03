import { apiClient } from './client';
import type { Student, StudentFormValues } from '../types';

export async function fetchStudents(classId?: number): Promise<Student[]> {
  const { data } = await apiClient.get<Student[]>('/students/students/', {
    params: classId ? { class: classId } : undefined,
  });
  return data;
}

export async function fetchStudentsBySection(sectionId: number): Promise<Student[]> {
  const { data } = await apiClient.get<Student[]>('/students/students/', { params: { section: sectionId } });
  return data;
}

export async function createStudent(payload: StudentFormValues): Promise<Student> {
  const { data } = await apiClient.post<Student>('/students/students/', payload);
  return data;
}

export async function updateStudent(id: number, payload: Partial<StudentFormValues>): Promise<Student> {
  const { data } = await apiClient.patch<Student>(`/students/students/${id}/`, payload);
  return data;
}

export async function deleteStudent(id: number): Promise<void> {
  await apiClient.delete(`/students/students/${id}/`);
}
