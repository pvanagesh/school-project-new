import { apiClient } from './client';
import type {
  AITimetableHistoryItem,
  AITimetableRequestValues,
  AITimetableResult,
  ClassStreamProfile,
  ClassStreamProfileFormValues,
  CommonRoom,
  CommonRoomFormValues,
  ProfileSubject,
  SchoolClass,
  SchoolClassFormValues,
  Section,
  SectionFormValues,
  SectionSubject,
  Subject,
  SubjectCategoryValue,
  SubjectFormValues,
  TimetableFormValues,
  TimetableSlot,
} from '../types';

export async function fetchClasses(): Promise<SchoolClass[]> {
  const { data } = await apiClient.get<SchoolClass[]>('/academics/classes/');
  return data;
}

export async function createClass(payload: SchoolClassFormValues): Promise<SchoolClass> {
  const { data } = await apiClient.post<SchoolClass>('/academics/classes/', payload);
  return data;
}

export async function deleteClass(id: number): Promise<void> {
  await apiClient.delete(`/academics/classes/${id}/`);
}

export async function fetchSections(): Promise<Section[]> {
  const { data } = await apiClient.get<Section[]>('/academics/sections/');
  return data;
}

export async function createSection(payload: SectionFormValues): Promise<Section> {
  const { data } = await apiClient.post<Section>('/academics/sections/', payload);
  return data;
}

export async function updateSection(id: number, payload: Partial<SectionFormValues>): Promise<Section> {
  const { data } = await apiClient.patch<Section>(`/academics/sections/${id}/`, payload);
  return data;
}

export async function deleteSection(id: number): Promise<void> {
  await apiClient.delete(`/academics/sections/${id}/`);
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>('/academics/subjects/');
  return data;
}

export async function createSubject(payload: SubjectFormValues): Promise<Subject> {
  const { data } = await apiClient.post<Subject>('/academics/subjects/', payload);
  return data;
}

export async function updateSubject(id: number, payload: Partial<SubjectFormValues>): Promise<Subject> {
  const { data } = await apiClient.patch<Subject>(`/academics/subjects/${id}/`, payload);
  return data;
}

export async function deleteSubject(id: number): Promise<void> {
  await apiClient.delete(`/academics/subjects/${id}/`);
}

export async function fetchCommonRooms(): Promise<CommonRoom[]> {
  const { data } = await apiClient.get<CommonRoom[]>('/academics/common-rooms/');
  return data;
}

export async function createCommonRoom(payload: CommonRoomFormValues): Promise<CommonRoom> {
  const { data } = await apiClient.post<CommonRoom>('/academics/common-rooms/', payload);
  return data;
}

export async function updateCommonRoom(id: number, payload: Partial<CommonRoomFormValues>): Promise<CommonRoom> {
  const { data } = await apiClient.patch<CommonRoom>(`/academics/common-rooms/${id}/`, payload);
  return data;
}

export async function deleteCommonRoom(id: number): Promise<void> {
  await apiClient.delete(`/academics/common-rooms/${id}/`);
}

export async function fetchStreamProfiles(): Promise<ClassStreamProfile[]> {
  const { data } = await apiClient.get<ClassStreamProfile[]>('/academics/stream-profiles/');
  return data;
}

export async function createStreamProfile(payload: ClassStreamProfileFormValues): Promise<ClassStreamProfile> {
  const { data } = await apiClient.post<ClassStreamProfile>('/academics/stream-profiles/', payload);
  return data;
}

export async function addProfileSubject(
  profile: number,
  subject: number,
  category: SubjectCategoryValue,
): Promise<ProfileSubject> {
  const { data } = await apiClient.post<ProfileSubject>('/academics/profile-subjects/', {
    profile,
    subject,
    category,
  });
  return data;
}

export async function removeProfileSubject(id: number): Promise<void> {
  await apiClient.delete(`/academics/profile-subjects/${id}/`);
}

export async function fetchSectionSubjects(): Promise<SectionSubject[]> {
  const { data } = await apiClient.get<SectionSubject[]>('/academics/section-subjects/');
  return data;
}

export async function assignSectionSubject(section: number, subject: number): Promise<SectionSubject> {
  const { data } = await apiClient.post<SectionSubject>('/academics/section-subjects/', { section, subject });
  return data;
}

export async function unassignSectionSubject(id: number): Promise<void> {
  await apiClient.delete(`/academics/section-subjects/${id}/`);
}

export async function fetchTimetable(sectionId: number): Promise<TimetableSlot[]> {
  const { data } = await apiClient.get<TimetableSlot[]>('/academics/timetable/', { params: { section: sectionId } });
  return data;
}

export async function fetchTimetableByTeacher(teacherId: number): Promise<TimetableSlot[]> {
  const { data } = await apiClient.get<TimetableSlot[]>('/academics/timetable/', { params: { teacher: teacherId } });
  return data;
}

// For Teacher/Class Teacher role: the backend scopes this to the logged-in
// teacher's own slots when no section param is given.
export async function fetchMyTimetable(): Promise<TimetableSlot[]> {
  const { data } = await apiClient.get<TimetableSlot[]>('/academics/timetable/');
  return data;
}

export async function createTimetableSlot(payload: TimetableFormValues): Promise<TimetableSlot> {
  const { data } = await apiClient.post<TimetableSlot>('/academics/timetable/', payload);
  return data;
}

export async function updateTimetableSlot(
  id: number,
  payload: Partial<TimetableFormValues>,
): Promise<TimetableSlot> {
  const { data } = await apiClient.patch<TimetableSlot>(`/academics/timetable/${id}/`, payload);
  return data;
}

export async function deleteTimetableSlot(id: number): Promise<void> {
  await apiClient.delete(`/academics/timetable/${id}/`);
}

export async function generateAITimetable(payload: AITimetableRequestValues): Promise<AITimetableResult> {
  const body = {
    provider: payload.provider || null,
    model: payload.model || null,
    extra_instructions: payload.extra_instructions || null,
    class_names: payload.class_names.length > 0 ? payload.class_names : null,
  };
  const { data } = await apiClient.post<AITimetableResult>('/academics/timetable/generate-ai/', body, {
    timeout: 200_000,
  });
  return data;
}

export async function fetchAITimetableHistory(): Promise<AITimetableHistoryItem[]> {
  const { data } = await apiClient.get<AITimetableHistoryItem[]>('/academics/ai-timetable-history/');
  return data;
}

export async function deleteAITimetableHistory(id: number): Promise<void> {
  await apiClient.delete(`/academics/ai-timetable-history/${id}/`);
}
