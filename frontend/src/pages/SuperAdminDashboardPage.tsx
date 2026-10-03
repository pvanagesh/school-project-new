import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
import ClassIcon from '@mui/icons-material/ClassOutlined';
import ViewModuleIcon from '@mui/icons-material/ViewModuleOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import HowToRegIcon from '@mui/icons-material/HowToRegOutlined';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import { fetchAcademicYears, fetchSchoolProfiles } from '../api/core';
import { fetchDashboard } from '../api/dashboard';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { ATTENDANCE_STATUS_LABELS, BOARD_LABELS, DIVISION_GROUP_LABELS, DIVISION_SCOPED_ROLES, divisionLabel, roleLabel } from '../types';
import type { AcademicYear, BoardValue, DashboardData, DivisionGroupValue, SchoolProfile } from '../types';

const ALL_DIVISIONS: Array<{ board: BoardValue; group: DivisionGroupValue }> = [
  { board: 'CBSE', group: 'JUNIOR' },
  { board: 'CBSE', group: 'SENIOR' },
  { board: 'SSC', group: 'JUNIOR' },
  { board: 'SSC', group: 'SENIOR' },
];

interface DashboardState {
  // One profile per division now (up to 4) rather than a single school
  // profile — see SchoolProfilePage.
  schoolProfiles: SchoolProfile[];
  academicYears: AcademicYear[];
  dashboard: DashboardData | null;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchSchoolProfiles(), fetchAcademicYears(), fetchDashboard()])
      .then(([profiles, years, dashboard]) => {
        if (cancelled) return;
        setState({
          schoolProfiles: profiles,
          academicYears: years,
          dashboard,
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard data from the API.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!state) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeYear = state.academicYears.find((y) => y.is_active);

  // A division-scoped role (Principal, Teacher, Class Teacher, Accountant)
  // only ever sees their own division's numbers below — say so right in the
  // header so it's clear these totals are narrowed, not the whole school.
  const roleName = user?.role_name ? roleLabel(user.role_name) : 'Super Admin';
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const dashboardSubtitle = isDivisionScopedRole
    ? `${roleName} Dashboard · ${divisionLabel(user?.assigned_board ?? null, user?.assigned_group ?? null)}`
    : `${roleName} Dashboard`;

  return (
    <Box>
      <PageHeader
        icon={DashboardIcon}
        title={`${getGreeting()}, ${user?.first_name || user?.username}`}
        subtitle={dashboardSubtitle}
      />

      <Grid container columnSpacing={2} rowSpacing={1} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <SchoolIcon color="primary" />
                <Typography variant="h6">School Profile</Typography>
              </Stack>
              {state.schoolProfiles.length > 0 ? (
                <Stack spacing={1}>
                  {(isDivisionScopedRole ? state.schoolProfiles : ALL_DIVISIONS.map((d) => (
                    state.schoolProfiles.find((p) => p.board === d.board && p.group === d.group) ?? d
                  ))).map((entry, i) => {
                    const profile = 'id' in entry ? entry : undefined;
                    const board = profile?.board ?? (entry as { board: BoardValue }).board;
                    const group = profile?.group ?? (entry as { group: DivisionGroupValue }).group;
                    return (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Chip
                          size="small"
                          color={profile ? 'default' : 'warning'}
                          variant={profile ? 'filled' : 'outlined'}
                          label={`${BOARD_LABELS[board]} · ${DIVISION_GROUP_LABELS[group]}`}
                        />
                        <Typography variant="body2" color={profile ? 'text.primary' : 'text.secondary'}>
                          {profile ? `${profile.name} (UDISE+ ${profile.udise_code})` : 'Not configured yet'}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Not configured yet. School Profile must be set up before Class/Section setup is enabled.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <EventNoteIcon color="primary" />
                <Typography variant="h6">Academic Year</Typography>
              </Stack>
              {activeYear ? (
                <Stack spacing={0.5}>
                  <Typography>{activeYear.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activeYear.start_date} to {activeYear.end_date}
                  </Typography>
                  <Chip size="small" color="success" label="Active" sx={{ width: 'fit-content', mt: 1 }} />
                </Stack>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No active academic year configured yet.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container columnSpacing={2} rowSpacing={1} sx={{ mb: 2 }}>
        <Grid size={{xs: 8, sm: 4, md: 2 }}>
          <StatCard icon={<PeopleIcon color="primary" />} label="Total Students" value={state.dashboard?.total_students ?? 0} />
        </Grid>
        <Grid size={{ xs: 8, sm: 4, md: 2 }}>
          <StatCard icon={<CastForEducationIcon color="primary" />} label="Total Teachers" value={state.dashboard?.total_teachers ?? 0} />
        </Grid>
        <Grid size={{ xs: 8, sm: 4, md: 2 }}>
          <StatCard icon={<ClassIcon color="primary" />} label="Total Classes" value={state.dashboard?.total_classes ?? 0} />
        </Grid>
        <Grid size={{xs: 8, sm: 4, md: 2 }}>
          <StatCard icon={<ViewModuleIcon color="primary" />} label="Total Sections" value={state.dashboard?.total_sections ?? 0} />
        </Grid>
        <Grid size={{ xs: 8, sm: 4, md: 2 }}>
          <StatCard icon={<AssignmentIcon color="primary" />} label="Total Exams" value={state.dashboard?.total_exams ?? 0} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<PaymentsIcon color="primary" />}
            label="Fees Collected This Month"
            value={currencyFormatter.format(Number(state.dashboard?.fees_collected_this_month ?? 0))}
          />
        </Grid>
        {Object.entries(state.dashboard?.students_by_stream ?? {}).map(([stream, count]) => (
          <Grid size={{ xs: 8, sm: 4, md: 2 }} key={stream}>
            <StatCard label={`${stream.charAt(0)}${stream.slice(1).toLowerCase()} (11-12)`} value={count} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <HowToRegIcon color="primary" />
            <Typography variant="h6">Today's Attendance</Typography>
          </Stack>
          <Grid container spacing={2}>
            {Object.entries(state.dashboard?.today_attendance ?? {}).map(([status, count]) => (
              <Grid size={{ xs: 6, sm: 3 }} key={status}>
                <Typography variant="body2" color="text.secondary">
                  {ATTENDANCE_STATUS_LABELS[status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? status}
                </Typography>
                <Typography variant="h5">{count}</Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

function StatCard({ icon, label, value }: { icon?: ReactNode; label: string; value: number | string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4">{value}</Typography>
      </CardContent>
    </Card>
  );
}
