// Role names are free-form on the backend (not a closed enum) — any string is
// a valid role name. Nav-gating and permission checks key off these exact
// strings, so renaming a seeded (is_system) role can change what its members
// can access — is_system only blocks deletion, not renaming.
export type RoleName = string;

export interface Role {
  id: number;
  uid: string;
  name: RoleName;
  description: string;
  is_system: boolean;
}

export interface User {
  id: number;
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number | null;
  role_name: RoleName | null;
  phone: string;
  is_active: boolean;
  date_joined: string;
  teacher_id: number | null;
  // Which of the school's 4 "divisions" (board x junior/senior) this staff
  // member is confined to. Only meaningful for PRINCIPAL, TEACHER,
  // CLASS_TEACHER and ACCOUNTANT — see DIVISION_SCOPED_ROLES below. Null
  // for Super Admin and roles this doesn't apply to.
  assigned_board: BoardValue | null;
  assigned_group: DivisionGroupValue | null;
}

export interface SchoolProfile {
  id: number;
  uid: string;
  name: string;
  udise_code: string;
  board: BoardValue;
  // Which of the two class groups this profile covers — together with
  // board this is the division (CBSE School, CBSE College, SSC School, SSC
  // College) the profile belongs to. Up to 4 profiles can exist, one per
  // division.
  group: DivisionGroupValue;
  state: string;
  district: string;
  address: string;
  affiliation_number: string;
  principal_name: string;
}

export interface AcademicYear {
  id: number;
  uid: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface DashboardData {
  role: RoleName | null;
  total_students: number;
  total_teachers: number;
  total_classes: number;
  total_sections: number;
  students_by_stream: Record<string, number>;
  today_attendance: Record<AttendanceStatusValue, number>;
  fees_collected_this_month: string;
  total_exams: number;
}

export interface Teacher {
  id: number;
  uid: string;
  teacher_id: string;
  user: number;
  user_username: string;
  user_email: string;
  user_assigned_board: BoardValue | null;
  user_assigned_group: DivisionGroupValue | null;
  first_name: string;
  last_name: string;
  qualification: string;
  experience_years: number;
  subject_specialization: string;
  contact: string;
  joining_date: string;
}

export interface TeacherFormValues {
  teacher_id: string;
  first_name: string;
  last_name: string;
  qualification: string;
  experience_years: number;
  subject_specialization: string;
  contact: string;
  joining_date: string;
  username?: string;
  password?: string;
  email?: string;
  // Only sent on create — which division's tab was active on the Teachers
  // page when "Add Teacher" was clicked. Ignored by the API on update.
  assigned_board?: BoardValue;
  assigned_group?: DivisionGroupValue;
}

export type StreamValue = 'SCIENCE' | 'COMMERCE' | 'HUMANITIES';

export const STREAM_LABELS: Record<StreamValue, string> = {
  SCIENCE: 'Science',
  COMMERCE: 'Commerce',
  HUMANITIES: 'Humanities',
};

// Matches SchoolClass.Level on the backend (LKG-12 CBSE curriculum, fixed set).
export const LEVEL_CHOICES: { value: string; label: string }[] = [
  { value: 'LKG', label: 'LKG' },
  { value: 'UKG', label: 'UKG' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Class ${i + 1}` })),
];

export function levelLabel(level: string): string {
  return LEVEL_CHOICES.find((l) => l.value === level)?.label ?? level;
}

export function levelHasStreams(level: string): boolean {
  return level === '11' || level === '12';
}

// Classes 11-12 are always their own group, distinct from Classes 1-10, on
// both boards — only the wording changes: CBSE keeps "Class 11"/"Class 12",
// SSC calls the group "Intermediate" (1st/2nd Year is the standard SSC term
// for 11th/12th).
export function seniorSecondaryGroupLabel(board: string): string {
  return board === 'SSC' ? 'Intermediate (11th & 12th)' : 'Senior Secondary (11th & 12th)';
}

export function seniorSecondaryLevelLabel(level: string, board: string): string {
  if (board === 'SSC') {
    if (level === '11') return 'Intermediate 1st Year';
    if (level === '12') return 'Intermediate 2nd Year';
  }
  return levelLabel(level);
}

// Board-aware display name for an existing class: keeps whatever was
// actually stored/typed for Classes 1-10, and re-labels 11/12 to match the
// school's current board setting so a later board change updates the
// display everywhere without touching stored data.
export function classDisplayName(level: string, storedName: string, board: string): string {
  if (levelHasStreams(level)) return seniorSecondaryLevelLabel(level, board);
  return storedName;
}

export interface SchoolClass {
  id: number;
  uid: string;
  name: string;
  level: string;
  board: BoardValue;
}

export type CombinationValue =
  | 'PCM'
  | 'PCB'
  | 'PCMB'
  | 'COMMERCE_MATHS'
  | 'COMMERCE_APPLIED_MATHS'
  | 'COMMERCE_CS'
  | 'COMMERCE_IP'
  | 'COMMERCE_ENTREPRENEURSHIP'
  | 'MPC'
  | 'BIPC'
  | 'CEC'
  | 'HEC';

export const COMBINATION_LABELS: Record<CombinationValue, string> = {
  PCM: 'PCM (Physics, Chemistry, Mathematics)',
  PCB: 'PCB (Physics, Chemistry, Biology)',
  PCMB: 'PCMB (Physics, Chemistry, Mathematics, Biology)',
  COMMERCE_MATHS: 'Commerce with Mathematics',
  COMMERCE_APPLIED_MATHS: 'Commerce with Applied Mathematics',
  COMMERCE_CS: 'Commerce with Computer Science',
  COMMERCE_IP: 'Commerce with Informatics Practices',
  COMMERCE_ENTREPRENEURSHIP: 'Commerce with Entrepreneurship',
  MPC: 'MPC (Mathematics, Physics, Chemistry)',
  BIPC: 'BiPC (Biology, Physics, Chemistry)',
  CEC: 'CEC (Civics, Economics, Commerce)',
  HEC: 'HEC (History, Economics, Civics)',
};

// CBSE keeps its familiar Science/Commerce electives (PCM/PCB/PCMB and the 5
// Commerce combos). SSC's Intermediate uses the standard Andhra Pradesh
// group codes instead — MPC/BiPC under Science, CEC under Commerce, HEC
// under Humanities — so which list applies depends on the board, not just
// the stream.
export function combinationsByStream(board: BoardValue): Record<StreamValue, CombinationValue[]> {
  if (board === 'SSC') {
    return { SCIENCE: ['MPC', 'BIPC'], COMMERCE: ['CEC'], HUMANITIES: ['HEC'] };
  }
  return {
    SCIENCE: ['PCM', 'PCB', 'PCMB'],
    COMMERCE: ['COMMERCE_MATHS', 'COMMERCE_APPLIED_MATHS', 'COMMERCE_CS', 'COMMERCE_IP', 'COMMERCE_ENTREPRENEURSHIP'],
    HUMANITIES: [],
  };
}

export interface Section {
  id: number;
  uid: string;
  school_class: number;
  name: string;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  class_teacher: number | null;
  class_teacher_name: string | null;
  room: number | null;
  room_name: string | null;
  room_code: string | null;
}

export interface SchoolClassFormValues {
  name: string;
  level: string;
  board: BoardValue;
}

export interface SectionFormValues {
  school_class: number | null;
  name: string;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  class_teacher: number | null;
  room: number | null;
}

export type LanguageTierValue = 'FIRST' | 'SECOND' | 'THIRD' | 'ADDITIONAL';

export const LANGUAGE_TIER_LABELS: Record<LanguageTierValue, string> = {
  FIRST: 'First Language',
  SECOND: 'Second Language',
  THIRD: 'Third Language',
  ADDITIONAL: 'Additional Language',
};

export type CoScholasticCategoryValue = 'ARTS' | 'PERFORMING_ARTS' | 'SPORTS' | 'LIFE_SKILLS' | 'TECHNOLOGY';

export const CO_SCHOLASTIC_CATEGORY_LABELS: Record<CoScholasticCategoryValue, string> = {
  ARTS: 'Arts',
  PERFORMING_ARTS: 'Performing Arts',
  SPORTS: 'Sports',
  LIFE_SKILLS: 'Life Skills',
  TECHNOLOGY: 'Technology',
};

export type SubjectCategoryValue = 'MANDATORY' | 'OPTIONAL' | 'CO_SCHOLASTIC';

export const SUBJECT_CATEGORY_LABELS: Record<SubjectCategoryValue, string> = {
  MANDATORY: 'Mandatory',
  OPTIONAL: 'Optional / Skill',
  CO_SCHOLASTIC: 'Co-Scholastic',
};

export interface Subject {
  id: number;
  uid: string;
  name: string;
  code: string;
  min_level: string | null;
  max_level: string | null;
  language_tier: LanguageTierValue | null;
  co_scholastic_category: CoScholasticCategoryValue | null;
}

export interface SubjectFormValues {
  name: string;
  code?: string;
  min_level?: string | null;
  max_level?: string | null;
  language_tier: LanguageTierValue | null;
  co_scholastic_category: CoScholasticCategoryValue | null;
}

// Ordinal ordering of SchoolClass.level values, for comparing a subject's
// min_level/max_level range against a specific class.
export const CLASS_LEVEL_ORDER = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function levelInRange(level: string, minLevel: string | null, maxLevel: string | null): boolean {
  const idx = CLASS_LEVEL_ORDER.indexOf(level);
  if (idx === -1) return true;
  if (minLevel && idx < CLASS_LEVEL_ORDER.indexOf(minLevel)) return false;
  if (maxLevel && idx > CLASS_LEVEL_ORDER.indexOf(maxLevel)) return false;
  return true;
}

export type RoomTypeValue = 'CLASS_ROOM' | 'COMMON_ROOM';

export const ROOM_TYPE_LABELS: Record<RoomTypeValue, string> = {
  CLASS_ROOM: 'Class Room',
  COMMON_ROOM: 'Common Room',
};

// Only meaningful for COMMON_ROOM rows — a Class Room's group is worked out
// from whichever section it's assigned to instead.
export type ClassGroupValue = 'JUNIOR' | 'SENIOR' | 'BOTH';

export function classGroupLabel(group: ClassGroupValue, board: string): string {
  if (group === 'JUNIOR') return 'Classes 1 – 10';
  if (group === 'SENIOR') return seniorSecondaryGroupLabel(board);
  return 'Both';
}

export interface CommonRoom {
  id: number;
  uid: string;
  name: string;
  code: string;
  room_type: RoomTypeValue;
  class_group: ClassGroupValue;
  subject: number | null;
  subject_name: string | null;
}

export interface CommonRoomFormValues {
  name: string;
  code?: string;
  room_type: RoomTypeValue;
  class_group?: ClassGroupValue;
  subject?: number | null;
}

export interface ProfileSubject {
  id: number;
  uid: string;
  profile: number;
  subject: number;
  subject_name: string;
  category: SubjectCategoryValue;
}

export interface SectionSubject {
  id: number;
  uid: string;
  section: number;
  subject: number;
}

export type BoardValue = 'CBSE' | 'SSC';

export const BOARD_LABELS: Record<BoardValue, string> = {
  CBSE: 'CBSE',
  SSC: 'SSC (State Board)',
};

// The school's 4 "divisions" are every (board x junior/senior) combination.
// A staff account in one of DIVISION_SCOPED_ROLES only ever sees its own
// division's data — see accounts.scoping on the backend.
export type DivisionGroupValue = 'JUNIOR' | 'SENIOR';

export const DIVISION_GROUP_LABELS: Record<DivisionGroupValue, string> = {
  JUNIOR: 'Classes 1 – 10',
  SENIOR: '11th & 12th',
};

export const DIVISION_SCOPED_ROLES = ['PRINCIPAL', 'TEACHER', 'CLASS_TEACHER', 'ACCOUNTANT'];

export function divisionLabel(board: BoardValue | null, group: DivisionGroupValue | null): string {
  if (!board || !group) return 'Not assigned';
  return `${BOARD_LABELS[board]} · ${DIVISION_GROUP_LABELS[group]}`;
}

export interface ClassStreamProfile {
  id: number;
  uid: string;
  school_class: number;
  class_name: string;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  board: BoardValue;
  subjects: ProfileSubject[];
}

export interface ClassStreamProfileFormValues {
  school_class: number | null;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  board: BoardValue;
}

export type DayValue = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export const DAY_LABELS: Record<DayValue, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
};

export const DAYS: DayValue[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Display-only period time bands, laid out around the school's break
// schedule below (50-minute periods, shifted after each break). Actual slot
// start/end times are still stored per-row; this is just the column-header
// convention shown on the day-wise timetable grid.
export const PERIOD_TIMES: Record<number, string> = {
  1: '9:00-9:50',
  2: '9:50-10:40',
  3: '10:50-11:40',
  4: '11:40-12:30',
  5: '1:30-2:20',
  6: '2:20-3:10',
  7: '3:20-4:10',
};

// Breaks shown as their own columns right after the given period number.
export interface PeriodBreak {
  afterPeriod: number;
  label: string;
  time: string;
}

export const PERIOD_BREAKS: PeriodBreak[] = [
  { afterPeriod: 2, label: 'Break', time: '10:40-10:50' },
  { afterPeriod: 4, label: 'Break', time: '12:30-1:30' },
  { afterPeriod: 6, label: 'Break', time: '3:10-3:20' },
];

export interface TimetableSlot {
  id: number;
  uid: string;
  section: number;
  subject: number;
  subject_name: string;
  teacher: number;
  teacher_name: string;
  day_of_week: DayValue;
  period: number;
  start_time: string;
  end_time: string;
  classroom: string;
}

export interface TimetableFormValues {
  section: number | null;
  subject: number | null;
  teacher: number | null;
  day_of_week: DayValue | null;
  period: number | null;
  start_time: string;
  end_time: string;
  classroom: string;
}

export const AI_PROVIDERS = [
  { value: '', label: 'Default (from aiservice .env)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'local', label: 'Local (Ollama)' },
] as const;

export interface AITimetableRequestValues {
  provider: string;
  model: string;
  extra_instructions: string;
  class_names: string[];
}

export interface AITimetableResult {
  provider: string;
  model: string;
  raw_output: string;
}

export interface AITimetableHistoryItem {
  id: number;
  uid: string;
  created_by_name: string | null;
  created_at: string;
  provider: string;
  model: string;
  class_names: string[];
  extra_instructions: string;
  raw_output: string;
}

export function profileLabel(profile: { class_name: string; stream: StreamValue | null; combination: CombinationValue | null }): string {
  const suffix = profile.combination ? COMBINATION_LABELS[profile.combination] : profile.stream ? STREAM_LABELS[profile.stream] : null;
  return suffix ? `${profile.class_name} - ${suffix}` : profile.class_name;
}

export interface RoleFormValues {
  name: string;
  description: string;
}

export interface SchoolProfileFormValues {
  name: string;
  udise_code: string;
  board: BoardValue;
  group: DivisionGroupValue;
  district: string;
  address: string;
  affiliation_number: string;
  principal_name: string;
}

export interface AcademicYearFormValues {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface UserFormValues {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: number | null;
  is_active: boolean;
  password?: string;
  assigned_board?: BoardValue | null;
  assigned_group?: DivisionGroupValue | null;
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export type StudentStatusValue = 'ACTIVE' | 'PROMOTED' | 'TRANSFERRED' | 'SUSPENDED' | 'WITHDRAWN';

export const STUDENT_STATUS_LABELS: Record<StudentStatusValue, string> = {
  ACTIVE: 'Active',
  PROMOTED: 'Promoted',
  TRANSFERRED: 'Transferred',
  SUSPENDED: 'Suspended',
  WITHDRAWN: 'Withdrawn',
};

export interface Student {
  id: number;
  uid: string;
  student_id: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  admission_date: string;
  current_class: number;
  current_class_name: string;
  current_section: number;
  current_section_name: string;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  stream_locked: boolean;
  parent_name: string;
  parent_contact: string;
  address: string;
  medical_info: string;
  previous_school: string;
  status: StudentStatusValue;
}

export interface StudentFormValues {
  student_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  admission_date: string;
  current_class: number | null;
  current_section: number | null;
  stream: StreamValue | null;
  combination: CombinationValue | null;
  parent_name: string;
  parent_contact: string;
  address: string;
  medical_info: string;
  previous_school: string;
  status: StudentStatusValue;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
  TEACHER: 'Teacher',
  CLASS_TEACHER: 'Class Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
  ACCOUNTANT: 'Accountant',
};

// Falls back to a humanized version of the raw name for custom roles that
// aren't in ROLE_LABELS (e.g. "LIBRARIAN" -> "Librarian").
export function roleLabel(name: string): string {
  if (ROLE_LABELS[name]) return ROLE_LABELS[name];
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type AttendanceStatusValue = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusValue, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  HALF_DAY: 'Half Day',
};

export const ATTENDANCE_STATUSES: AttendanceStatusValue[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];

export interface AttendanceRecord {
  id: number;
  uid: string;
  student: number;
  student_name: string;
  date: string;
  status: AttendanceStatusValue;
  marked_by: number | null;
  marked_by_username: string | null;
  is_locked: boolean;
}

export interface AttendanceBulkEntry {
  student: number;
  status: AttendanceStatusValue;
}

export interface PastAttendanceEditGrant {
  id: number;
  uid: string;
  teacher: number;
  teacher_name: string;
  granted_by: number | null;
  granted_by_username: string | null;
  granted_at: string;
  used_at: string | null;
  used_for_date: string | null;
}

export interface Exam {
  id: number;
  uid: string;
  name: string;
  term: string;
  academic_year: number;
  academic_year_name: string;
  school_class: number;
  school_class_name: string;
}

export interface ExamFormValues {
  name: string;
  term: string;
  academic_year: number | null;
  school_class: number | null;
}

export type AssessmentModeValue = 'CCE_GRADE' | 'BOARD_MARKS';

export const ASSESSMENT_MODE_LABELS: Record<AssessmentModeValue, string> = {
  CCE_GRADE: 'CCE Grade (LKG-10)',
  BOARD_MARKS: 'Board Marks (11-12)',
};

export interface AssessmentConfig {
  id: number;
  uid: string;
  school_class: number;
  school_class_name: string;
  mode: AssessmentModeValue;
}

export interface AssessmentConfigFormValues {
  school_class: number | null;
  mode: AssessmentModeValue | null;
}

export interface SubjectMarksConfig {
  id: number;
  uid: string;
  subject: number;
  subject_name: string;
  school_class: number;
  school_class_name: string;
  max_theory: number;
  max_internal: number;
}

export interface SubjectMarksConfigFormValues {
  subject: number | null;
  school_class: number | null;
  max_theory: number;
  max_internal: number;
}

export interface MarksEntry {
  id: number;
  uid: string;
  student: number;
  student_name: string;
  subject: number;
  subject_name: string;
  exam: number;
  exam_name: string;
  theory_marks: string | null;
  internal_marks: string | null;
  grade: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by_username: string | null;
}

export interface MarksBulkEntry {
  student: number;
  theory_marks: number | null;
  internal_marks: number | null;
  grade: string;
}

export interface FeeCategory {
  id: number;
  uid: string;
  name: string;
}

export interface FeeCategoryFormValues {
  name: string;
}

export interface FeeStructure {
  id: number;
  uid: string;
  school_class: number;
  school_class_name: string;
  stream: StreamValue | null;
  category: number;
  category_name: string;
  amount: string;
  academic_year: number;
  academic_year_name: string;
}

export interface FeeStructureFormValues {
  school_class: number | null;
  stream: StreamValue | null;
  category: number | null;
  amount: number | null;
  academic_year: number | null;
}

export type PaymentModeValue = 'CASH' | 'UPI' | 'CHEQUE';

export const PAYMENT_MODE_LABELS: Record<PaymentModeValue, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
};

export interface Payment {
  id: number;
  uid: string;
  student: number;
  student_name: string;
  student_id_code: string;
  amount: string;
  mode: PaymentModeValue;
  reference_number: string;
  date: string;
  recorded_by: number | null;
  recorded_by_username: string | null;
}

export interface PaymentFormValues {
  student: number | null;
  amount: number | null;
  mode: PaymentModeValue | null;
  reference_number: string;
  date: string;
}

export interface PaymentAdjustment {
  id: number;
  uid: string;
  payment: number;
  payment_student_name: string;
  payment_amount: string;
  adjustment_amount: string;
  reason: string;
  created_by: number | null;
  created_at: string;
}

export interface PaymentAdjustmentFormValues {
  payment: number | null;
  adjustment_amount: number | null;
  reason: string;
}

export interface AttendanceReportRow {
  student: number;
  student_id: string;
  name: string;
  class_name: string;
  section_name: string;
  present: number;
  absent: number;
  late: number;
  half_day: number;
  total_marked: number;
  percentage: number | null;
}

export interface AttendanceReport {
  date_from: string;
  date_to: string;
  rows: AttendanceReportRow[];
  summary: { total_students: number; average_percentage: number | null };
}

export interface MarksReportSubject {
  id: number;
  name: string;
  max_theory: number;
  max_internal: number;
  max_total: number;
}

export interface MarksReportCell {
  theory: number | null;
  internal: number | null;
  total: number | null;
  grade: string | null;
  is_published: boolean;
}

export interface MarksReportRow {
  student: number;
  student_id: string;
  name: string;
  section_name: string;
  marks: Record<number, MarksReportCell | null>;
  total_obtained: number | null;
  total_max: number | null;
  percentage: number | null;
}

export interface MarksReport {
  exam: { id: number; name: string; term: string; school_class: string; academic_year: string };
  mode: AssessmentModeValue;
  subjects: MarksReportSubject[];
  rows: MarksReportRow[];
}

export interface FeeReportRow {
  uid: string;
  date: string;
  student: number;
  student_id: string;
  student_name: string;
  class_name: string;
  section_name: string;
  amount: number;
  mode: PaymentModeValue;
  reference_number: string;
}

export interface FeeReport {
  date_from: string;
  date_to: string;
  rows: FeeReportRow[];
  summary: { count: number; total_amount: number; by_mode: Record<PaymentModeValue, number> };
}

export interface EnrollmentReportRow {
  class_name: string;
  section_name: string;
  stream: string | null;
  combination: string | null;
  total: number;
  gender_breakdown: Record<string, number>;
}

export interface EnrollmentReport {
  rows: EnrollmentReportRow[];
  summary: { total_students: number; by_gender: Record<string, number> };
}
