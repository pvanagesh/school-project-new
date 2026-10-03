import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { createSchoolProfile, fetchSchoolProfiles, updateSchoolProfile } from '../api/core';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/AuthContext';
import { useSchoolProfile } from '../school/SchoolProfileContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import {
  BOARD_LABELS,
  DIVISION_GROUP_LABELS,
  DIVISION_SCOPED_ROLES,
  type BoardValue,
  type DivisionGroupValue,
  type SchoolProfile,
  type SchoolProfileFormValues,
} from '../types';
import { firstApiError } from '../utils/apiError';

// A sensible starting name per division, matching how the school actually
// refers to each one day to day — editable, just saves retyping the
// obvious choice every time a new division's profile is set up.
const DEFAULT_NAME: Record<BoardValue, Record<DivisionGroupValue, string>> = {
  CBSE: { JUNIOR: 'CBSE School', SENIOR: 'CBSE College' },
  SSC: { JUNIOR: 'SSC School', SENIOR: 'SSC College' },
};

// The 4 divisions as one flat list for a single dropdown — picking one is
// the only way to switch which division's profile is being viewed/edited;
// there's no separate board/group control to line up.
const DIVISION_OPTIONS: Array<{ key: string; board: BoardValue; group: DivisionGroupValue; label: string }> = [
  { key: 'CBSE_JUNIOR', board: 'CBSE', group: 'JUNIOR', label: 'CBSE School' },
  { key: 'CBSE_SENIOR', board: 'CBSE', group: 'SENIOR', label: 'CBSE College' },
  { key: 'SSC_JUNIOR', board: 'SSC', group: 'JUNIOR', label: 'SSC School' },
  { key: 'SSC_SENIOR', board: 'SSC', group: 'SENIOR', label: 'SSC College' },
];

function divisionKey(board: BoardValue, group: DivisionGroupValue): string {
  return `${board}_${group}`;
}

function emptyForm(board: BoardValue, group: DivisionGroupValue): SchoolProfileFormValues {
  return {
    name: DEFAULT_NAME[board][group],
    udise_code: '',
    board,
    group,
    district: '',
    address: '',
    affiliation_number: '',
    principal_name: '',
  };
}

const UDISE_PATTERN = /^\d{11}$/;

export function SchoolProfilePage() {
  const { user } = useAuth();
  const { refresh: refreshSchoolProfileContext } = useSchoolProfile();
  const { board: activeDivisionBoard, group: activeDivisionGroup, setActiveDivision } = useActiveDivision();

  const [profiles, setProfiles] = useState<SchoolProfile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Same division-lock pattern as Classes & Sections, Subjects, and
  // Teachers — a division-scoped account only ever gets their own
  // division's profile back from the API, so their toggle is pinned and
  // disabled rather than able to "switch" to a division that always comes
  // back empty. Super Admin switches freely between all 4.
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : null;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : null;
  const divisionLocked = !!lockedBoard && !!lockedGroup;

  // Starts from whatever division was last active (persisted — see
  // ActiveDivisionContext) instead of always resetting to CBSE School, so
  // coming back to this page later picks up where you left off.
  const [boardTab, setBoardTab] = useState<BoardValue>(activeDivisionBoard);
  const [groupTab, setGroupTab] = useState<DivisionGroupValue>(activeDivisionGroup);

  useEffect(() => {
    if (lockedBoard) setBoardTab(lockedBoard);
    if (lockedGroup) setGroupTab(lockedGroup);
  }, [lockedBoard, lockedGroup]);

  // Whichever division is being viewed/edited here becomes the starting tab
  // on Classes & Sections, Subjects, Teachers and Users & Roles — so picking
  // "SSC School" here means those pages open to SSC School too, instead of
  // Super Admin having to re-pick it on each one.
  useEffect(() => {
    setActiveDivision(boardTab, groupTab);
  }, [boardTab, groupTab, setActiveDivision]);

  const load = () => {
    fetchSchoolProfiles()
      .then(setProfiles)
      .catch(() => setLoadError('Could not load the school profile from the API.'));
  };

  useEffect(load, []);

  const activeProfile = (profiles ?? []).find((p) => p.board === boardTab && p.group === groupTab) ?? null;

  const [values, setValues] = useState<SchoolProfileFormValues>(emptyForm('CBSE', 'JUNIOR'));
  // Baseline to diff against for "unsaved changes" — reset whenever the form
  // is re-seeded (division switch, or a fresh copy coming back after save).
  const [savedValues, setSavedValues] = useState<SchoolProfileFormValues | null>(null);

  useEffect(() => {
    setFormError(null);
    const seeded = activeProfile
      ? {
          name: activeProfile.name,
          udise_code: activeProfile.udise_code,
          board: activeProfile.board,
          group: activeProfile.group,
          district: activeProfile.district,
          address: activeProfile.address,
          affiliation_number: activeProfile.affiliation_number,
          principal_name: activeProfile.principal_name,
        }
      : emptyForm(boardTab, groupTab);
    setValues(seeded);
    setSavedValues(seeded);
    // Re-seed the form whenever the division being viewed changes, or once
    // the profiles list itself has loaded/changed (e.g. right after a save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardTab, groupTab, profiles]);

  const handleChange = <K extends keyof SchoolProfileFormValues>(field: K, value: SchoolProfileFormValues[K]) => {
    setSuccessMessage(null);
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const udiseValid = UDISE_PATTERN.test(values.udise_code);
  const isValid =
    values.name &&
    udiseValid &&
    values.district &&
    values.address &&
    values.affiliation_number &&
    values.principal_name;
  const isDirty = !savedValues || JSON.stringify(values) !== JSON.stringify(savedValues);
  // Only an existing (already-saved) profile can be "up to date" — a
  // not-yet-created profile should stay saveable even before any edit.
  const noChangesToSave = !!activeProfile && !isDirty;

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const saved = activeProfile
        ? await updateSchoolProfile(activeProfile.id, values)
        : await createSchoolProfile(values);
      setProfiles((prev) => {
        const rest = (prev ?? []).filter((p) => p.id !== saved.id);
        return [...rest, saved];
      });
      setSuccessMessage(activeProfile ? 'School profile updated.' : 'School profile created.');
      refreshSchoolProfileContext();
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save the school profile.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) return <Alert severity="error">{loadError}</Alert>;

  if (profiles === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const configuredCount = profiles.length;

  return (
    <Box>
      <PageHeader
        icon={SchoolIcon}
        title="School Profile"
        subtitle="Affiliation details for each of the school's 4 divisions — CBSE School, CBSE College, SSC School, SSC College."
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            select
            label="Division"
            value={divisionKey(boardTab, groupTab)}
            onChange={(e) => {
              const option = DIVISION_OPTIONS.find((o) => o.key === e.target.value);
              if (!option) return;
              // Switching divisions re-seeds the form from that division's
              // own data — never do that out from under unsaved edits.
              if (isDirty) {
                setFormError('Save your changes before switching divisions.');
                return;
              }
              setBoardTab(option.board);
              setGroupTab(option.group);
            }}
            disabled={divisionLocked}
            size="small"
            sx={{ minWidth: 220 }}
          >
            {DIVISION_OPTIONS.map((o) => {
              const isActive = o.board === boardTab && o.group === groupTab;
              return (
                <MenuItem
                  key={o.key}
                  value={o.key}
                  sx={!isActive ? { opacity: 0.5 } : { fontWeight: 600 }}
                >
                  {o.label}
                </MenuItem>
              );
            })}
          </TextField>
          {divisionLocked && (
            <Tooltip title="Locked to your assigned division">
              <Chip size="small" label={`${BOARD_LABELS[lockedBoard!]} · ${DIVISION_GROUP_LABELS[lockedGroup!]}`} />
            </Tooltip>
          )}
          {/* The selected division stands out; the other 3 stay visible but
              muted, so it's clear only one is "live" for editing right now. */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            {DIVISION_OPTIONS.map((o) => {
              const isActive = o.board === boardTab && o.group === groupTab;
              return (
                <Chip
                  key={o.key}
                  size="small"
                  label={o.label}
                  color={isActive ? 'primary' : 'default'}
                  variant={isActive ? 'filled' : 'outlined'}
                  sx={!isActive ? { opacity: 0.5 } : undefined}
                />
              );
            })}
          </Stack>
        </Stack>
        {!isDivisionScopedRole && (
          <Typography variant="caption" color="text.secondary">
            {configuredCount} of 4 division profiles configured.
          </Typography>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, maxWidth: 640 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          {activeProfile
            ? `Update ${BOARD_LABELS[boardTab]} ${DIVISION_GROUP_LABELS[groupTab]}'s affiliation details.`
            : `Not set up yet — complete this to configure ${BOARD_LABELS[boardTab]} ${DIVISION_GROUP_LABELS[groupTab]}.`}
        </Typography>

        <Stack spacing={1.5}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {successMessage && <Alert severity="success">{successMessage}</Alert>}

          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
            size="small"
          />

          <TextField
            label="UDISE+ Code"
            value={values.udise_code}
            onChange={(e) => handleChange('udise_code', e.target.value.replace(/\D/g, '').slice(0, 11))}
            required
            fullWidth
            size="small"
            error={values.udise_code.length > 0 && !udiseValid}
            helperText={
              values.udise_code.length > 0 && !udiseValid
                ? 'UDISE+ code must be exactly 11 digits.'
                : 'Exactly 11 digits. Each division has its own code.'
            }
          />

          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Division
              </Typography>
              <Chip size="small" label={`${BOARD_LABELS[boardTab]} · ${DIVISION_GROUP_LABELS[groupTab]}`} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                State
              </Typography>
              <Chip size="small" label={activeProfile?.state ?? 'Andhra Pradesh'} />
            </Box>
          </Stack>

          <TextField
            label="District"
            value={values.district}
            onChange={(e) => handleChange('district', e.target.value)}
            required
            fullWidth
            size="small"
          />

          <TextField
            label="Address"
            value={values.address}
            onChange={(e) => handleChange('address', e.target.value)}
            multiline
            minRows={2}
            required
            fullWidth
            size="small"
          />

          <TextField
            label="Affiliation Number"
            value={values.affiliation_number}
            onChange={(e) => handleChange('affiliation_number', e.target.value)}
            required
            fullWidth
            size="small"
            helperText="CBSE grants Secondary and Senior Secondary affiliation separately — this division's own number."
          />

          <TextField
            label="Principal Name"
            value={values.principal_name}
            onChange={(e) => handleChange('principal_name', e.target.value)}
            required
            fullWidth
            size="small"
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !isValid || noChangesToSave}
            >
              {submitting ? 'Saving…' : activeProfile ? 'Save Changes' : 'Create School Profile'}
            </Button>
            {noChangesToSave && (
              <Typography variant="body2" color="text.secondary">
                Saved — no changes to update.
              </Typography>
            )}
            {/* Nothing on this page points anywhere next — spell out the next
                step so setting up a division doesn't dead-end here. */}
            <Button
              component={RouterLink}
              to="/classes"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{ ml: 'auto' }}
            >
              Classes & Sections
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
