import { apiClient } from './client';
import type {
  AssessmentConfig,
  AssessmentConfigFormValues,
  Exam,
  ExamFormValues,
  MarksBulkEntry,
  MarksEntry,
  SubjectMarksConfig,
  SubjectMarksConfigFormValues,
} from '../types';

export async function fetchExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>('/exams/exams/');
  return data;
}

export async function createExam(payload: ExamFormValues): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams/exams/', payload);
  return data;
}

export async function updateExam(id: number, payload: Partial<ExamFormValues>): Promise<Exam> {
  const { data } = await apiClient.patch<Exam>(`/exams/exams/${id}/`, payload);
  return data;
}

export async function deleteExam(id: number): Promise<void> {
  await apiClient.delete(`/exams/exams/${id}/`);
}

export async function fetchAssessmentConfigs(): Promise<AssessmentConfig[]> {
  const { data } = await apiClient.get<AssessmentConfig[]>('/exams/assessment-configs/');
  return data;
}

export async function createAssessmentConfig(payload: AssessmentConfigFormValues): Promise<AssessmentConfig> {
  const { data } = await apiClient.post<AssessmentConfig>('/exams/assessment-configs/', payload);
  return data;
}

export async function updateAssessmentConfig(
  id: number,
  payload: Partial<AssessmentConfigFormValues>,
): Promise<AssessmentConfig> {
  const { data } = await apiClient.patch<AssessmentConfig>(`/exams/assessment-configs/${id}/`, payload);
  return data;
}

export async function deleteAssessmentConfig(id: number): Promise<void> {
  await apiClient.delete(`/exams/assessment-configs/${id}/`);
}

export async function fetchSubjectMarksConfigs(): Promise<SubjectMarksConfig[]> {
  const { data } = await apiClient.get<SubjectMarksConfig[]>('/exams/subject-marks-configs/');
  return data;
}

export async function createSubjectMarksConfig(
  payload: SubjectMarksConfigFormValues,
): Promise<SubjectMarksConfig> {
  const { data } = await apiClient.post<SubjectMarksConfig>('/exams/subject-marks-configs/', payload);
  return data;
}

export async function updateSubjectMarksConfig(
  id: number,
  payload: Partial<SubjectMarksConfigFormValues>,
): Promise<SubjectMarksConfig> {
  const { data } = await apiClient.patch<SubjectMarksConfig>(`/exams/subject-marks-configs/${id}/`, payload);
  return data;
}

export async function deleteSubjectMarksConfig(id: number): Promise<void> {
  await apiClient.delete(`/exams/subject-marks-configs/${id}/`);
}

export async function fetchMarksEntries(examId: number, subjectId: number): Promise<MarksEntry[]> {
  const { data } = await apiClient.get<MarksEntry[]>('/exams/marks-entries/', {
    params: { exam: examId, subject: subjectId },
  });
  return data;
}

export async function bulkSaveMarks(
  exam: number,
  subject: number,
  entries: MarksBulkEntry[],
): Promise<MarksEntry[]> {
  const { data } = await apiClient.post<MarksEntry[]>('/exams/marks-entries/bulk_save/', { exam, subject, entries });
  return data;
}

export async function publishMarks(exam: number, subject: number): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>('/exams/marks-entries/publish/', { exam, subject });
  return data;
}
