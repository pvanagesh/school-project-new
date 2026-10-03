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
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import { fetchTimetableByTeacher } from '../api/academics';
import { PageHeader } from '../components/PageHeader';
import {
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  fetchRoles,
  fetchUsers,
  updateRole,
  updateUser,
} from '../api/accounts';
import { fetchTeachers } from '../api/teachers';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import {
  BOARD_LABELS,
  DIVISION_GROUP_LABELS,
  DIVISION_SCOPED_ROLES,
  divisionLabel,
  roleLabel,
  type BoardValue,
  type DivisionGroupValue,
  type Role,
  type RoleFormValues,
  type Teacher,
  type User,
  type UserFormValues,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_USER_FORM: UserFormValues = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: null,
  is_active: true,
  password: '',
  assigned_board: null,
  assigned_group: null,
};

const EMPTY_ROLE_FORM: RoleFormValues = { name: '', description: '' };

export function UsersRolesPage() {
  const { user: currentUser } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDeleteTarget, setUserDeleteTarget] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  // Deleting a User whose account is linked to a Teacher profile cascades to
  // delete that Teacher (and, in turn, all of their timetable slots) — the
  // link is invisible in this table, so the confirm dialog needs to surface
  // it up front rather than let it be a silent surprise.
  const [userDeleteLinkedTeacher, setUserDeleteLinkedTeacher] = useState<Teacher | null | undefined>(undefined);
  const [userDeleteSlotCount, setUserDeleteSlotCount] = useState<number | null>(null);
  const [userDeleteConfirmText, setUserDeleteConfirmText] = useState('');

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleDeleteTarget, setRoleDeleteTarget] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState(false);
  const [roleDeleteError, setRoleDeleteError] = useState<string | null>(null);

  const [userPage, setUserPage] = useState(0);
  const [userRowsPerPage, setUserRowsPerPage] = useState(10);

  // Same two-level division split as the Teachers page: Board (CBSE/SSC) on
  // top, School-wise (1-10) vs College-wise (11-12) underneath. A
  // division-scoped account only ever manages its own division, so for them
  // this is pinned and disabled rather than switchable — same lock used on
  // Classes & Sections, Subjects, Teachers, and School Profile. Super Admin
  // switches freely between all 4.
  const isDivisionScopedRole = !!currentUser?.role_name && DIVISION_SCOPED_ROLES.includes(currentUser.role_name);
  // School Profile is the one place that picks a division now — everyone's
  // tabs here just follow it: a division-scoped account to its own fixed
  // assignment, Super Admin to whichever division is currently active on
  // School Profile (see ActiveDivisionContext). Switching division only
  // happens on School Profile itself, so this stays locked either way.
  const lockedBoard = isDivisionScopedRole ? currentUser?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? currentUser?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard && !!lockedGroup;

  const [boardTab, setBoardTab] = useState<BoardValue>(lockedBoard ?? 'CBSE');
  const [groupTab, setGroupTab] = useState<DivisionGroupValue>(lockedGroup ?? 'JUNIOR');

  useEffect(() => {
    if (lockedBoard) setBoardTab(lockedBoard);
    if (lockedGroup) setGroupTab(lockedGroup);
  }, [lockedBoard, lockedGroup]);

  const loadAll = () => {
    Promise.all([fetchUsers(), fetchRoles(), fetchTeachers()])
      .then(([u, r, t]) => {
        setUsers(u);
        setRoles(r);
        setTeachers(t);
      })
      .catch(() => setError('Could not load users/roles from the API.'));
  };

  useEffect(loadAll, []);

  const roleUserCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    users?.forEach((u) => {
      if (u.role != null) counts[u.role] = (counts[u.role] ?? 0) + 1;
    });
    return counts;
  }, [users]);

  const handleTabChange = (_e: SyntheticEvent, value: number) => setTab(value);

  const openCreateUserDialog = () => {
    setEditingUser(null);
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: User) => {
    setEditingUser(user);
    setUserDialogOpen(true);
  };

  const handleUserSaved = (message: string) => {
    setUserDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openUserDeleteDialog = (u: User) => {
    setUserDeleteTarget(u);
    setUserDeleteConfirmText('');
    setUserDeleteSlotCount(null);
    const linked = teachers?.find((t) => t.user === u.id) ?? null;
    setUserDeleteLinkedTeacher(linked);
    if (linked) {
      fetchTimetableByTeacher(linked.id)
        .then((slots) => setUserDeleteSlotCount(slots.length))
        .catch(() => setUserDeleteSlotCount(null));
    }
  };

  const handleUserDeleteConfirm = async () => {
    if (!userDeleteTarget || userDeleteConfirmText !== userDeleteTarget.username) return;
    setDeletingUser(true);
    try {
      await deleteUser(userDeleteTarget.id);
      setSnackbar(`Deleted ${userDeleteTarget.username}.`);
      setUserDeleteTarget(null);
      loadAll();
    } catch {
      setSnackbar(`Could not delete ${userDeleteTarget.username}.`);
    } finally {
      setDeletingUser(false);
    }
  };

  const openCreateRoleDialog = () => {
    setEditingRole(null);
    setRoleDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setRoleDialogOpen(true);
  };

  const handleRoleSaved = (message: string) => {
    setRoleDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openRoleDeleteDialog = (role: Role) => {
    setRoleDeleteError(null);
    setRoleDeleteTarget(role);
  };

  const handleRoleDeleteConfirm = async () => {
    if (!roleDeleteTarget) return;
    setDeletingRole(true);
    setRoleDeleteError(null);
    try {
      await deleteRole(roleDeleteTarget.id);
      setSnackbar(`Deleted ${roleLabel(roleDeleteTarget.name)}.`);
      setRoleDeleteTarget(null);
      loadAll();
    } catch (err) {
      setRoleDeleteError(firstApiError(err, 'Could not delete this role.'));
    } finally {
      setDeletingRole(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!users || !roles) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Users with a division-scoped role (Principal/Teacher/Class Teacher/
  // Accountant) are filtered to the selected division, same as Teachers.
  // Super Admin, Student, Parent and no-role accounts aren't tied to any one
  // division, so they stay visible under every tab rather than disappearing.
  const visibleUsers = users.filter((u) => {
    if (!u.role_name || !DIVISION_SCOPED_ROLES.includes(u.role_name)) return true;
    return u.assigned_board === boardTab && u.assigned_group === groupTab;
  });
  const unassignedCount = users.filter(
    (u) => u.role_name && DIVISION_SCOPED_ROLES.includes(u.role_name) && (!u.assigned_board || !u.assigned_group),
  ).length;

  // ToggleButtonGroup (exclusive) emits null if you click the already-
  // selected button — ignored, since exactly one of the two must stay
  // selected at all times.
  const handleBoardTabChange = (_e: SyntheticEvent, value: BoardValue | null) => {
    if (value) {
      setBoardTab(value);
      setUserPage(0);
    }
  };
  const handleGroupTabChange = (_e: SyntheticEvent, value: DivisionGroupValue | null) => {
    if (value) {
      setGroupTab(value);
      setUserPage(0);
    }
  };

  return (
    <Box>
      <PageHeader icon={GroupIcon} title="Users & Roles" />

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
      >
        <Tab label="Users" />
        <Tab label="Roles" />
      </Tabs>

      {tab === 0 && (
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
                      ? 'Your account is assigned to one division.'
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateUserDialog}>
              Add User
            </Button>
          </Stack>
          {!divisionLocked && unassignedCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', mb: 1 }}>
              {unassignedCount} user{unassignedCount === 1 ? '' : 's'} not shown here — division-scoped role with no
              division assigned yet (edit the user to assign one)
            </Typography>
          )}
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Division</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleUsers.slice(userPage * userRowsPerPage, userPage * userRowsPerPage + userRowsPerPage).map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.role_name ? (
                        <Chip size="small" label={roleLabel(u.role_name)} />
                      ) : (
                        <Chip size="small" label="No role" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {u.role_name && DIVISION_SCOPED_ROLES.includes(u.role_name) ? (
                        u.assigned_board && u.assigned_group ? (
                          <Chip size="small" variant="outlined" label={divisionLabel(u.assigned_board, u.assigned_group)} />
                        ) : (
                          <Chip size="small" color="warning" label="Not assigned" />
                        )
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={u.is_active ? 'success' : 'default'} label={u.is_active ? 'Active' : 'Inactive'} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton size="small" title="Edit" onClick={() => openEditUserDialog(u)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          sx={{ ml: 1 }}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? "You can't delete your own account" : 'Delete'}
                          onClick={() => openUserDeleteDialog(u)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        No users here yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={visibleUsers.length}
            page={userPage}
            onPageChange={(_e, newPage) => setUserPage(newPage)}
            rowsPerPage={userRowsPerPage}
            onRowsPerPageChange={(e) => {
              setUserRowsPerPage(Number(e.target.value));
              setUserPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}

      {tab === 1 && (
        <Paper variant="outlined">
          <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateRoleDialog}>
              Add Role
            </Button>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <span>{roleLabel(r.name)}</span>
                        {r.is_system && <Chip size="small" variant="outlined" label="System" />}
                      </Stack>
                    </TableCell>
                    <TableCell>{r.description || <Typography color="text.secondary">—</Typography>}</TableCell>
                    <TableCell align="right">{roleUserCounts[r.id] ?? 0}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEditRoleDialog(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={r.is_system}
                        title={r.is_system ? 'Built-in system roles cannot be deleted' : 'Delete'}
                        onClick={() => openRoleDeleteDialog(r)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <UserFormDialog
        open={userDialogOpen}
        user={editingUser}
        roles={roles}
        defaultBoard={boardTab}
        defaultGroup={groupTab}
        onClose={() => setUserDialogOpen(false)}
        onSaved={handleUserSaved}
      />
      <RoleFormDialog
        open={roleDialogOpen}
        role={editingRole}
        onClose={() => setRoleDialogOpen(false)}
        onSaved={handleRoleSaved}
      />

      <Dialog open={!!userDeleteTarget} onClose={ignoreBackdropClick(() => setUserDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This permanently deletes <strong>{userDeleteTarget?.username}</strong>. This cannot be undone.
          </Typography>
          {userDeleteLinkedTeacher && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This account is linked to a Teacher profile —{' '}
              <strong>
                {userDeleteLinkedTeacher.first_name} {userDeleteLinkedTeacher.last_name}
              </strong>{' '}
              ({userDeleteLinkedTeacher.teacher_id}). Deleting this user will also permanently delete that Teacher
              profile{userDeleteSlotCount === null ? '' : userDeleteSlotCount > 0 ? (
                <> and all <strong>{userDeleteSlotCount}</strong> of their timetable slot(s)</>
              ) : (
                ''
              )}
              . If they're a Class Teacher, that section loses its Class Teacher too.
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>{userDeleteTarget?.username}</strong> to confirm.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={userDeleteConfirmText}
            onChange={(e) => setUserDeleteConfirmText(e.target.value)}
            placeholder={userDeleteTarget?.username}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleUserDeleteConfirm}
            disabled={deletingUser || userDeleteConfirmText !== userDeleteTarget?.username}
          >
            {deletingUser ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!roleDeleteTarget} onClose={ignoreBackdropClick(() => setRoleDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete role?</DialogTitle>
        <DialogContent>
          {roleDeleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {roleDeleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes <strong>{roleDeleteTarget ? roleLabel(roleDeleteTarget.name) : ''}</strong>. This
            cannot be undone.
          </Typography>
          {roleDeleteTarget && (roleUserCounts[roleDeleteTarget.id] ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {roleUserCounts[roleDeleteTarget.id]} user(s) currently have this role — the delete will be blocked
              until they're reassigned.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRoleDeleteConfirm} disabled={deletingRole}>
            {deletingRole ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
      />
    </Box>
  );
}

function UserFormDialog({
  open,
  user,
  roles,
  defaultBoard,
  defaultGroup,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User | null;
  roles: Role[];
  defaultBoard: BoardValue;
  defaultGroup: DivisionGroupValue;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<UserFormValues>(EMPTY_USER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!user;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      user
        ? {
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone,
            role: user.role,
            is_active: user.is_active,
            password: '',
            assigned_board: user.assigned_board,
            assigned_group: user.assigned_group,
          }
        : { ...EMPTY_USER_FORM, assigned_board: defaultBoard, assigned_group: defaultGroup },
    );
    // Only pin the division from the active tab when the dialog opens for a
    // fresh "Add User" — an edit shouldn't silently move someone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const handleChange = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const selectedRoleName = roles.find((r) => r.id === values.role)?.name ?? null;
  const needsDivision = !!selectedRoleName && DIVISION_SCOPED_ROLES.includes(selectedRoleName);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        const payload: Partial<UserFormValues> = { ...values };
        if (!payload.password) delete payload.password;
        await updateUser(user.id, payload);
        onSaved(`Updated ${values.username}.`);
      } else {
        await createUser(values);
        onSaved(`Created ${values.username}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save user.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${user.username}` : 'Add User'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Username"
            value={values.username}
            onChange={(e) => handleChange('username', e.target.value)}
            required
            disabled={isEditing}
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => handleChange('email', e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="First name"
              value={values.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              fullWidth
            />
            <TextField
              label="Last name"
              value={values.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              fullWidth
            />
          </Stack>
          <TextField
            label="Phone"
            value={values.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Role"
            value={values.role ?? ''}
            onChange={(e) => handleChange('role', e.target.value ? Number(e.target.value) : null)}
            fullWidth
          >
            <MenuItem value="">
              <em>No role</em>
            </MenuItem>
            {roles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {roleLabel(r.name)}
              </MenuItem>
            ))}
          </TextField>
          {needsDivision && !isEditing && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Category for this user:
              </Typography>
              <Tooltip title="Defaults to the Board / School-College tabs selected on this page — change below if needed">
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`${BOARD_LABELS[values.assigned_board ?? defaultBoard]} · ${DIVISION_GROUP_LABELS[values.assigned_group ?? defaultGroup]}`}
                />
              </Tooltip>
            </Stack>
          )}
          {needsDivision && (
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Board"
                value={values.assigned_board ?? ''}
                onChange={(e) => handleChange('assigned_board', (e.target.value || null) as BoardValue | null)}
                helperText="Which board this account is confined to"
                required
                fullWidth
              >
                {(Object.keys(BOARD_LABELS) as BoardValue[]).map((b) => (
                  <MenuItem key={b} value={b}>
                    {BOARD_LABELS[b]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Group"
                value={values.assigned_group ?? ''}
                onChange={(e) => handleChange('assigned_group', (e.target.value || null) as DivisionGroupValue | null)}
                helperText="Which class group this account is confined to"
                required
                fullWidth
              >
                {(Object.keys(DIVISION_GROUP_LABELS) as DivisionGroupValue[]).map((g) => (
                  <MenuItem key={g} value={g}>
                    {DIVISION_GROUP_LABELS[g]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
          <TextField
            label={isEditing ? 'New password (leave blank to keep current)' : 'Password'}
            type="password"
            value={values.password}
            onChange={(e) => handleChange('password', e.target.value)}
            required={!isEditing}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch checked={values.is_active} onChange={(e) => handleChange('is_active', e.target.checked)} />
            }
            label="Active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !values.username || (needsDivision && (!values.assigned_board || !values.assigned_group))}
        >
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RoleFormDialog({
  open,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<RoleFormValues>(EMPTY_ROLE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!role;
  const isSystemRole = !!role?.is_system;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(role ? { name: role.name, description: role.description } : EMPTY_ROLE_FORM);
  }, [open, role]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateRole(role.id, values);
        onSaved(`Updated ${roleLabel(values.name)}.`);
      } else {
        await createRole(values);
        onSaved(`Created ${roleLabel(values.name)}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save role.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${roleLabel(role.name)}` : 'Add Role'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {isSystemRole && (
            <Alert severity="warning">
              This is one of the built-in Phase 1 roles. Renaming it may change what users with this role can see
              or access, since menus and permissions are matched against the exact role name.
            </Alert>
          )}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            helperText="Short code, e.g. LIBRARIAN"
            required
            fullWidth
          />
          <TextField
            label="Description"
            value={values.description}
            onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !values.name}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
