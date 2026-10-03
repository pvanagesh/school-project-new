import { Fragment, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
import Tooltip from '@mui/material/Tooltip';
import { fetchClasses, fetchMyTimetable, fetchSections, fetchSubjects } from '../api/academics';
import { PageHeader } from '../components/PageHeader';
import { bulkMarkAttendance, confirmAttendanceDay, fetchAttendance } from '../api/attendance';
import { bulkSaveMarks, fetchExams, fetchMarksEntries, fetchSubjectMarksConfigs, publishMarks } from '../api/exams';
import { fetchStudentsBySection } from '../api/students';
import { fetchMyTeacherProfile } from '../api/teachers';
import { useAuth } from '../auth/AuthContext';
import { dayCodeForDateString } from '../utils/dayOfWeek';
import {
  DAYS,
  DAY_LABELS,
  PERIODS,
  PERIOD_BREAKS,
  PERIOD_TIMES,
  type AttendanceRecord,
  type AttendanceStatusValue,
  type DayValue,
  type Exam,
  type MarksEntry,
  type SchoolClass,
  type Section,
  type Student,
  type Subject,
  type SubjectMarksConfig,
  type Teacher,
  type TimetableSlot,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { isDuringLastPeriod, isOutsideSchoolHours } from '../utils/schoolHours';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TeacherPortalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState<Teacher | null>(null);
  const [mySlots, setMySlots] = useState<TimetableSlot[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [subjectMarksConfigs, setSubjectMarksConfigs] = useState<SubjectMarksConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchMyTeacherProfile(),
      fetchMyTimetable(),
      fetchClasses(),
      fetchSections(),
      fetchSubjects(),
      fetchExams(),
      fetchSubjectMarksConfigs(),
    ])
      .then(([p, slots, c, s, subj, e, smc]) => {
        setProfile(p);
        setMySlots(slots);
        setClasses(c);
        setSections(s);
        setSubjects(subj);
        setExams(e);
        setSubjectMarksConfigs(smc);
      })
      .catch(() => setError('Could not load your teaching data from the API.'));
  }, []);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes?.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const mySections = useMemo(() => {
    if (!mySlots || !sections) return [];
    const ids = new Set(mySlots.map((s) => s.section));
    return sections.filter((s) => ids.has(s.id));
  }, [mySlots, sections]);

  // Mark Attendance is only ever usable if this teacher is a Class Teacher of
  // some section, or has Period 1 for some section on at least one day of the
  // week — otherwise no date will ever make the section picker non-empty, so
  // the tab itself is disabled rather than leaving it clickable into a dead end.
  const canMarkAttendance = useMemo(() => {
    if (!sections || !mySlots) return false;
    const isClassTeacherOfAny = sections.some((s) => s.class_teacher === user?.teacher_id);
    const hasAnyPeriod1 = mySlots.some((slot) => slot.period === 1);
    return isClassTeacherOfAny || hasAnyPeriod1;
  }, [sections, mySlots, user]);

  const handleTabChange = (_e: SyntheticEvent, value: number) => setTab(value);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!profile || !mySlots || !classes || !sections || !subjects || !exams || !subjectMarksConfigs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={CastForEducationIcon} title="My Teaching Portal" />

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <CastForEducationIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h6">
                {profile.first_name} {profile.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profile.teacher_id} · {profile.subject_specialization} · {mySections.length} section(s) taught
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="My Timetable" />
        {canMarkAttendance ? (
          // A bare Tab, exactly like the other two, whenever it's actually
          // usable — the Tooltip/span wrapper below is only needed to show
          // an explanation on a disabled Tab (native disabled elements don't
          // fire hover events), and wrapping it unconditionally risked MUI's
          // Tabs component not wiring the click/value handling straight
          // through to a non-direct-child Tab in every version/config.
          <Tab label="Mark Attendance" />
        ) : (
          <Tooltip title="You're not a Class Teacher and don't have Period 1 for any section on any day, so there's no attendance you can mark">
            <span>
              <Tab label="Mark Attendance" disabled />
            </span>
          </Tooltip>
        )}
        <Tab label="Enter Marks" />
      </Tabs>

      {tab === 0 && <MyTimetableTab slots={mySlots} sections={sections} classById={classById} />}
      {tab === 1 && canMarkAttendance && (
        <MarkAttendanceTab sections={sections} mySlots={mySlots} classById={classById} />
      )}
      {tab === 2 && (
        <EnterMarksTab
          exams={exams}
          subjects={subjects}
          subjectMarksConfigs={subjectMarksConfigs}
          mySections={mySections}
          mySlots={mySlots}
        />
      )}
    </Box>
  );
}

// ---------- My Timetable ----------

function MyTimetableTab({
  slots,
  sections,
  classById,
}: {
  slots: TimetableSlot[];
  sections: Section[];
  classById: Record<number, SchoolClass>;
}) {
  const sectionById = useMemo(() => {
    const map: Record<number, Section> = {};
    sections.forEach((s) => (map[s.id] = s));
    return map;
  }, [sections]);

  const slotFor = (day: DayValue, period: number) => slots.find((s) => s.day_of_week === day && s.period === period) ?? null;
  const breakAfter = (period: number) => PERIOD_BREAKS.find((b) => b.afterPeriod === period);

  const sectionLabel = (sectionId: number) => {
    const section = sectionById[sectionId];
    if (!section) return '—';
    return `${classById[section.school_class]?.name ?? '—'} - ${section.name}`;
  };

  if (slots.length === 0) {
    return <Alert severity="info">You have no timetable slots assigned yet.</Alert>;
  }

  return (
    <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Day</TableCell>
              {PERIODS.map((p) => {
                const brk = breakAfter(p);
                return (
                  <Fragment key={p}>
                    <TableCell>
                      P{p}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {PERIOD_TIMES[p]}
                      </Typography>
                    </TableCell>
                    {brk && (
                      <TableCell
                        title={`${brk.label} · ${brk.time}`}
                        sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                      />
                    )}
                  </Fragment>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {DAYS.map((day) => (
              <TableRow key={day}>
                <TableCell>{DAY_LABELS[day]}</TableCell>
                {PERIODS.map((period) => {
                  const slot = slotFor(day, period);
                  const brk = breakAfter(period);
                  return (
                    <Fragment key={period}>
                      <TableCell sx={{ minWidth: 140, verticalAlign: 'top' }}>
                        {slot ? (
                          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {slot.subject_name}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              {sectionLabel(slot.section)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {slot.classroom}
                            </Typography>
                          </Box>
                        ) : null}
                      </TableCell>
                      {brk && (
                        <TableCell
                          title={`${brk.label} · ${brk.time}`}
                          sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// ---------- Mark Attendance ----------

const ATTENDANCE_PAGE_SIZE = 10;

function MarkAttendanceTab({
  sections,
  mySlots,
  classById,
}: {
  sections: Section[];
  mySlots: TimetableSlot[];
  classById: Record<number, SchoolClass>;
}) {
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [date, setDate] = useState(todayIso());
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatusValue>>({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [page, setPage] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const { user } = useAuth();

  const dayCode = useMemo(() => dayCodeForDateString(date), [date]);

  // A teacher may mark a section's daily attendance if she's its Class
  // Teacher, or — per the timetable — has that section's Period 1 on this
  // date's weekday: whichever teacher takes first period takes attendance,
  // Class Teacher or not.
  const mySections = useMemo(() => {
    const period1SectionIds = new Set(
      mySlots.filter((slot) => slot.period === 1 && slot.day_of_week === dayCode).map((slot) => slot.section),
    );
    return sections.filter((s) => s.class_teacher === user?.teacher_id || period1SectionIds.has(s.id));
  }, [sections, mySlots, dayCode, user]);

  // Admin/Principal never reach this teacher-only tab, so a locked day always
  // shuts out further edits here (unlike the shared AttendancePage).
  const uiLocked = locked;

  // The date (and so the eligible-sections list) can change out from under
  // an already-selected section — drop it back to the picker rather than
  // leaving a now-ineligible section selected.
  useEffect(() => {
    if (sectionId && !mySections.some((s) => s.id === sectionId)) {
      setSectionId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySections]);

  useEffect(() => {
    if (!sectionId || !date) {
      setRoster(null);
      return;
    }
    setRoster(null);
    setRosterError(null);
    setPage(0);
    setIsSaved(false);
    setLocked(false);
    Promise.all([fetchStudentsBySection(sectionId), fetchAttendance(sectionId, date)])
      .then(([students, existing]) => {
        setRoster(students);
        const byStudent: Record<number, AttendanceStatusValue> = {};
        students.forEach((s) => (byStudent[s.id] = 'ABSENT'));
        existing.forEach((rec: AttendanceRecord) => (byStudent[rec.student] = rec.status));
        setStatuses(byStudent);
        // Locked either because it was explicitly confirmed, or because
        // today's 9am-5pm marking window has already closed — the backend
        // enforces the latter too (see _outside_school_hours_today), this
        // just reflects it in the UI immediately instead of after a failed save.
        setLocked(existing.some((rec: AttendanceRecord) => rec.is_locked) || isOutsideSchoolHours(date));
      })
      .catch(() => setRosterError('Could not load the roster or existing attendance for this section/date.'));
  }, [sectionId, date]);

  const handleStatusChange = (studentId: number, status: AttendanceStatusValue) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    setIsSaved(false);
  };

  // The checkbox has one fixed meaning: Present. Everyone loads unchecked
  // (Absent) — a teacher checks off the students who are actually present.
  const handleCheckboxToggle = (studentId: number, checked: boolean) => {
    handleStatusChange(studentId, checked ? 'PRESENT' : 'ABSENT');
  };

  const pageCount = roster ? Math.ceil(roster.length / ATTENDANCE_PAGE_SIZE) : 0;
  const hasNextPage = page < pageCount - 1;
  const visibleRoster = roster ? roster.slice(page * ATTENDANCE_PAGE_SIZE, (page + 1) * ATTENDANCE_PAGE_SIZE) : [];

  // "All Present" only affects the current page, matching what Save actually
  // persists — otherwise checking it would silently mark other pages Present
  // in memory without ever saving that for them.
  const handleMarkAll = (status: AttendanceStatusValue) => {
    setStatuses((prev) => {
      const next = { ...prev };
      visibleRoster.forEach((s) => (next[s.id] = status));
      return next;
    });
    setIsSaved(false);
  };

  const allPresent = visibleRoster.every((s) => (statuses[s.id] ?? 'ABSENT') === 'PRESENT');

  // Save only commits the current page's students — bulk_mark upserts by
  // student, so students on pages the teacher hasn't reached yet are simply
  // left untouched (no record) instead of being written as Absent. Moving to
  // the next page requires its own explicit Save. Saving no longer resets
  // the picker on the last page — Confirm is now the explicit step that
  // finishes marking for the day.
  const handleSave = async () => {
    if (!roster || !sectionId || uiLocked) return;
    setSaving(true);
    setRosterError(null);
    try {
      const entries = visibleRoster.map((s) => ({ student: s.id, status: statuses[s.id] ?? 'ABSENT' }));
      await bulkMarkAttendance(date, entries);
      setSnackbar(`Attendance saved for ${visibleRoster.length} student(s).`);
      setIsSaved(true);
    } catch (err) {
      setRosterError(firstApiError(err, 'Could not save attendance.'));
    } finally {
      setSaving(false);
    }
  };

  // Locks the whole section's attendance for this date — after this, no
  // teacher (including whoever confirmed it) can change it again today.
  const handleConfirm = async () => {
    if (!sectionId) return;
    setSaving(true);
    setRosterError(null);
    try {
      await confirmAttendanceDay(sectionId, date);
      setSnackbar('Attendance confirmed for the day — it can no longer be changed.');
      setLocked(true);
    } catch (err) {
      setRosterError(firstApiError(err, 'Could not confirm attendance.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 260 }}
        >
          {mySections.length === 0 && (
            <MenuItem value="">You don't have Period 1 for any section on this date, and aren't a Class Teacher</MenuItem>
          )}
          {mySections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {classById[s.school_class]?.name ?? '—'} - {s.name}
              {s.stream ? ` (${s.stream})` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      {rosterError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {rosterError}
        </Alert>
      )}

      {sectionId && !roster && !rosterError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {roster && (
        <Paper variant="outlined">
          {roster.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No students in this section.
            </Typography>
          ) : (
            <>
              {uiLocked && (
                <Alert severity="success" sx={{ m: 2 }}>
                  {isOutsideSchoolHours(date)
                    ? "Today's 9:00 AM-5:00 PM attendance window has closed, so this is locked for the day."
                    : 'Attendance for this day has been confirmed and can no longer be changed.'}
                </Alert>
              )}
              {!uiLocked && isDuringLastPeriod(date) && (
                <Alert severity="info" sx={{ m: 2 }}>
                  It's the last period of the day — confirm today's attendance now so it locks in properly.
                  Otherwise it will lock automatically at 5:00 PM.
                </Alert>
              )}
              <Stack direction="row" spacing={1} sx={{ p: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1, pr: 1 }}
                >
                  <Checkbox
                    size="small"
                    sx={{ p: 0.5 }}
                    checked={allPresent}
                    disabled={uiLocked}
                    onChange={() => handleMarkAll('PRESENT')}
                  />
                  <Typography variant="body2">All Present</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%' }}>
                  Check a student to mark them Present. Anyone left unchecked shows as Absent.
                </Typography>
              </Stack>
              {pageCount > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1 }}>
                  Page {page + 1} of {pageCount} ({roster.length} students in this class)
                </Typography>
              )}
              <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '2px 8px', fontSize: '0.8125rem' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="center">Present?</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRoster.map((s) => {
                      const isPresent = (statuses[s.id] ?? 'ABSENT') === 'PRESENT';
                      return (
                        <TableRow key={s.id} hover>
                          <TableCell>{s.student_id}</TableCell>
                          <TableCell>
                            {s.first_name} {s.last_name}
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              size="small"
                              sx={{ p: 0.5 }}
                              checked={isPresent}
                              disabled={uiLocked}
                              onChange={(e) => handleCheckboxToggle(s.id, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {isPresent ? (
                              <Chip size="small" color="success" label="Present" />
                            ) : (
                              <Chip size="small" color="error" label="Absent" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', p: 2 }}>
                {page > 0 && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setPage((p) => p - 1);
                      setIsSaved(false);
                    }}
                  >
                    Previous
                  </Button>
                )}
                {!uiLocked && (
                  <Button variant="contained" onClick={handleSave} disabled={saving || isSaved}>
                    {saving ? 'Saving…' : isSaved ? 'Saved' : 'Save Attendance'}
                  </Button>
                )}
                {!uiLocked && isSaved && hasNextPage && (
                  <Button
                    variant="contained"
                    onClick={() => {
                      setPage((p) => p + 1);
                      setIsSaved(false);
                    }}
                  >
                    Next
                  </Button>
                )}
                {!uiLocked && isSaved && !hasNextPage && (
                  <Button variant="contained" color="success" onClick={handleConfirm} disabled={saving}>
                    {saving ? 'Confirming…' : 'Confirm Attendance'}
                  </Button>
                )}
              </Stack>
            </>
          )}
        </Paper>
      )}
      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

// ---------- Enter Marks ----------

function EnterMarksTab({
  exams,
  subjects,
  subjectMarksConfigs,
  mySections,
  mySlots,
}: {
  exams: Exam[];
  subjects: Subject[];
  subjectMarksConfigs: SubjectMarksConfig[];
  mySections: Section[];
  mySlots: TimetableSlot[];
}) {
  const [examId, setExamId] = useState<number | ''>('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [marksByStudent, setMarksByStudent] = useState<
    Record<number, { theory_marks: string; internal_marks: string; grade: string; is_published: boolean }>
  >({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const selectedExam = exams.find((e) => e.id === examId) ?? null;

  // Only classes/sections this teacher actually has a timetable slot in.
  const examClassSections = useMemo(
    () => (selectedExam ? mySections.filter((s) => s.school_class === selectedExam.school_class) : []),
    [mySections, selectedExam],
  );

  const availableSubjects = useMemo(() => {
    if (!selectedExam) return [];
    const ids = new Set<number>();
    examClassSections.forEach((sec) => {
      mySlots.forEach((slot) => {
        if (slot.section === sec.id) ids.add(slot.subject);
      });
    });
    return subjects.filter((s) => ids.has(s.id));
  }, [examClassSections, mySlots, subjects, selectedExam]);

  // Only the specific sections where this teacher teaches the selected subject.
  const rosterSections = useMemo(() => {
    if (!subjectId) return [];
    return examClassSections.filter((sec) =>
      mySlots.some((slot) => slot.section === sec.id && slot.subject === subjectId),
    );
  }, [examClassSections, subjectId, mySlots]);

  const marksConfig = useMemo(
    () => subjectMarksConfigs.find((c) => c.subject === subjectId && c.school_class === selectedExam?.school_class),
    [subjectMarksConfigs, subjectId, selectedExam],
  );

  useEffect(() => {
    if (!selectedExam || !subjectId || rosterSections.length === 0) {
      setRoster(null);
      return;
    }
    setRoster(null);
    setRosterError(null);
    Promise.all([
      Promise.all(rosterSections.map((s) => fetchStudentsBySection(s.id))),
      fetchMarksEntries(selectedExam.id, subjectId),
    ])
      .then(([studentLists, entries]) => {
        const students = studentLists.flat();
        setRoster(students);
        const byStudent: Record<
          number,
          { theory_marks: string; internal_marks: string; grade: string; is_published: boolean }
        > = {};
        students.forEach((s) => {
          byStudent[s.id] = { theory_marks: '', internal_marks: '', grade: '', is_published: false };
        });
        entries.forEach((entry: MarksEntry) => {
          byStudent[entry.student] = {
            theory_marks: entry.theory_marks ?? '',
            internal_marks: entry.internal_marks ?? '',
            grade: entry.grade ?? '',
            is_published: entry.is_published,
          };
        });
        setMarksByStudent(byStudent);
      })
      .catch(() => setRosterError('Could not load the roster or existing marks for this exam/subject.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam, subjectId, rosterSections.length]);

  const handleFieldChange = (studentId: number, field: 'theory_marks' | 'internal_marks' | 'grade', value: string) => {
    setMarksByStudent((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleSave = async () => {
    if (!roster || !selectedExam || !subjectId) return;
    setSaving(true);
    setRosterError(null);
    try {
      const entries = roster.map((s) => {
        const m = marksByStudent[s.id];
        return {
          student: s.id,
          theory_marks: m?.theory_marks ? Number(m.theory_marks) : null,
          internal_marks: m?.internal_marks ? Number(m.internal_marks) : null,
          grade: m?.grade ?? '',
        };
      });
      await bulkSaveMarks(selectedExam.id, subjectId, entries);
      setSnackbar(`Marks saved for ${roster.length} student(s).`);
    } catch (err) {
      setRosterError(firstApiError(err, 'Could not save marks.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedExam || !subjectId) return;
    setPublishing(true);
    setRosterError(null);
    try {
      const result = await publishMarks(selectedExam.id, subjectId);
      setSnackbar(`Published ${result.updated} marks entries.`);
      setMarksByStudent((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[Number(k)] = { ...next[Number(k)], is_published: true };
        });
        return next;
      });
    } catch (err) {
      setRosterError(firstApiError(err, 'Could not publish marks.'));
    } finally {
      setPublishing(false);
    }
  };

  const allPublished = roster && roster.length > 0 && roster.every((s) => marksByStudent[s.id]?.is_published);

  if (mySections.length === 0) {
    return <Alert severity="info">You have no sections assigned on the timetable yet.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label="Exam"
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value ? Number(e.target.value) : '');
            setSubjectId('');
          }}
          sx={{ minWidth: 260 }}
        >
          {exams.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name} - {e.school_class_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 200 }}
          disabled={!examId}
        >
          {availableSubjects.length === 0 && <MenuItem value="">No subjects you teach for this exam</MenuItem>}
          {availableSubjects.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {rosterError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {rosterError}
        </Alert>
      )}

      {examId && subjectId && !roster && !rosterError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {roster && (
        <Paper variant="outlined">
          {roster.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No students in this class.
            </Typography>
          ) : (
            <>
              {allPublished && (
                <Alert severity="success" sx={{ m: 2 }}>
                  All marks for this exam/subject are published.
                </Alert>
              )}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell sx={{ width: 140 }}>
                        Theory {marksConfig ? `(/${marksConfig.max_theory})` : ''}
                      </TableCell>
                      <TableCell sx={{ width: 140 }}>
                        Internal {marksConfig ? `(/${marksConfig.max_internal})` : ''}
                      </TableCell>
                      <TableCell sx={{ width: 100 }}>Grade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roster.map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell>{s.student_id}</TableCell>
                        <TableCell>
                          {s.first_name} {s.last_name}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={marksByStudent[s.id]?.theory_marks ?? ''}
                            onChange={(e) => handleFieldChange(s.id, 'theory_marks', e.target.value)}
                            disabled={marksByStudent[s.id]?.is_published}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={marksByStudent[s.id]?.internal_marks ?? ''}
                            onChange={(e) => handleFieldChange(s.id, 'internal_marks', e.target.value)}
                            disabled={marksByStudent[s.id]?.is_published}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={marksByStudent[s.id]?.grade ?? ''}
                            onChange={(e) => handleFieldChange(s.id, 'grade', e.target.value)}
                            disabled={marksByStudent[s.id]?.is_published}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', p: 2 }}>
                <Button variant="outlined" onClick={handlePublish} disabled={publishing || !!allPublished}>
                  {publishing ? 'Publishing…' : 'Publish'}
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || !!allPublished}>
                  {saving ? 'Saving…' : 'Save Marks'}
                </Button>
              </Stack>
            </>
          )}
        </Paper>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}
