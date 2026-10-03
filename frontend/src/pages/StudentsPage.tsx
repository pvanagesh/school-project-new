import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  TablePagination,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { fetchClasses, fetchSections } from '../api/academics';
import { createStudent, deleteStudent, fetchStudents, updateStudent } from '../api/students';
import { PageHeader } from '../components/PageHeader';
import {
  combinationsByStream,
  COMBINATION_LABELS,
  DIVISION_SCOPED_ROLES,
  GENDER_OPTIONS,
  STREAM_LABELS,
  STUDENT_STATUS_LABELS,
  levelHasStreams,
  type BoardValue,
  type CombinationValue,
  type DivisionGroupValue,
  type SchoolClass,
  type Section,
  type Student,
  type StudentFormValues,
  type StudentStatusValue,
  type StreamValue,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_FORM: StudentFormValues = {
  student_id: '',
  first_name: '',
  last_name: '',
  dob: '',
  gender: '',
  admission_date: '',
  current_class: null,
  current_section: null,
  stream: null,
  combination: null,
  parent_name: '',
  parent_contact: '',
  address: '',
  medical_info: '',
  previous_school: '',
  status: 'ACTIVE',
};

export function StudentsPage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();

  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Same Board (CBSE/SSC) x Classes-1-10/11-12 division split as Teachers —
  // every student belongs to exactly one class, so its board+level decide
  // which division it's in. A division-scoped account (Principal/Teacher/
  // Class Teacher/Accountant) only ever gets their own division's students
  // back from the API regardless of these toggles, so for them these are
  // pinned to their assigned division and disabled; Super Admin follows
  // whichever division is currently active on School Profile.
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

  const [classFilter, setClassFilter] = useState<number | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([fetchClasses(), fetchSections()])
      .then(([c, s]) => {
        setClasses(c);
        setSections(s);
      })
      .catch(() => setError('Could not load classes/sections from the API.'));
  }, []);

  const loadStudents = () => {
    fetchStudents(classFilter || undefined)
      .then(setStudents)
      .catch(() => setError('Could not load students from the API.'));
  };

  useEffect(() => {
    setPage(0);
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter]);

  const openCreateDialog = () => {
    setEditingStudent(null);
    setDialogOpen(true);
  };

  const openEditDialog = (s: Student) => {
    setEditingStudent(s);
    setDialogOpen(true);
  };

  const handleSaved = (message: string) => {
    setDialogOpen(false);
    setSnackbar(message);
    loadStudents();
  };

  const openDeleteDialog = (s: Student) => {
    setDeleteError(null);
    setDeleteTarget(s);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStudent(deleteTarget.id);
      setSnackbar(`Deleted ${deleteTarget.first_name} ${deleteTarget.last_name}.`);
      setDeleteTarget(null);
      loadStudents();
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this student.'));
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !sections || !students) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const classesInDivision = classes.filter(
    (c) => c.board === boardTab && levelHasStreams(c.level) === (groupTab === 'SENIOR'),
  );
  const classById = new Map(classes.map((c) => [c.id, c]));
  const visibleStudents = students.filter((s) => {
    const cls = classById.get(s.current_class);
    return cls ? cls.board === boardTab && levelHasStreams(cls.level) === (groupTab === 'SENIOR') : true;
  });

  // ToggleButtonGroup (exclusive) emits null if you click the already-
  // selected button — ignored, since exactly one of the two must stay
  // selected at all times.
  const handleBoardTabChange = (_e: SyntheticEvent, value: BoardValue | null) => {
    if (value) {
      setBoardTab(value);
      setClassFilter('');
      setPage(0);
    }
  };
  const handleGroupTabChange = (_e: SyntheticEvent, value: DivisionGroupValue | null) => {
    if (value) {
      setGroupTab(value);
      setClassFilter('');
      setPage(0);
    }
  };

  return (
    <Box>
      <PageHeader icon={PersonIcon} title="Students" />

      <Paper variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, p: 2, pb: 1.5 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
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
            <TextField
              select
              label="Filter by class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : '')}
              sx={{ minWidth: 220 }}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">All classes</MenuItem>
              {classesInDivision.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Student
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Student ID</TableCell>
                <TableCell>Roll No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class / Section</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleStudents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.student_id}</TableCell>
                  <TableCell>{s.roll_number || '—'}</TableCell>
                  <TableCell>
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell>
                    {s.current_class_name} - {s.current_section_name}
                    {s.combination ? ` (${COMBINATION_LABELS[s.combination]})` : s.stream ? ` (${STREAM_LABELS[s.stream]})` : ''}
                  </TableCell>
                  <TableCell>{s.parent_name}</TableCell>
                  <TableCell>{s.parent_contact}</TableCell>
                  <TableCell>{STUDENT_STATUS_LABELS[s.status]}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEditDialog(s)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openDeleteDialog(s)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {visibleStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No students here yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={visibleStudents.length}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <StudentFormDialog
        open={dialogOpen}
        student={editingStudent}
        classes={classesInDivision}
        sections={sections}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete student?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong>'s student
            record. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

function StudentFormDialog({
  open,
  student,
  classes,
  sections,
  onClose,
  onSaved,
}: {
  open: boolean;
  student: Student | null;
  classes: SchoolClass[];
  sections: Section[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<StudentFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!student;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      student
        ? {
            student_id: student.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            dob: student.dob,
            gender: student.gender,
            admission_date: student.admission_date,
            current_class: student.current_class,
            current_section: student.current_section,
            stream: student.stream,
            combination: student.combination,
            parent_name: student.parent_name,
            parent_contact: student.parent_contact,
            address: student.address,
            medical_info: student.medical_info,
            previous_school: student.previous_school,
            status: student.status,
          }
        : EMPTY_FORM,
    );
  }, [open, student]);

  const selectedClass = classes.find((c) => c.id === values.current_class) ?? null;
  const needsStream = !!selectedClass && levelHasStreams(selectedClass.level);
  const sectionsForClass = useMemo(
    () =>
      sections.filter(
        (s) => s.school_class === values.current_class && (!needsStream || !values.stream || s.stream === values.stream),
      ),
    [sections, values.current_class, needsStream, values.stream],
  );

  const handleChange = <K extends keyof StudentFormValues>(field: K, value: StudentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleClassChange = (classId: number) => {
    const cls = classes.find((c) => c.id === classId) ?? null;
    setValues((prev) => ({
      ...prev,
      current_class: classId,
      current_section: null,
      stream: cls && levelHasStreams(cls.level) ? prev.stream : null,
      combination: cls && levelHasStreams(cls.level) ? prev.combination : null,
    }));
  };

  const handleStreamChange = (stream: StreamValue) => {
    setValues((prev) => ({ ...prev, stream, combination: null, current_section: null }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateStudent(student.id, values);
        onSaved(`Updated ${values.first_name} ${values.last_name}.`);
      } else {
        await createStudent(values);
        onSaved(`Created ${values.first_name} ${values.last_name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save student.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    values.student_id &&
    values.first_name &&
    values.last_name &&
    values.dob &&
    values.gender &&
    values.admission_date &&
    values.current_class &&
    values.current_section &&
    values.parent_name &&
    values.parent_contact &&
    values.address &&
    (!needsStream || values.stream);

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${student.first_name} ${student.last_name}` : 'Add Student'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Student ID"
            value={values.student_id}
            onChange={(e) => handleChange('student_id', e.target.value)}
            placeholder="e.g. STU0001"
            required
            disabled={isEditing}
            fullWidth
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="First name"
              value={values.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Last name"
              value={values.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              required
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Date of birth"
              type="date"
              value={values.dob}
              onChange={(e) => handleChange('dob', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              select
              label="Gender"
              value={values.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              required
              fullWidth
            >
              {GENDER_OPTIONS.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Typography variant="subtitle2">Class &amp; Section</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Class"
              value={values.current_class ?? ''}
              onChange={(e) => handleClassChange(Number(e.target.value))}
              required
              fullWidth
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Section"
              value={values.current_section ?? ''}
              onChange={(e) => handleChange('current_section', Number(e.target.value))}
              required
              fullWidth
              disabled={!values.current_class}
            >
              {sectionsForClass.map((s) => {
                const suffix = s.combination ? COMBINATION_LABELS[s.combination] : s.stream ? STREAM_LABELS[s.stream] : null;
                return (
                  <MenuItem key={s.id} value={s.id}>
                    {suffix ? `${s.name} (${suffix})` : s.name}
                  </MenuItem>
                );
              })}
            </TextField>
          </Stack>

          {needsStream && (
            <TextField
              select
              label="Stream"
              value={values.stream ?? ''}
              onChange={(e) => handleStreamChange(e.target.value as StreamValue)}
              required
              fullWidth
              helperText="Required for Class 11 and 12 students."
            >
              {(Object.keys(STREAM_LABELS) as StreamValue[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {STREAM_LABELS[s]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsStream && values.stream && combinationsByStream(selectedClass?.board ?? 'CBSE')[values.stream].length > 0 && (
            <TextField
              select
              label="Combination"
              value={values.combination ?? ''}
              onChange={(e) => handleChange('combination', (e.target.value || null) as CombinationValue | null)}
              fullWidth
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {combinationsByStream(selectedClass?.board ?? 'CBSE')[values.stream].map((c) => (
                <MenuItem key={c} value={c}>
                  {COMBINATION_LABELS[c]}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Typography variant="subtitle2">Admission &amp; Status</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Admission date"
              type="date"
              value={values.admission_date}
              onChange={(e) => handleChange('admission_date', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={values.status}
              onChange={(e) => handleChange('status', e.target.value as StudentStatusValue)}
              fullWidth
            >
              {(Object.keys(STUDENT_STATUS_LABELS) as StudentStatusValue[]).map((st) => (
                <MenuItem key={st} value={st}>
                  {STUDENT_STATUS_LABELS[st]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Previous school (optional)"
            value={values.previous_school}
            onChange={(e) => handleChange('previous_school', e.target.value)}
            fullWidth
          />

          <Typography variant="subtitle2">Parent / Guardian</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Parent / Guardian name"
              value={values.parent_name}
              onChange={(e) => handleChange('parent_name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Contact number"
              value={values.parent_contact}
              onChange={(e) => handleChange('parent_contact', e.target.value)}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Address"
            value={values.address}
            onChange={(e) => handleChange('address', e.target.value)}
            multiline
            minRows={2}
            required
            fullWidth
          />
          <TextField
            label="Medical info (optional)"
            value={values.medical_info}
            onChange={(e) => handleChange('medical_info', e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !isValid}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
