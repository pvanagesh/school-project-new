import { useEffect, useState, type SyntheticEvent } from 'react';
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
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import HistoryEduIcon from '@mui/icons-material/HistoryEduOutlined';
import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
import { fetchTimetableByTeacher } from '../api/academics';
import { PageHeader } from '../components/PageHeader';
import { createPastAttendanceGrant, fetchPastAttendanceGrants } from '../api/attendance';
import { createTeacher, deleteTeacher, fetchTeachers, updateTeacher } from '../api/teachers';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { BOARD_LABELS, DIVISION_GROUP_LABELS, DIVISION_SCOPED_ROLES, type BoardValue, type DivisionGroupValue, type PastAttendanceEditGrant, type Teacher, type TeacherFormValues } from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const GRANTS_PER_WINDOW = 2;
const GRANT_WINDOW_DAYS = 182;

const EMPTY_FORM: TeacherFormValues = {
  teacher_id: '',
  first_name: '',
  last_name: '',
  qualification: '',
  experience_years: 0,
  subject_specialization: '',
  contact: '',
  joining_date: '',
  username: '',
  password: '',
  email: '',
};

export function TeachersPage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();
  const canManageGrants = user?.role_name === 'SUPER_ADMIN' || user?.role_name === 'PRINCIPAL';

  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Deleting a Teacher cascades to delete every Timetable slot they have —
  // silently, with no DB-level protection — so the confirm dialog needs to
  // show that impact up front rather than let it be a surprise.
  const [deleteSlotCount, setDeleteSlotCount] = useState<number | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [grantTeacher, setGrantTeacher] = useState<Teacher | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Two levels of tabs, matching the school's 4 divisions: Board (CBSE/SSC)
  // on top, School-wise (junior, 1-10) vs College-wise (senior, 11-12)
  // underneath. A division-scoped account (Principal/Teacher/Class Teacher/
  // Accountant) only ever gets their own division's teachers back from the
  // API regardless of which tab is picked, so for them these are pinned to
  // their assigned division and disabled — same lock used on Classes &
  // Sections and Subjects — rather than letting them switch to a tab that
  // always comes back empty. Super Admin switches freely.
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  // School Profile is the one place that picks a division now — everyone's
  // tabs here just follow it: a division-scoped account to its own fixed
  // assignment, Super Admin to whichever division is currently active on
  // School Profile (see ActiveDivisionContext). Switching division only
  // happens on School Profile itself, so this stays locked either way.
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard && !!lockedGroup;

  const [boardTab, setBoardTab] = useState<BoardValue>(lockedBoard ?? 'CBSE');
  const [groupTab, setGroupTab] = useState<DivisionGroupValue>(lockedGroup ?? 'JUNIOR');

  useEffect(() => {
    if (lockedBoard) setBoardTab(lockedBoard);
    if (lockedGroup) setGroupTab(lockedGroup);
  }, [lockedBoard, lockedGroup]);

  const loadAll = () => {
    fetchTeachers()
      .then(setTeachers)
      .catch(() => setError('Could not load teachers from the API.'));
  };

  useEffect(loadAll, []);

  const openCreateDialog = () => {
    setEditingTeacher(null);
    setDialogOpen(true);
  };

  const openEditDialog = (t: Teacher) => {
    setEditingTeacher(t);
    setDialogOpen(true);
  };

  const handleSaved = (message: string) => {
    setDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openDeleteDialog = (t: Teacher) => {
    setDeleteError(null);
    setDeleteTarget(t);
    setDeleteConfirmText('');
    setDeleteSlotCount(null);
    fetchTimetableByTeacher(t.id)
      .then((slots) => setDeleteSlotCount(slots.length))
      .catch(() => setDeleteSlotCount(null));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.teacher_id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTeacher(deleteTarget.id);
      setSnackbar(`Deleted ${deleteTarget.first_name} ${deleteTarget.last_name}.`);
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this teacher.'));
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!teachers) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const visibleTeachers = teachers.filter(
    (t) => t.user_assigned_board === boardTab && t.user_assigned_group === groupTab,
  );
  const unassignedCount = teachers.filter((t) => !t.user_assigned_board || !t.user_assigned_group).length;

  // ToggleButtonGroup (exclusive) emits null if you click the already-
  // selected button — ignored, since exactly one of the two must stay
  // selected at all times.
  const handleBoardTabChange = (_e: SyntheticEvent, value: BoardValue | null) => {
    if (value) {
      setBoardTab(value);
      setPage(0);
    }
  };
  const handleGroupTabChange = (_e: SyntheticEvent, value: DivisionGroupValue | null) => {
    if (value) {
      setGroupTab(value);
      setPage(0);
    }
  };

  return (
    <Box>
      <PageHeader icon={CastForEducationIcon} title="Teachers" />

      <Paper variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, p: 2, pb: 1.5 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <ToggleButtonGroup
              value={boardTab}
              exclusive
              onChange={handleBoardTabChange}
              size="small"
              color="primary"
            >
              <ToggleButton value="CBSE" disabled={divisionLocked && lockedBoard !== 'CBSE'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                CBSE Employees
              </ToggleButton>
              <ToggleButton value="SSC" disabled={divisionLocked && lockedBoard !== 'SSC'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                SSC Employees
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={groupTab}
              exclusive
              onChange={handleGroupTabChange}
              size="small"
              color="primary"
            >
              <ToggleButton value="JUNIOR" disabled={divisionLocked && lockedGroup !== 'JUNIOR'} sx={{ textTransform: 'none', px: 2 }}>
                School
              </ToggleButton>
              <ToggleButton value="SENIOR" disabled={divisionLocked && lockedGroup !== 'SENIOR'} sx={{ textTransform: 'none', px: 2 }}>
                College
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Teacher
          </Button>
        </Stack>
        {!divisionLocked && unassignedCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', mb: 1 }}>
            {unassignedCount} teacher{unassignedCount === 1 ? '' : 's'} not shown here — no division assigned yet
            (Users & Roles)
          </Typography>
        )}
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Teacher ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Specialization</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell align="right">Experience</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleTeachers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.teacher_id}</TableCell>
                  <TableCell>
                    {t.first_name} {t.last_name}
                  </TableCell>
                  <TableCell>{t.user_username}</TableCell>
                  <TableCell>{t.subject_specialization}</TableCell>
                  <TableCell>{t.contact}</TableCell>
                  <TableCell align="right">{t.experience_years} yr</TableCell>
                  <TableCell>{t.joining_date}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      {canManageGrants && (
                        <IconButton size="small" title="Past-attendance edit permission" onClick={() => setGrantTeacher(t)}>
                          <HistoryEduIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small" title="Edit" onClick={() => openEditDialog(t)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Delete"
                        sx={{ ml: 1 }}
                        onClick={() => openDeleteDialog(t)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {visibleTeachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No teachers here yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={visibleTeachers.length}
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

      <TeacherFormDialog
        open={dialogOpen}
        teacher={editingTeacher}
        defaultBoard={boardTab}
        defaultGroup={groupTab}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <PastAttendanceGrantDialog teacher={grantTeacher} onClose={() => setGrantTeacher(null)} />

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete teacher?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography sx={{ mb: 2 }}>
            This permanently deletes <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong>'s teacher
            profile. Their login account is not deleted. This cannot be undone.
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {deleteSlotCount === null ? (
              'Checking their timetable…'
            ) : deleteSlotCount > 0 ? (
              <>
                This also permanently deletes all <strong>{deleteSlotCount}</strong> of their timetable slot(s). If
                they're a Class Teacher, that section loses its Class Teacher too.
              </>
            ) : (
              "They have no timetable slots, so nothing else is affected."
            )}
          </Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>{deleteTarget?.teacher_id}</strong> to confirm.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={deleteTarget?.teacher_id}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleting || deleteConfirmText !== deleteTarget?.teacher_id}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

function TeacherFormDialog({
  open,
  teacher,
  defaultBoard,
  defaultGroup,
  onClose,
  onSaved,
}: {
  open: boolean;
  teacher: Teacher | null;
  defaultBoard: BoardValue;
  defaultGroup: DivisionGroupValue;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<TeacherFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!teacher;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      teacher
        ? {
            teacher_id: teacher.teacher_id,
            first_name: teacher.first_name,
            last_name: teacher.last_name,
            qualification: teacher.qualification,
            experience_years: teacher.experience_years,
            subject_specialization: teacher.subject_specialization,
            contact: teacher.contact,
            joining_date: teacher.joining_date,
          }
        : { ...EMPTY_FORM, assigned_board: defaultBoard, assigned_group: defaultGroup },
    );
    // Only pin the division from the active tab when the dialog opens for a
    // fresh "Add Teacher" — an edit shouldn't silently move someone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacher]);

  const handleChange = <K extends keyof TeacherFormValues>(field: K, value: TeacherFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        const { username: _username, password: _password, email: _email, ...rest } = values;
        await updateTeacher(teacher.id, rest);
        onSaved(`Updated ${values.first_name} ${values.last_name}.`);
      } else {
        await createTeacher(values);
        onSaved(`Created ${values.first_name} ${values.last_name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save teacher.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    values.teacher_id &&
    values.first_name &&
    values.last_name &&
    values.joining_date &&
    (isEditing || (values.username && values.password));

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${teacher.first_name} ${teacher.last_name}` : 'Add Teacher'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Teacher ID"
            value={values.teacher_id}
            onChange={(e) => handleChange('teacher_id', e.target.value)}
            placeholder="e.g. EMP013"
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

          {!isEditing && (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2">Login Account</Typography>
                <Tooltip title="Set by the Board / School-College tabs selected on the Teachers page">
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`Adding to: ${BOARD_LABELS[values.assigned_board ?? defaultBoard]} · ${DIVISION_GROUP_LABELS[values.assigned_group ?? defaultGroup]}`}
                  />
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Username"
                  value={values.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  value={values.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  fullWidth
                />
              </Stack>
              <TextField
                label="Email"
                type="email"
                value={values.email}
                onChange={(e) => handleChange('email', e.target.value)}
                fullWidth
              />
            </>
          )}

          <Typography variant="subtitle2">Profile</Typography>
          <TextField
            label="Qualification"
            value={values.qualification}
            onChange={(e) => handleChange('qualification', e.target.value)}
            placeholder="e.g. B.Ed, M.A. English"
            fullWidth
          />
          <TextField
            label="Subject Specialization"
            value={values.subject_specialization}
            onChange={(e) => handleChange('subject_specialization', e.target.value)}
            placeholder="e.g. English"
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Experience (years)"
              type="number"
              value={values.experience_years}
              onChange={(e) => handleChange('experience_years', Number(e.target.value))}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              label="Contact"
              value={values.contact}
              onChange={(e) => handleChange('contact', e.target.value)}
              fullWidth
            />
          </Stack>
          <TextField
            label="Joining Date"
            type="date"
            value={values.joining_date}
            onChange={(e) => handleChange('joining_date', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
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

function PastAttendanceGrantDialog({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const [grants, setGrants] = useState<PastAttendanceEditGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const load = () => {
    if (!teacher) return;
    setGrants(null);
    setError(null);
    fetchPastAttendanceGrants(teacher.id)
      .then(setGrants)
      .catch(() => setError('Could not load grant history.'));
  };

  useEffect(load, [teacher?.id]);

  if (!teacher) return null;

  const windowStart = Date.now() - GRANT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const usedInWindow = grants?.filter((g) => new Date(g.granted_at).getTime() >= windowStart).length ?? 0;
  const remaining = GRANTS_PER_WINDOW - usedInWindow;

  const handleGrant = async () => {
    setGranting(true);
    setError(null);
    try {
      await createPastAttendanceGrant(teacher.id);
      load();
    } catch (err) {
      setError(firstApiError(err, 'Could not grant permission.'));
    } finally {
      setGranting(false);
    }
  };

  return (
    <Dialog open={!!teacher} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>
        Past-Attendance Edit Permission — {teacher.first_name} {teacher.last_name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            By default this teacher can only mark or edit <strong>today's</strong> attendance. Granting a permission
            here lets them fix <strong>one</strong> past date, one time — it's used up automatically the moment they
            save a past-date edit. Limited to {GRANTS_PER_WINDOW} grants per teacher every 6 months.
          </Typography>

          {!grants ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <Chip
                label={`${usedInWindow} / ${GRANTS_PER_WINDOW} granted in the last 6 months`}
                color={remaining > 0 ? 'default' : 'warning'}
              />
              {grants.length === 0 && (
                <Typography color="text.secondary">No grants issued yet.</Typography>
              )}
              {grants.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Granted</TableCell>
                      <TableCell>By</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grants.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{new Date(g.granted_at).toLocaleDateString()}</TableCell>
                        <TableCell>{g.granted_by_username ?? '—'}</TableCell>
                        <TableCell>
                          {g.used_at ? (
                            <Chip size="small" label={`Used for ${g.used_for_date}`} />
                          ) : (
                            <Chip size="small" color="success" label="Unused" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleGrant} disabled={granting || !grants || remaining <= 0}>
          {granting ? 'Granting…' : 'Grant One Permission'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
