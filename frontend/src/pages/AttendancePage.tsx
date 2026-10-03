import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Chip,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import { bulkMarkAttendance, confirmAttendanceDay, fetchAttendance } from '../api/attendance';
import { fetchClasses, fetchMyTimetable, fetchSections } from '../api/academics';
import { fetchStudentsBySection } from '../api/students';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { PageHeader } from '../components/PageHeader';
import {
  DIVISION_SCOPED_ROLES,
  levelHasStreams,
  type AttendanceRecord,
  type AttendanceStatusValue,
  type BoardValue,
  type DivisionGroupValue,
  type SchoolClass,
  type Section,
  type Student,
  type TimetableSlot,
} from '../types';
import { dayCodeForDateString } from '../utils/dayOfWeek';
import { firstApiError } from '../utils/apiError';
import { isDuringLastPeriod, isOutsideSchoolHours } from '../utils/schoolHours';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TEACHER_ROLES = ['TEACHER', 'CLASS_TEACHER'];
const ATTENDANCE_PAGE_SIZE = 10;

export function AttendancePage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Same Board (CBSE/SSC) x Classes-1-10/11-12 division split as Students —
  // locked the same way for a division-scoped account (Principal/Teacher/
  // Class Teacher/Accountant), following School Profile's active division
  // for everyone else.
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard && !!lockedGroup;

  const [boardTab, setBoardTab] = useState<BoardValue>(lockedBoard ?? 'CBSE');
  const [groupTab, setGroupTab] = useState<DivisionGroupValue>(lockedGroup ?? 'JUNIOR');

  useEffect(() => {
    if (lockedBoard) setBoardTab(lockedBoard);
    if (lockedGroup) setGroupTab(lockedGroup);
  }, [lockedBoard, lockedGroup]);

  const [sectionId, setSectionId] = useState<number | ''>('');
  const [date, setDate] = useState(todayIso());

  const [roster, setRoster] = useState<Student[] | null>(null);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatusValue>>({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [page, setPage] = useState(0);
  const [locked, setLocked] = useState(false);
  const [mySlots, setMySlots] = useState<TimetableSlot[] | null>(null);

  useEffect(() => {
    Promise.all([fetchClasses(), fetchSections()])
      .then(([c, s]) => {
        setClasses(c);
        setSections(s);
      })
      .catch(() => setError('Could not load classes/sections from the API.'));
  }, []);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes?.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const isTeacherRole = !!user?.role_name && TEACHER_ROLES.includes(user.role_name);

  // Only teachers need their timetable — Admin/Principal see every section
  // regardless, so there's no point fetching it for them.
  useEffect(() => {
    if (!isTeacherRole) {
      setMySlots([]);
      return;
    }
    fetchMyTimetable()
      .then(setMySlots)
      .catch(() => setError('Could not load your timetable from the API.'));
  }, [isTeacherRole]);

  const dayCode = useMemo(() => dayCodeForDateString(date), [date]);

  // A teacher may mark a section's daily attendance if she's its Class
  // Teacher, or — per the timetable — has that section's Period 1 on this
  // date's weekday: whichever teacher takes first period takes attendance,
  // Class Teacher or not. Admin/Principal keep full access to every section.
  const visibleSections = useMemo(() => {
    if (!sections) return [];
    const inDivision = sections.filter((s) => {
      const cls = classById[s.school_class];
      return cls ? cls.board === boardTab && levelHasStreams(cls.level) === (groupTab === 'SENIOR') : true;
    });
    if (!isTeacherRole) return inDivision;
    if (!mySlots) return [];
    const period1SectionIds = new Set(
      mySlots.filter((slot) => slot.period === 1 && slot.day_of_week === dayCode).map((slot) => slot.section),
    );
    return inDivision.filter((s) => s.class_teacher === user?.teacher_id || period1SectionIds.has(s.id));
  }, [sections, classById, boardTab, groupTab, isTeacherRole, mySlots, dayCode, user]);

  // ToggleButtonGroup (exclusive) emits null if you click the already-
  // selected button — ignored, since exactly one of the two must stay
  // selected at all times.
  const handleBoardTabChange = (_e: SyntheticEvent, value: BoardValue | null) => {
    if (value) setBoardTab(value);
  };
  const handleGroupTabChange = (_e: SyntheticEvent, value: DivisionGroupValue | null) => {
    if (value) setGroupTab(value);
  };

  // The date (and so the eligible-sections list) can change out from under
  // an already-selected section — drop it back to the picker rather than
  // leaving a now-ineligible section selected.
  useEffect(() => {
    if (sectionId && !visibleSections.some((s) => s.id === sectionId)) {
      setSectionId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSections]);

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

  // Admin/Principal can still override a locked day (same as they bypass the
  // past-edit-grant system) — only Teacher/Class Teacher are actually shut out.
  const uiLocked = locked && isTeacherRole;

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
  // Teacher/Class Teacher (including whoever confirmed it) can change it
  // again today.
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

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !sections || (isTeacherRole && !mySlots)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={FactCheckIcon} title="Attendance" />

      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }} spacing={1}>
        <ToggleButtonGroup value={boardTab} exclusive onChange={handleBoardTabChange} size="small" color="primary">
          <ToggleButton value="CBSE" disabled={divisionLocked && lockedBoard !== 'CBSE'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
            CBSE
          </ToggleButton>
          <ToggleButton value="SSC" disabled={divisionLocked && lockedBoard !== 'SSC'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
            SSC (State Board)
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup value={groupTab} exclusive onChange={handleGroupTabChange} size="small" color="primary">
          <ToggleButton value="JUNIOR" disabled={divisionLocked && lockedGroup !== 'JUNIOR'} sx={{ textTransform: 'none', px: 2 }}>
            Classes 1 – 10
          </ToggleButton>
          <ToggleButton value="SENIOR" disabled={divisionLocked && lockedGroup !== 'SENIOR'} sx={{ textTransform: 'none', px: 2 }}>
            11th & 12th
          </ToggleButton>
        </ToggleButtonGroup>
        {divisionLocked && (
          <Tooltip
            title={
              isDivisionScopedRole
                ? 'Your account is assigned to one division. Ask your Super Admin to change it on the Users & Roles page.'
                : "Following the division selected on School Profile — change it there."
            }
          >
            <Chip
              size="small"
              variant="outlined"
              label={isDivisionScopedRole ? 'Locked to your division' : "Locked to School Profile's division"}
            />
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 260 }}
        >
          {visibleSections.length === 0 && (
            <MenuItem value="">
              {isTeacherRole
                ? "You don't have Period 1 today for any section, and aren't a Class Teacher"
                : 'No sections yet'}
            </MenuItem>
          )}
          {visibleSections.map((s) => (
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
              {!uiLocked && isTeacherRole && isDuringLastPeriod(date) && (
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
                  Page {page + 1} of {pageCount} ({roster.length} students in this section)
                </Typography>
              )}
              <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '2px 8px', fontSize: '0.8125rem' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Roll No</TableCell>
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
                          <TableCell>{s.roll_number || '—'}</TableCell>
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
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', p: 1 }}>
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
