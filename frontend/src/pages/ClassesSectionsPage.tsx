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
  Radio,
  RadioGroup,
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
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import ClassIcon from '@mui/icons-material/ClassOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import {
  createClass,
  createCommonRoom,
  createSection,
  deleteClass,
  deleteCommonRoom,
  deleteSection,
  fetchClasses,
  fetchCommonRooms,
  fetchSections,
  updateCommonRoom,
  updateSection,
} from '../api/academics';
import { fetchTeachers } from '../api/teachers';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { PageHeader } from '../components/PageHeader';
import {
  classDisplayName,
  CLASS_LEVEL_ORDER,
  classGroupLabel,
  COMBINATION_LABELS,
  combinationsByStream,
  DIVISION_SCOPED_ROLES,
  LEVEL_CHOICES,
  levelHasStreams,
  seniorSecondaryGroupLabel,
  seniorSecondaryLevelLabel,
  STREAM_LABELS,
  ROOM_TYPE_LABELS,
  type BoardValue,
  type ClassGroupValue,
  type CombinationValue,
  type CommonRoom,
  type CommonRoomFormValues,
  type DivisionGroupValue,
  type RoomTypeValue,
  type SchoolClass,
  type Section,
  type SectionFormValues,
  type StreamValue,
  type Teacher,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';
import { SubjectAssignmentPanel } from './SubjectAssignmentPanel';

// SSC's Intermediate groups (MPC/BiPC/CEC/HEC) each imply their own stream —
// unlike CBSE's Science/Commerce electives, there's no separate "pick a
// stream, then narrow it down" step. Flattened once here so the section form
// can offer them as a single "Stream" choice that sets both fields at once.
const SSC_STREAM_GROUPS: Array<{ value: CombinationValue; stream: StreamValue; label: string }> = (
  Object.keys(combinationsByStream('SSC')) as StreamValue[]
).flatMap((stream) =>
  combinationsByStream('SSC')[stream].map((value) => ({ value, stream, label: COMBINATION_LABELS[value] })),
);

const EMPTY_SECTION_FORM: SectionFormValues = {
  school_class: null,
  name: '',
  stream: null,
  combination: null,
  class_teacher: null,
  room: null,
};

export function ClassesSectionsPage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();
  const activeDivisionGroupMode: 'junior' | 'senior' = activeDivisionGroup === 'SENIOR' ? 'senior' : 'junior';
  const [tab, setTab] = useState(0);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [commonRooms, setCommonRooms] = useState<CommonRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classDeleteTarget, setClassDeleteTarget] = useState<SchoolClass | null>(null);
  const [classDeleteError, setClassDeleteError] = useState<string | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState<Section | null>(null);
  const [sectionDeleteError, setSectionDeleteError] = useState<string | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);

  // Which of the two side-by-side class groups is currently being edited.
  // Picking one via the radio buttons below locks the other group's
  // Add/Edit/Delete actions until you switch back.
  const [classGroupMode, setClassGroupMode] = useState<'junior' | 'senior'>('junior');
  const [sectionGroupMode, setSectionGroupMode] = useState<'junior' | 'senior'>('junior');
  const [subjectGroupMode, setSubjectGroupMode] = useState<'junior' | 'senior'>('junior');
  // Set when a class row on the Classes tab is clicked — jumps to the
  // Sections tab already narrowed to just that class's sections (e.g.
  // clicking "Intermediate 1st Year" shows only its sections, not every
  // senior-secondary section mixed together), instead of landing on an
  // unfiltered list the user then has to make sense of.
  const [sectionsClassFilter, setSectionsClassFilter] = useState<number | null>(null);
  // Which board's data this page is currently showing — a class now belongs
  // to exactly one board, so the school can run CBSE and SSC side by side
  // (4 divisions total: each board x junior/senior). Follows whichever
  // division is currently active on School Profile (see the lock effect
  // below) rather than being switched here directly. Applies to the
  // Classes, Sections and Subject Assignment tabs directly; Class Rooms and
  // Common Rooms aren't board-filtered (rooms are shared physical resources
  // with no board of their own) but still follow this same selector for
  // their "Classes 1-10" vs Intermediate/11-12 label, so that label always
  // matches whatever's actually being viewed elsewhere on the page.
  const [boardMode, setBoardMode] = useState<BoardValue>(activeDivisionBoard);

  // Principal/Teacher/Class Teacher/Accountant accounts are confined to one
  // division (see apps.accounts.scoping on the backend) — the API already
  // only ever returns their own division's data, but leaving the Board and
  // Classes-1-10/Intermediate radios clickable let them "switch" into a view
  // that always came back empty, which read as broken rather than
  // restricted. So for a locked account these radios are pinned to their
  // assigned division and disabled. School Profile is now the one place
  // that picks a division for everyone else too — Super Admin's Board and
  // Classes-1-10/Intermediate radios here follow whatever division is
  // currently active on School Profile (see ActiveDivisionContext) instead
  // of switching freely; changing the division itself only happens there
  // (and, for a division-scoped account's own assignment, on Users & Roles).
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard && !!lockedGroup;
  const lockedGroupMode: 'junior' | 'senior' = lockedGroup === 'SENIOR' ? 'senior' : 'junior';

  useEffect(() => {
    if (!lockedBoard) return;
    setBoardMode(lockedBoard);
    setClassGroupMode(lockedGroupMode);
    setSectionGroupMode(lockedGroupMode);
    setSubjectGroupMode(lockedGroupMode);
    // Re-runs whenever the locked division changes — either a division-
    // scoped account's own reassignment, or (for Super Admin) picking a
    // different division on School Profile.
  }, [lockedBoard, lockedGroupMode]);

  const loadAll = () => {
    Promise.all([fetchClasses(), fetchSections(), fetchTeachers(), fetchCommonRooms()])
      .then(([c, s, t, r]) => {
        setClasses(c);
        setSections(s);
        setTeachers(t);
        setCommonRooms(r);
      })
      .catch(() => setError('Could not load classes/sections from the API.'));
  };

  useEffect(loadAll, []);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes?.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const sectionCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    sections?.forEach((s) => (counts[s.school_class] = (counts[s.school_class] ?? 0) + 1));
    return counts;
  }, [sections]);

  // A level is only "used up" within its own board now — Class 11 can exist
  // once for CBSE and once for SSC, so the Add Class picker only needs to
  // hide levels already created under the board currently being viewed.
  const usedLevels = useMemo(
    () => new Set((classes ?? []).filter((c) => c.board === boardMode).map((c) => c.level)),
    [classes, boardMode],
  );
  const allAvailableLevels = LEVEL_CHOICES.filter((l) => !usedLevels.has(l.value)).map((l) => ({
    value: l.value,
    // Board-aware so the "Add Class" picker already offers "Intermediate
    // 1st/2nd Year" instead of "Class 11"/"Class 12" while viewing the SSC
    // board.
    label: seniorSecondaryLevelLabel(l.value, boardMode),
  }));
  // Only the active group's levels are offered — matches which side-by-side
  // panel the radio buttons currently have selected.
  const availableLevels = allAvailableLevels.filter((l) =>
    classGroupMode === 'senior' ? levelHasStreams(l.value) : !levelHasStreams(l.value),
  );

  // Classes 1-10 (incl. LKG/UKG) are always a distinct group from 11-12 —
  // on both boards — and now each board's classes are entirely separate
  // rows, so the currently-selected board narrows the list first.
  const sortedClasses = useMemo(
    () =>
      [...(classes ?? [])]
        .filter((c) => c.board === boardMode)
        .sort((a, b) => CLASS_LEVEL_ORDER.indexOf(a.level) - CLASS_LEVEL_ORDER.indexOf(b.level)),
    [classes, boardMode],
  );
  const juniorClasses = sortedClasses.filter((c) => !levelHasStreams(c.level));
  const seniorClasses = sortedClasses.filter((c) => levelHasStreams(c.level));

  // Same Classes-1-10-vs-senior split for the Sections list, also narrowed
  // to the board currently being viewed. A section with no matching class
  // (shouldn't normally happen) is left out of both groups rather than
  // guessed into one. Sorted by class (LKG..10 / 11..12 order), then
  // section name — the API returns them in raw creation order, which
  // scattered Subject Assignment's section pickers (and the Sections
  // table) instead of listing Class 1 before Class 2, "A" before "B", etc.
  const sectionSortKey = (s: Section): [number, string] => {
    const cls = classById[s.school_class];
    return [cls ? CLASS_LEVEL_ORDER.indexOf(cls.level) : Number.MAX_SAFE_INTEGER, s.name];
  };
  const compareSections = (a: Section, b: Section) => {
    const [aLevel, aName] = sectionSortKey(a);
    const [bLevel, bName] = sectionSortKey(b);
    return aLevel - bLevel || aName.localeCompare(bName);
  };
  const juniorSections = (sections ?? [])
    .filter((s) => {
      const cls = classById[s.school_class];
      return cls && cls.board === boardMode && !levelHasStreams(cls.level);
    })
    .sort(compareSections);
  const seniorSections = (sections ?? [])
    .filter((s) => {
      const cls = classById[s.school_class];
      return cls && cls.board === boardMode && levelHasStreams(cls.level);
    })
    .sort(compareSections);
  // Add/Edit Section is only ever opened from the currently-active panel, so
  // the class picker inside that dialog only needs to offer that group's
  // classes.
  const sectionDialogClasses = sectionGroupMode === 'junior' ? juniorClasses : seniorClasses;

  // Narrowed further to just the clicked-through class, if any — see
  // openSectionsForClass below.
  const filteredClass = sectionsClassFilter ? classById[sectionsClassFilter] ?? null : null;
  const displayedJuniorSections = sectionsClassFilter
    ? juniorSections.filter((s) => s.school_class === sectionsClassFilter)
    : juniorSections;
  const displayedSeniorSections = sectionsClassFilter
    ? seniorSections.filter((s) => s.school_class === sectionsClassFilter)
    : seniorSections;

  const handleTabChange = (_e: SyntheticEvent, value: number) => {
    // A class-filtered Sections view only makes sense arriving from the
    // Classes tab — leaving Sections any other way clears it, so it's never
    // stale on a later visit.
    if (value !== 1) setSectionsClassFilter(null);
    setTab(value);
  };

  const openSectionsForClass = (c: SchoolClass) => {
    setSectionsClassFilter(c.id);
    setSectionGroupMode(levelHasStreams(c.level) ? 'senior' : 'junior');
    setTab(1);
  };

  const handleClassSaved = (message: string) => {
    setClassDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openClassDeleteDialog = (c: SchoolClass) => {
    setClassDeleteError(null);
    setClassDeleteTarget(c);
  };

  const handleClassDeleteConfirm = async () => {
    if (!classDeleteTarget) return;
    setDeletingClass(true);
    setClassDeleteError(null);
    try {
      await deleteClass(classDeleteTarget.id);
      setSnackbar(`Deleted ${classDeleteTarget.name}.`);
      setClassDeleteTarget(null);
      loadAll();
    } catch (err) {
      setClassDeleteError(firstApiError(err, 'Could not delete this class.'));
    } finally {
      setDeletingClass(false);
    }
  };

  const openCreateSectionDialog = () => {
    setEditingSection(null);
    setSectionDialogOpen(true);
  };

  const openEditSectionDialog = (s: Section) => {
    setEditingSection(s);
    setSectionDialogOpen(true);
  };

  const handleSectionSaved = (message: string) => {
    setSectionDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openSectionDeleteDialog = (s: Section) => {
    setSectionDeleteError(null);
    setSectionDeleteTarget(s);
  };

  const handleSectionDeleteConfirm = async () => {
    if (!sectionDeleteTarget) return;
    setDeletingSection(true);
    setSectionDeleteError(null);
    try {
      await deleteSection(sectionDeleteTarget.id);
      setSnackbar(`Deleted section ${sectionDeleteTarget.name}.`);
      setSectionDeleteTarget(null);
      loadAll();
    } catch (err) {
      setSectionDeleteError(firstApiError(err, 'Could not delete this section.'));
    } finally {
      setDeletingSection(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !sections || !teachers || !commonRooms) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        icon={ClassIcon}
        title="Classes & Sections"
        subtitle="Manage classes, sections, class rooms, common rooms and subject assignments"
      />

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 1, minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.25 } }}
      >
        <Tab label="Classes" />
        <Tab label="Sections" />
        <Tab label="Subject Assignment" />
        <Tab label="Class Rooms" />
        <Tab label="Common Rooms" />
      </Tabs>

      {(tab === 0 || tab === 1 || tab === 2 || tab === 3 || tab === 4) && (
        <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }} spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Board:
          </Typography>
          <RadioGroup row value={boardMode} onChange={(e) => setBoardMode(e.target.value as BoardValue)}>
            <FormControlLabel value="CBSE" control={<Radio size="small" disabled={divisionLocked} />} label="CBSE" />
            <FormControlLabel
              value="SSC"
              control={<Radio size="small" disabled={divisionLocked} />}
              label="SSC (State Board)"
            />
          </RadioGroup>
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
                label={isDivisionScopedRole ? 'Locked to your assigned division' : "Locked to School Profile's division"}
              />
            </Tooltip>
          )}
        </Stack>
      )}

      {tab === 0 && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }} spacing={1}>
            <RadioGroup
              row
              value={classGroupMode}
              onChange={(e) => setClassGroupMode(e.target.value as 'junior' | 'senior')}
            >
              <FormControlLabel
                value="junior"
                control={<Radio size="small" disabled={divisionLocked} />}
                label="Classes 1 – 10"
              />
              <FormControlLabel
                value="senior"
                control={<Radio size="small" disabled={divisionLocked} />}
                label={seniorSecondaryGroupLabel(boardMode)}
              />
            </RadioGroup>
            {availableLevels.length === 0 ? (
              // A disabled native button doesn't fire hover events, so the
              // Tooltip needs a wrapping span to know when to show — this is
              // only done in the disabled branch, matching how the Mark
              // Attendance tab's Tooltip/Tab issue was avoided elsewhere in
              // this app (an always-on span wrapper caused problems there).
              <Tooltip
                title={`Every level in ${classGroupMode === 'junior' ? 'Classes 1 – 10' : seniorSecondaryGroupLabel(boardMode)} already has a class for the ${boardMode} board — switch the radio button above, or the board above that, to add one elsewhere.`}
              >
                <span>
                  <Button variant="contained" startIcon={<AddIcon />} disabled>
                    Add Class
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setClassDialogOpen(true)}>
                Add Class
              </Button>
            )}
          </Stack>

          {/* Classes 1-10 and Classes 11-12 are always shown as two separate
              groups — this is the "portal" split the school asked for. Only
              the second group's heading/labels change with the board.
              Side-by-side (not stacked) so both groups are visible without
              scrolling past one to reach the other; each group scrolls
              internally if its own list gets long. The radio buttons above
              pick which one you're editing — the other one's row actions
              grey out so it's clear only one group is "live" at a time. */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <ClassesGroupTable
                title="Classes 1 – 10"
                classes={juniorClasses}
                board={boardMode}
                sectionCounts={sectionCounts}
                onDelete={openClassDeleteDialog}
                onSelect={openSectionsForClass}
                emptyMessage="No classes yet in Classes 1 – 10."
                interactive={classGroupMode === 'junior'}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <ClassesGroupTable
                title={seniorSecondaryGroupLabel(boardMode)}
                classes={seniorClasses}
                board={boardMode}
                sectionCounts={sectionCounts}
                onDelete={openClassDeleteDialog}
                onSelect={openSectionsForClass}
                emptyMessage="No senior-secondary classes yet."
                interactive={classGroupMode === 'senior'}
              />
            </Box>
          </Stack>
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {filteredClass && (
            <Chip
              label={`Showing: ${classDisplayName(filteredClass.level, filteredClass.name, boardMode)}`}
              onDelete={() => setSectionsClassFilter(null)}
              color="primary"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }} spacing={1}>
            <RadioGroup
              row
              value={sectionGroupMode}
              onChange={(e) => setSectionGroupMode(e.target.value as 'junior' | 'senior')}
            >
              <FormControlLabel
                value="junior"
                control={<Radio size="small" disabled={divisionLocked} />}
                label="Classes 1 – 10"
              />
              <FormControlLabel
                value="senior"
                control={<Radio size="small" disabled={divisionLocked} />}
                label={seniorSecondaryGroupLabel(boardMode)}
              />
            </RadioGroup>
            {sectionDialogClasses.length === 0 ? (
              <Tooltip
                title={`No classes exist yet in ${sectionGroupMode === 'junior' ? 'Classes 1 – 10' : seniorSecondaryGroupLabel(boardMode)} for the ${boardMode} board — add one on the Classes tab first, or switch the radio button above to the other group.`}
              >
                <span>
                  <Button variant="contained" startIcon={<AddIcon />} disabled>
                    Add Section
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateSectionDialog}>
                Add Section
              </Button>
            )}
          </Stack>

          {/* Same side-by-side, radio-gated layout as Classes, Class Rooms
              and Common Rooms — both groups visible at once, each scrolling
              internally, with the radio buttons picking which one is "live"
              for editing. */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <SectionsGroupTable
                title="Classes 1 – 10"
                sections={displayedJuniorSections}
                board={boardMode}
                onEdit={openEditSectionDialog}
                onDelete={openSectionDeleteDialog}
                classById={classById}
                emptyMessage={filteredClass ? 'No sections yet for this class.' : 'No sections yet in Classes 1 – 10.'}
                interactive={sectionGroupMode === 'junior'}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <SectionsGroupTable
                title={seniorSecondaryGroupLabel(boardMode)}
                sections={displayedSeniorSections}
                board={boardMode}
                onEdit={openEditSectionDialog}
                onDelete={openSectionDeleteDialog}
                classById={classById}
                emptyMessage={filteredClass ? 'No sections yet for this class.' : 'No senior-secondary sections yet.'}
                interactive={sectionGroupMode === 'senior'}
              />
            </Box>
          </Stack>
        </Stack>
      )}

      {tab === 2 && (
        <SubjectAssignmentPanel
          classes={sortedClasses}
          sections={[...juniorSections, ...seniorSections]}
          board={boardMode}
          divisionLocked={divisionLocked}
          groupMode={subjectGroupMode}
          onGroupModeChange={setSubjectGroupMode}
        />
      )}

      {tab === 3 && (
        <RoomsTab
          roomType="CLASS_ROOM"
          rooms={commonRooms.filter((r) => r.room_type === 'CLASS_ROOM')}
          sections={sections}
          classes={classes}
          board={boardMode}
          defaultGroupMode={lockedGroupMode}
          divisionLocked={divisionLocked}
          showAssignment
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}

      {tab === 4 && (
        <RoomsTab
          roomType="COMMON_ROOM"
          rooms={commonRooms.filter((r) => r.room_type === 'COMMON_ROOM')}
          sections={sections}
          classes={classes}
          board={boardMode}
          defaultGroupMode={lockedGroupMode}
          divisionLocked={divisionLocked}
          showAssignment={false}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}

      <ClassFormDialog
        open={classDialogOpen}
        availableLevels={availableLevels}
        board={boardMode}
        onClose={() => setClassDialogOpen(false)}
        onSaved={handleClassSaved}
      />

      <SectionFormDialog
        open={sectionDialogOpen}
        section={editingSection}
        classes={sectionDialogClasses}
        teachers={teachers}
        sections={sections}
        classById={classById}
        board={boardMode}
        onClose={() => setSectionDialogOpen(false)}
        onSaved={handleSectionSaved}
      />

      <Dialog open={!!classDeleteTarget} onClose={ignoreBackdropClick(() => setClassDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete class?</DialogTitle>
        <DialogContent>
          {classDeleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {classDeleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes <strong>{classDeleteTarget?.name}</strong> and all of its sections. This cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleClassDeleteConfirm} disabled={deletingClass}>
            {deletingClass ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!sectionDeleteTarget} onClose={ignoreBackdropClick(() => setSectionDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete section?</DialogTitle>
        <DialogContent>
          {sectionDeleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {sectionDeleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes section <strong>{sectionDeleteTarget?.name}</strong>. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectionDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleSectionDeleteConfirm} disabled={deletingSection}>
            {deletingSection ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

// Renders one of the two class groups ("Classes 1-10" and the board-aware
// 11-12 group) as its own small table. The dataset per group is at most a
// dozen rows (one per level), so there's no need for pagination here.
function ClassesGroupTable({
  title,
  classes,
  board,
  sectionCounts,
  onDelete,
  onSelect,
  emptyMessage,
  interactive = true,
}: {
  title: string;
  classes: SchoolClass[];
  board: BoardValue;
  sectionCounts: Record<number, number>;
  onDelete: (c: SchoolClass) => void;
  // Clicking anywhere on a row (other than Delete) jumps to that class's
  // sections — see openSectionsForClass.
  onSelect: (c: SchoolClass) => void;
  emptyMessage: string;
  // False while the OTHER group's radio button is selected — greys out this
  // panel's row actions so only one group is "live" for editing at a time.
  interactive?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ opacity: interactive ? 1 : 0.6 }}>
      <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
        {title}
      </Typography>
      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Streams</TableCell>
              <TableCell align="right">Sections</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {classes.map((c) => (
              <TableRow
                key={c.id}
                hover
                onClick={() => onSelect(c)}
                sx={{ cursor: 'pointer' }}
                title={`View ${classDisplayName(c.level, c.name, board)}'s sections`}
              >
                <TableCell>{classDisplayName(c.level, c.name, board)}</TableCell>
                <TableCell>
                  {levelHasStreams(c.level) ? (
                    <Chip size="small" label="Stream-based" />
                  ) : (
                    <Typography color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell align="right">{sectionCounts[c.id] ?? 0}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                    disabled={!interactive}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// Renders one of the two section groups ("Classes 1-10" and the board-aware
// 11-12 group), mirroring ClassesGroupTable above.
function SectionsGroupTable({
  title,
  sections,
  board,
  onEdit,
  onDelete,
  classById,
  emptyMessage,
  interactive = true,
}: {
  title: string;
  sections: Section[];
  board: BoardValue;
  onEdit: (s: Section) => void;
  onDelete: (s: Section) => void;
  classById: Record<number, SchoolClass>;
  emptyMessage: string;
  // False while the OTHER group's radio button is selected — greys out this
  // panel's row actions so only one group is "live" for editing at a time.
  interactive?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ opacity: interactive ? 1 : 0.6 }}>
      <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
        {title}
      </Typography>
      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Stream</TableCell>
              <TableCell>Class Teacher</TableCell>
              <TableCell>Class Room</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map((s) => {
              const cls = classById[s.school_class];
              return (
                <TableRow key={s.id} hover>
                  <TableCell>{cls ? classDisplayName(cls.level, cls.name, board) : '—'}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    {/* Show the specific group (MPC/BiPC/CEC/HEC, PCM/PCB/PCMB, ...)
                        once one's picked — just "Science"/"Commerce" doesn't tell
                        SSC's MPC and BiPC sections apart. Falls back to the plain
                        stream label for a section that has a stream but no
                        combination set yet. */}
                    {s.combination ? (
                      <Tooltip title={COMBINATION_LABELS[s.combination]}>
                        <Chip size="small" color="primary" variant="outlined" label={s.combination} />
                      </Tooltip>
                    ) : s.stream ? (
                      <Chip size="small" label={STREAM_LABELS[s.stream]} />
                    ) : (
                      <Typography color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.class_teacher_name ?? <Typography color="text.secondary">Unassigned</Typography>}
                  </TableCell>
                  <TableCell>
                    {/* Read-only here — a room is picked for a section from
                        the Class Rooms tab's own Assign action, not this
                        dialog (see SectionFormDialog), so this just mirrors
                        whatever's already assigned there. */}
                    {s.room_name ? (
                      s.room_code ? (
                        <Tooltip title={s.room_code}>
                          <span>{s.room_name}</span>
                        </Tooltip>
                      ) : (
                        s.room_name
                      )
                    ) : (
                      <Typography color="text.secondary">Unassigned</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {interactive ? (
                      <>
                        <IconButton size="small" onClick={() => onEdit(s)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => onDelete(s)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      // A disabled IconButton swallows hover, so it looked like
                      // Edit/Delete "did nothing" here with no explanation —
                      // wrap in a span so the Tooltip still shows why, and how
                      // to actually get to this section.
                      <Tooltip title={`${title} is a different group from the one active above — switch to it on School Profile, or click one of its classes on the Classes tab, to edit its sections here.`}>
                        <span>
                          <IconButton size="small" disabled>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" disabled>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {sections.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function ClassFormDialog({
  open,
  availableLevels,
  board,
  onClose,
  onSaved,
}: {
  open: boolean;
  availableLevels: { value: string; label: string }[];
  board: BoardValue;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [level, setLevel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLevel('');
      setFormError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!level) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const label = seniorSecondaryLevelLabel(level, board);
      await createClass({ name: label, level, board });
      onSaved(`Created ${label}.`);
    } catch (err) {
      setFormError(firstApiError(err, 'Could not create class.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>Add Class</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField select label="Class" value={level} onChange={(e) => setLevel(e.target.value)} fullWidth>
            {availableLevels.map((l) => (
              <MenuItem key={l.value} value={l.value}>
                {l.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !level}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionFormDialog({
  open,
  section,
  classes,
  teachers,
  sections,
  classById,
  board,
  onClose,
  onSaved,
}: {
  open: boolean;
  section: Section | null;
  classes: SchoolClass[];
  teachers: Teacher[];
  sections: Section[];
  // Full, unfiltered class lookup — the `classes` prop above is scoped to
  // just the junior/senior group currently open in this dialog, so it can't
  // be used to label a class teacher conflict that's in the other group.
  classById: Record<number, SchoolClass>;
  board: BoardValue;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<SectionFormValues>(EMPTY_SECTION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!section;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      section
        ? {
            school_class: section.school_class,
            name: section.name,
            stream: section.stream,
            combination: section.combination,
            class_teacher: section.class_teacher,
            // Room is assigned from the Common Rooms tab, not here — keep the
            // existing value so saving this form never clears it.
            room: section.room,
          }
        : EMPTY_SECTION_FORM,
    );
  }, [open, section]);

  const classTeacherOfBySection = useMemo(() => {
    const map: Record<number, Section> = {};
    sections.forEach((s) => {
      if (s.class_teacher && s.id !== section?.id) map[s.class_teacher] = s;
    });
    return map;
  }, [sections, section]);

  // Many classes have their own "Section A" — the bare section name alone
  // doesn't say which class it belongs to, which made every taken teacher
  // look like they were all already class teacher of the same one section.
  const takenByLabel = (s: Section) => {
    const cls = classById[s.school_class];
    return cls ? `${classDisplayName(cls.level, cls.name, board)} - ${s.name}` : s.name;
  };

  const selectedClass = classes.find((c) => c.id === values.school_class) ?? null;
  const needsStream = !!selectedClass && levelHasStreams(selectedClass.level);

  // Same board+group scoping as the Teachers page tabs — an Intermediate
  // section shouldn't be offered Classes-1-10 teachers (or the other
  // board's) as candidates. A teacher with no division assigned yet on
  // Users & Roles (still common — see the Teachers page's "Unassigned"
  // count) is kept in every list rather than hidden everywhere, since
  // there's no division of theirs to mismatch against.
  const sectionGroup: DivisionGroupValue = needsStream ? 'SENIOR' : 'JUNIOR';
  const eligibleTeachers = teachers.filter((t) => {
    const noDivisionSet = !t.user_assigned_board && !t.user_assigned_group;
    const matchesDivision = t.user_assigned_board === board && t.user_assigned_group === sectionGroup;
    return (
      noDivisionSet ||
      matchesDivision ||
      // Keep whoever's already assigned in the list even if their division
      // doesn't match, so opening this dialog doesn't blank out an existing
      // assignment.
      t.id === values.class_teacher
    );
  });

  const handleChange = <K extends keyof SectionFormValues>(field: K, value: SectionFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleStreamChange = (stream: StreamValue) => {
    setValues((prev) => ({ ...prev, stream, combination: null }));
  };

  const handleClassChange = (classId: number) => {
    const cls = classes.find((c) => c.id === classId) ?? null;
    setValues((prev) => ({
      ...prev,
      school_class: classId,
      stream: cls && levelHasStreams(cls.level) ? prev.stream : null,
      combination: cls && levelHasStreams(cls.level) ? prev.combination : null,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateSection(section.id, values);
        onSaved(`Updated section ${values.name}.`);
      } else {
        await createSection(values);
        onSaved(`Created section ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save section.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.school_class && values.name && (!needsStream || values.stream);

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit Section ${section.name}` : 'Add Section'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Class"
            value={values.school_class ?? ''}
            onChange={(e) => handleClassChange(Number(e.target.value))}
            fullWidth
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {classDisplayName(c.level, c.name, board)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Section Name"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. A"
            required
            fullWidth
          />
          {/* SSC's Intermediate groups are each their own fixed combination
              (MPC/BiPC/CEC/HEC) — one dropdown sets stream+combination
              together instead of CBSE's two-step Stream-then-Combination
              (Science/Commerce/Humanities, then which elective). */}
          {needsStream && board === 'SSC' && (
            <TextField
              select
              label="Stream"
              value={values.combination ?? ''}
              onChange={(e) => {
                const group = SSC_STREAM_GROUPS.find((g) => g.value === e.target.value);
                if (!group) return;
                setValues((prev) => ({ ...prev, stream: group.stream, combination: group.value }));
              }}
              required
              fullWidth
              helperText="Required for Intermediate 1st/2nd Year sections."
            >
              {SSC_STREAM_GROUPS.map((g) => (
                <MenuItem key={g.value} value={g.value}>
                  {g.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsStream && board !== 'SSC' && (
            <TextField
              select
              label="Stream"
              value={values.stream ?? ''}
              onChange={(e) => handleStreamChange(e.target.value as StreamValue)}
              required
              fullWidth
              helperText="Required for Class 11 and 12 sections."
            >
              {(Object.keys(STREAM_LABELS) as StreamValue[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {STREAM_LABELS[s]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsStream && board !== 'SSC' && values.stream && combinationsByStream(board)[values.stream].length > 0 && (
            <TextField
              select
              label="Combination"
              value={values.combination ?? ''}
              onChange={(e) => handleChange('combination', (e.target.value || null) as CombinationValue | null)}
              fullWidth
              helperText="Determines which curriculum (mandatory/optional subjects) applies to this section."
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {combinationsByStream(board)[values.stream].map((c) => (
                <MenuItem key={c} value={c}>
                  {COMBINATION_LABELS[c]}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            select
            label="Class Teacher (optional)"
            value={values.class_teacher ?? ''}
            onChange={(e) => handleChange('class_teacher', e.target.value ? Number(e.target.value) : null)}
            fullWidth
            helperText="A teacher can be the class teacher of only one section."
          >
            <MenuItem value="">
              <em>Unassigned</em>
            </MenuItem>
            {eligibleTeachers.map((t) => {
              const takenBy = classTeacherOfBySection[t.id];
              return (
                <MenuItem key={t.id} value={t.id} disabled={!!takenBy}>
                  {t.first_name} {t.last_name}
                  {takenBy ? ` (already class teacher of ${takenByLabel(takenBy)})` : ''}
                </MenuItem>
              );
            })}
          </TextField>
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

// ---------- Class Rooms / Common Rooms tabs ----------
//
// Class Rooms are a section's own home room (assignable via the Assign
// action below); Common Rooms are shared facilities (Music Room, Yoga Hall,
// ...) not tied to any one section. Both are CommonRoom rows under the
// hood, distinguished by room_type — this tab renders whichever slice it's
// given and only shows section-assignment for Class Rooms.

function RoomsTab({
  roomType,
  rooms,
  sections,
  classes,
  board,
  defaultGroupMode,
  divisionLocked,
  showAssignment,
  onChanged,
}: {
  roomType: RoomTypeValue;
  rooms: CommonRoom[];
  sections: Section[];
  classes: SchoolClass[];
  board: BoardValue;
  defaultGroupMode: 'junior' | 'senior';
  // Same lock as the Classes/Sections/Subject Assignment tabs — true
  // whenever the account (or Super Admin's active School Profile division)
  // can't switch board/group here.
  divisionLocked: boolean;
  showAssignment: boolean;
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommonRoom | null>(null);
  const [assignTarget, setAssignTarget] = useState<CommonRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommonRoom | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Which of the two side-by-side panels is being edited — the other
  // panel's row actions grey out until you switch back. Used for both the
  // Class Rooms (section-based) and Common Rooms (class_group-based) splits.
  // Starts from whichever division was last picked on School Profile, same
  // as the Classes/Sections group radios above, and stays synced to it —
  // this tab used to let the group be switched freely regardless of the
  // locked division, unlike every other tab here.
  const [roomGroupMode, setRoomGroupMode] = useState<'junior' | 'senior'>(defaultGroupMode);

  useEffect(() => {
    setRoomGroupMode(defaultGroupMode);
  }, [defaultGroupMode]);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const sectionLabel = (s: Section) => {
    const cls = classById[s.school_class];
    const className = cls ? classDisplayName(cls.level, cls.name, board) : '—';
    return `${className} - ${s.name}`;
  };

  const sectionsByRoom = useMemo(() => {
    const map: Record<number, Section[]> = {};
    sections.forEach((s) => {
      if (s.room) (map[s.room] ??= []).push(s);
    });
    return map;
  }, [sections]);

  // A Class Room can only be assigned to one section (see
  // RoomAssignSectionsDialog), so each one lands unambiguously in the
  // Classes 1-10 group, the senior group, or "Unassigned". Common Rooms
  // (showAssignment=false) have no section assignment at all, so this
  // grouping only applies to Class Rooms — Common Rooms stay one list.
  const roomGroup = (r: CommonRoom): 'junior' | 'senior' | 'unassigned' => {
    const section = (sectionsByRoom[r.id] ?? [])[0];
    if (!section) return 'unassigned';
    const cls = classById[section.school_class];
    return cls && levelHasStreams(cls.level) ? 'senior' : 'junior';
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCommonRoom(deleteTarget.id);
      onChanged(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this room.'));
    } finally {
      setDeleting(false);
    }
  };

  const renderRow = (r: CommonRoom, disabledActions: boolean) => {
    const assigned = sectionsByRoom[r.id] ?? [];
    return (
      <TableRow key={r.id} hover>
        <TableCell>{r.name}</TableCell>
        <TableCell>
          {r.code ? <Chip size="small" label={r.code} /> : <Typography color="text.secondary">—</Typography>}
        </TableCell>
        {showAssignment && (
          <TableCell>
            {assigned.length > 0 ? (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {assigned.map((s) => (
                  <Chip key={s.id} size="small" label={sectionLabel(s)} />
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">Unassigned</Typography>
            )}
          </TableCell>
        )}
        <TableCell align="right">
          {showAssignment && (
            <IconButton size="small" onClick={() => setAssignTarget(r)} disabled={disabledActions}>
              <GroupOutlined fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => {
              setEditing(r);
              setDialogOpen(true);
            }}
            disabled={disabledActions}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(r);
            }}
            disabled={disabledActions}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  const renderTable = (roomsSlice: CommonRoom[], emptyText: string, maxHeight?: number, disabledActions = false) => (
    <TableContainer sx={maxHeight ? { maxHeight } : undefined}>
      <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Code</TableCell>
            {showAssignment && <TableCell>Assigned Sections</TableCell>}
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roomsSlice.map((r) => renderRow(r, disabledActions))}
          {roomsSlice.length === 0 && (
            <TableRow>
              <TableCell colSpan={showAssignment ? 4 : 3}>
                <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {emptyText}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const dialogs = (
    <>
      {dialogOpen && (
        <RoomFormDialog
          room={editing}
          roomType={roomType}
          board={board}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      {assignTarget && (
        <RoomAssignSectionsDialog
          room={assignTarget}
          sections={sections}
          sectionLabel={sectionLabel}
          onClose={() => setAssignTarget(null)}
          onSaved={(m) => {
            setAssignTarget(null);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete room?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This removes <strong>{deleteTarget?.name}</strong> from the classroom picker. Existing timetable slots
            that already use it keep showing it as-is.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (showAssignment) {
    // Class Rooms: split into "Classes 1-10" and the board-aware senior
    // group, by whichever section the room is currently assigned to. There
    // used to be a third "Unassigned" list below for a brand-new room with
    // no section yet — removed on request, so a room with no section
    // simply doesn't show up here at all until something else gives it
    // one (e.g. a future Add Class Room flow that also picks a section).
    const junior = rooms.filter((r) => roomGroup(r) === 'junior');
    const senior = rooms.filter((r) => roomGroup(r) === 'senior');
    const seniorLabel = seniorSecondaryGroupLabel(board);

    return (
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }} spacing={1}>
          <RadioGroup
            row
            value={roomGroupMode}
            onChange={(e) => setRoomGroupMode(e.target.value as 'junior' | 'senior')}
          >
            <FormControlLabel
              value="junior"
              control={<Radio size="small" disabled={divisionLocked} />}
              label="Classes 1 – 10"
            />
            <FormControlLabel
              value="senior"
              control={<Radio size="small" disabled={divisionLocked} />}
              label={seniorLabel}
            />
          </RadioGroup>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add {ROOM_TYPE_LABELS[roomType]}
          </Button>
        </Stack>

        {/* Side by side (not stacked) so both groups are visible without
            scrolling past one to reach the next; each group scrolls
            internally if its own list gets long. The radio buttons above
            pick which panel is "live" for editing — the other one's row
            actions grey out. */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, width: '100%', opacity: roomGroupMode === 'junior' ? 1 : 0.6 }}>
            <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
              Classes 1 – 10
            </Typography>
            {renderTable(junior, 'No class rooms assigned to a Classes 1 – 10 section yet.', 300, roomGroupMode !== 'junior')}
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, width: '100%', opacity: roomGroupMode === 'senior' ? 1 : 0.6 }}>
            <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
              {seniorLabel}
            </Typography>
            {renderTable(senior, `No class rooms assigned to a ${seniorLabel} section yet.`, 300, roomGroupMode !== 'senior')}
          </Paper>
        </Stack>

        {dialogs}
      </Stack>
    );
  }

  // Common Rooms: same "Classes 1-10" / senior side-by-side split as Class
  // Rooms, but grouped by each room's own class_group setting (from the Add/
  // Edit dialog) instead of a section assignment — a room set to "Both"
  // (the default, so nothing existing disappears) shows up in both panels.
  const commonJunior = rooms.filter((r) => r.class_group === 'JUNIOR' || r.class_group === 'BOTH');
  const commonSenior = rooms.filter((r) => r.class_group === 'SENIOR' || r.class_group === 'BOTH');
  const commonSeniorLabel = seniorSecondaryGroupLabel(board);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }} spacing={1}>
        <RadioGroup
          row
          value={roomGroupMode}
          onChange={(e) => setRoomGroupMode(e.target.value as 'junior' | 'senior')}
        >
          <FormControlLabel
            value="junior"
            control={<Radio size="small" disabled={divisionLocked} />}
            label="Classes 1 – 10"
          />
          <FormControlLabel
            value="senior"
            control={<Radio size="small" disabled={divisionLocked} />}
            label={commonSeniorLabel}
          />
        </RadioGroup>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add {ROOM_TYPE_LABELS[roomType]}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, width: '100%', opacity: roomGroupMode === 'junior' ? 1 : 0.6 }}>
          <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
            Classes 1 – 10
          </Typography>
          {renderTable(commonJunior, 'No common rooms set up for Classes 1 – 10 yet.', 300, roomGroupMode !== 'junior')}
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, width: '100%', opacity: roomGroupMode === 'senior' ? 1 : 0.6 }}>
          <Typography variant="subtitle1" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
            {commonSeniorLabel}
          </Typography>
          {renderTable(commonSenior, `No common rooms set up for ${commonSeniorLabel} yet.`, 300, roomGroupMode !== 'senior')}
        </Paper>
      </Stack>

      {dialogs}
    </Stack>
  );
}

function RoomAssignSectionsDialog({
  room,
  sections,
  sectionLabel,
  onClose,
  onSaved,
}: {
  room: CommonRoom;
  sections: Section[];
  sectionLabel: (s: Section) => string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const originallyAssigned = sections.find((s) => s.room === room.id) ?? null;
  const [selected, setSelected] = useState<number | ''>(originallyAssigned?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const calls: Promise<Section>[] = [];
      if (originallyAssigned && originallyAssigned.id !== selected) {
        calls.push(updateSection(originallyAssigned.id, { room: null }));
      }
      if (selected !== '' && selected !== originallyAssigned?.id) {
        calls.push(updateSection(selected, { room: room.id }));
      }
      await Promise.all(calls);
      onSaved(`Updated the section assigned to ${room.name}.`);
    } catch (err) {
      setFormError(firstApiError(err, 'Could not update the section assignment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>Assign a Section to {room.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Section using this room"
            value={selected}
            onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : '')}
            helperText="Each class room can only be assigned to one section."
            fullWidth
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">
              <em>Unassigned</em>
            </MenuItem>
            {sections.map((s) => {
              const takenBy = s.room && s.room !== room.id ? s.room : null;
              return (
                <MenuItem key={s.id} value={s.id} disabled={!!takenBy}>
                  {sectionLabel(s)}
                  {takenBy ? ' (already has a class room)' : ''}
                </MenuItem>
              );
            })}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RoomFormDialog({
  room,
  roomType,
  board,
  onClose,
  onSaved,
}: {
  room: CommonRoom | null;
  roomType: RoomTypeValue;
  board: BoardValue;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<CommonRoomFormValues>({ name: '', code: '', room_type: roomType, class_group: 'BOTH' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!room;

  useEffect(() => {
    setValues(
      room
        ? { name: room.name, code: room.code, room_type: room.room_type, class_group: room.class_group }
        : { name: '', code: '', room_type: roomType, class_group: 'BOTH' },
    );
  }, [room, roomType]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateCommonRoom(room.id, values);
        onSaved(`Updated ${values.name}.`);
      } else {
        await createCommonRoom(values);
        onSaved(`Created ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save room.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${room.name}` : `Add ${ROOM_TYPE_LABELS[roomType]}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={roomType === 'CLASS_ROOM' ? 'e.g. Room 104' : 'e.g. Music Room'}
            required
            fullWidth
          />
          <TextField
            label="Code (optional)"
            value={values.code ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="e.g. Class-001, Ground-001, Music-Class-001"
            fullWidth
          />
          {roomType === 'COMMON_ROOM' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Used by
              </Typography>
              <RadioGroup
                row
                value={values.class_group ?? 'BOTH'}
                onChange={(e) => setValues((prev) => ({ ...prev, class_group: e.target.value as ClassGroupValue }))}
              >
                <FormControlLabel value="JUNIOR" control={<Radio size="small" />} label="Classes 1 – 10" />
                <FormControlLabel value="SENIOR" control={<Radio size="small" />} label={classGroupLabel('SENIOR', board)} />
                <FormControlLabel value="BOTH" control={<Radio size="small" />} label="Both" />
              </RadioGroup>
            </Box>
          )}
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
