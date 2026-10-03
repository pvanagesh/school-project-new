import { useEffect, useState } from 'react';
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
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { PageHeader } from '../components/PageHeader';
import {
  addProfileSubject,
  createStreamProfile,
  createSubject,
  deleteSubject,
  fetchClasses,
  fetchStreamProfiles,
  fetchSubjects,
  removeProfileSubject,
  updateSubject,
} from '../api/academics';
import {
  BOARD_LABELS,
  CO_SCHOLASTIC_CATEGORY_LABELS,
  COMBINATION_LABELS,
  combinationsByStream,
  CLASS_LEVEL_ORDER,
  DIVISION_SCOPED_ROLES,
  LANGUAGE_TIER_LABELS,
  levelHasStreams,
  levelInRange,
  seniorSecondaryGroupLabel,
  STREAM_LABELS,
  SUBJECT_CATEGORY_LABELS,
  profileLabel,
  type BoardValue,
  type ClassStreamProfile,
  type ClassStreamProfileFormValues,
  type CombinationValue,
  type CoScholasticCategoryValue,
  type LanguageTierValue,
  type SchoolClass,
  type StreamValue,
  type Subject,
  type SubjectCategoryValue,
  type SubjectFormValues,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

// SSC's Intermediate groups (MPC/BiPC/CEC/HEC) each imply their own stream —
// unlike CBSE's Science/Commerce electives, there's no separate "pick a
// stream, then narrow it down" step. Flattened once here, same as the
// Sections form on Classes & Sections, so the Add Curriculum dialog offers
// them as a single "Stream" choice that sets both fields at once.
const SSC_STREAM_GROUPS: Array<{ value: CombinationValue; stream: StreamValue; label: string }> = (
  Object.keys(combinationsByStream('SSC')) as StreamValue[]
).flatMap((stream) =>
  combinationsByStream('SSC')[stream].map((value) => ({ value, stream, label: COMBINATION_LABELS[value] })),
);

const EMPTY_SUBJECT_FORM: SubjectFormValues = {
  name: '',
  code: '',
  min_level: null,
  max_level: null,
  language_tier: null,
  co_scholastic_category: null,
};

export function SubjectsPage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [profiles, setProfiles] = useState<ClassStreamProfile[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  // Curriculum (ClassStreamProfile) is already narrowed server-side to a
  // division-scoped user's own board+group (see apps.accounts.scoping), so
  // switching this dropdown to the other board just showed an empty table —
  // the same dead-end the Classes & Sections page had. Lock it the same way:
  // pin it to their assigned board/group and disable it for Principal/
  // Teacher/Class Teacher/Accountant. School Profile is now the one place
  // that picks a division — Super Admin's board+group here follows whatever
  // is currently active there (see ActiveDivisionContext) instead of
  // picking freely.
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard;
  const lockedGroupMode: 'junior' | 'senior' = lockedGroup === 'SENIOR' ? 'senior' : 'junior';

  const [board, setBoard] = useState<BoardValue>(lockedBoard ?? 'CBSE');
  // Same Classes-1-10-vs-senior split as Classes & Sections — Subject
  // Catalog and Curriculum used to list every level in one long flat list.
  const [groupMode, setGroupMode] = useState<'junior' | 'senior'>(lockedGroupMode);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    if (lockedBoard) {
      setBoard(lockedBoard);
      setGroupMode(lockedGroupMode);
    }
  }, [lockedBoard, lockedGroupMode]);

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // Set only when "Add Subject" is clicked on a class panel that has no
  // curriculum profile yet — pre-selects that class in the Add Curriculum
  // dialog instead of leaving the class picker empty.
  const [profileDialogInitialClassId, setProfileDialogInitialClassId] = useState<number | null>(null);

  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  // Catalog subjects are checked off (not clicked/×'d individually) and
  // acted on via the Edit/Delete buttons above the list — Edit only makes
  // sense for exactly one at a time, Delete works on any number selected.
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
  const [subjectDeleteTargets, setSubjectDeleteTargets] = useState<Subject[]>([]);
  const [subjectDeleteError, setSubjectDeleteError] = useState<string | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);

  // Single-focus selection — which class (and, for 11/12 stream classes,
  // which stream/combination profile) the panel below is showing. Falls
  // back to the first item in the current Board/Group's list whenever the
  // stored id isn't valid for it any more (derived at render time below),
  // so there's no separate resync effect to keep in sync.
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  // Inline "Add Subject" picker for the selected class/profile — pick a
  // category, check existing subjects or type a brand-new one, hit Save.
  const [addingToProfileId, setAddingToProfileId] = useState<number | null>(null);
  const [addCategory, setAddCategory] = useState<SubjectCategoryValue>('MANDATORY');
  const [addCheckedIds, setAddCheckedIds] = useState<Set<number>>(new Set());
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Quick-create: typing a brand-new subject name right in the picker
  // instead of having to leave the panel, create it on the Subject Catalog,
  // then come back here to attach it — creating and attaching now happen in
  // one step.
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);

  const loadAll = () => {
    Promise.all([fetchSubjects(), fetchStreamProfiles(), fetchClasses()])
      .then(([s, p, c]) => {
        setSubjects(s);
        setProfiles(p);
        setClasses(c);
      })
      .catch(() => setError('Could not load subjects/curriculum from the API.'));
  };

  useEffect(loadAll, []);

  const openCreateSubjectDialog = () => {
    setEditingSubject(null);
    setSubjectDialogOpen(true);
  };

  const openEditSubjectDialog = (s: Subject) => {
    setEditingSubject(s);
    setSubjectDialogOpen(true);
  };

  const handleSubjectSaved = (message: string) => {
    setSubjectDialogOpen(false);
    setSnackbar(message);
    setSelectedSubjectIds(new Set());
    loadAll();
  };

  const toggleSubjectSelected = (id: number) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEditSelectedSubject = () => {
    if (selectedSubjectIds.size !== 1) return;
    const [id] = selectedSubjectIds;
    const subject = subjects?.find((s) => s.id === id);
    if (subject) openEditSubjectDialog(subject);
  };

  const openDeleteSelectedSubjects = () => {
    const targets = (subjects ?? []).filter((s) => selectedSubjectIds.has(s.id));
    if (targets.length === 0) return;
    setSubjectDeleteError(null);
    setSubjectDeleteTargets(targets);
  };

  const handleSubjectDeleteConfirm = async () => {
    if (subjectDeleteTargets.length === 0) return;
    setDeletingSubject(true);
    setSubjectDeleteError(null);
    try {
      await Promise.all(subjectDeleteTargets.map((s) => deleteSubject(s.id)));
      setSnackbar(
        subjectDeleteTargets.length === 1
          ? `Deleted ${subjectDeleteTargets[0].name}.`
          : `Deleted ${subjectDeleteTargets.length} subjects.`,
      );
      setSubjectDeleteTargets([]);
      setSelectedSubjectIds(new Set());
      loadAll();
    } catch (err) {
      setSubjectDeleteError(firstApiError(err, 'Could not delete the selected subject(s).'));
    } finally {
      setDeletingSubject(false);
    }
  };

  const closeProfileDialog = () => {
    setProfileDialogOpen(false);
    setProfileDialogInitialClassId(null);
  };

  const handleProfileCreated = (message: string) => {
    // Jump the Class dropdown to the class this curriculum was just
    // created for, so the new (still-empty) profile is what's showing next.
    if (profileDialogInitialClassId != null) setSelectedClassId(profileDialogInitialClassId);
    setProfileDialogOpen(false);
    setProfileDialogInitialClassId(null);
    setSnackbar(message);
    loadAll();
  };

  const closeInlineAdd = () => {
    setAddingToProfileId(null);
    setAddCheckedIds(new Set());
    setAddError(null);
    setNewSubjectName('');
  };

  // Opens the inline "Add Subject" picker for a profile that already
  // exists — used once a class (or, for a stream class, a stream/
  // combination) is selected and has a curriculum profile to add into.
  const openAddSubject = (profile: ClassStreamProfile) => {
    setAddingToProfileId(profile.id);
    setAddCategory('MANDATORY');
    setAddCheckedIds(new Set());
    setAddError(null);
  };

  // "Add Subject" for the selected class: opens the inline picker if it
  // already has a curriculum profile, or opens the Add Curriculum dialog
  // (pre-selecting the class) if it doesn't yet — a profile has to exist
  // before any subject can be attached to it.
  const openAddSubjectForClass = (cls: SchoolClass, profile: ClassStreamProfile | null) => {
    if (profile) {
      openAddSubject(profile);
    } else {
      setProfileDialogInitialClassId(cls.id);
      setProfileDialogOpen(true);
    }
  };

  // "+ Add Stream/Combination" on a stream class (11/12) — a class can carry
  // several stream profiles (MPC, BiPC, ...) at once, so this always opens
  // the Add Curriculum dialog rather than jumping into an existing profile's
  // picker.
  const openAddStreamForClass = (cls: SchoolClass) => {
    setProfileDialogInitialClassId(cls.id);
    setProfileDialogOpen(true);
  };

  const toggleAddChecked = (id: number) => {
    setAddCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInlineAddSave = async (profile: ClassStreamProfile) => {
    if (addCheckedIds.size === 0) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const ids = [...addCheckedIds];
      await Promise.all(ids.map((id) => addProfileSubject(profile.id, id, addCategory)));
      setSnackbar(`Added ${ids.length} subject${ids.length === 1 ? '' : 's'} to ${profileLabel(profile)}.`);
      closeInlineAdd();
      loadAll();
    } catch (err) {
      setAddError(firstApiError(err, 'Could not add the selected subject(s).'));
    } finally {
      setAddSubmitting(false);
    }
  };

  // Quick-create: types a name, creates the catalog subject, and attaches it
  // to the class in one step — instead of leaving this panel to create it on
  // the Subject Catalog first, then coming back here to attach it.
  const handleCreateAndAddSubject = async (profile: ClassStreamProfile) => {
    const name = newSubjectName.trim();
    if (!name) return;
    setCreatingSubject(true);
    setAddError(null);
    try {
      const created = await createSubject({ ...EMPTY_SUBJECT_FORM, name });
      await addProfileSubject(profile.id, created.id, addCategory);
      setSnackbar(`Created ${name} and added it to ${profileLabel(profile)}.`);
      closeInlineAdd();
      loadAll();
    } catch (err) {
      setAddError(firstApiError(err, 'Could not create and add this subject.'));
    } finally {
      setCreatingSubject(false);
    }
  };

  // Removes a subject from just this one class's curriculum (not the
  // catalog) — the chip's own delete ("x"), so this no longer needs a
  // separate screen the way the old Curriculum tab's "View" popup did.
  const handleRemoveFromProfile = async (ps: { id: number; subject_name: string }, profile: ClassStreamProfile) => {
    try {
      await removeProfileSubject(ps.id);
      setSnackbar(`Removed ${ps.subject_name} from ${profileLabel(profile)}.`);
      loadAll();
    } catch (err) {
      setSnackbar(firstApiError(err, 'Could not remove this subject.'));
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!subjects || !profiles || !classes) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const classById = new Map(classes.map((c) => [c.id, c]));
  // Same Classes-1-10-vs-Intermediate split as Classes & Sections — a
  // profile only carries its class's id, so its own class's level decides
  // which group it belongs to.
  const boardProfiles = profiles.filter((p) => {
    if (p.board !== board) return false;
    const cls = classById.get(p.school_class);
    return cls ? levelHasStreams(cls.level) === (groupMode === 'senior') : true;
  });

  // The Subject Catalog is grouped class-wise from the actual curriculum
  // (ClassStreamProfile/ProfileSubject) rather than each subject's loose
  // min/max level range — the level range is a broad "could apply from X to
  // Y" hint (many core subjects like English/Mathematics span every level),
  // so filtering by it alone showed nearly the same wide subject list under
  // every single class. Curriculum says exactly which subjects a class
  // actually requires, so grouping by it instead gives each class its own,
  // much narrower, non-repetitive list.
  const boardClasses = [...classes]
    .filter((c) => c.board === board && levelHasStreams(c.level) === (groupMode === 'senior'))
    .sort((a, b) => CLASS_LEVEL_ORDER.indexOf(a.level) - CLASS_LEVEL_ORDER.indexOf(b.level));

  // Derived-default selection — computed fresh every render instead of
  // resynced via an effect, so switching Board/Group (which changes
  // boardClasses/boardProfiles) never leaves a stale, no-longer-valid id
  // selected: falls back to the first item in the current list whenever the
  // stored selection doesn't belong to it.
  const effectiveClassId =
    selectedClassId && boardClasses.some((c) => c.id === selectedClassId) ? selectedClassId : boardClasses[0]?.id ?? null;
  const selectedClass = effectiveClassId != null ? classById.get(effectiveClassId) ?? null : null;
  const isStreamClass = selectedClass ? levelHasStreams(selectedClass.level) : false;
  const classProfiles = boardProfiles.filter((p) => p.school_class === effectiveClassId);
  const effectiveProfileId =
    selectedProfileId && classProfiles.some((p) => p.id === selectedProfileId) ? selectedProfileId : classProfiles[0]?.id ?? null;
  const activeProfile = classProfiles.find((p) => p.id === effectiveProfileId) ?? null;

  return (
    <Box>
      <PageHeader icon={MenuBookIcon} title="Subjects" />

      <Stack direction="row" sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }} spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Board:
        </Typography>
        <RadioGroup
          row
          value={board}
          onChange={(e) => setBoard(e.target.value as BoardValue)}
        >
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

      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }} spacing={1}>
        <RadioGroup
          row
          value={groupMode}
          onChange={(e) => setGroupMode(e.target.value as 'junior' | 'senior')}
        >
          <FormControlLabel
            value="junior"
            control={<Radio size="small" disabled={divisionLocked} />}
            label="Classes 1 – 10"
          />
          <FormControlLabel
            value="senior"
            control={<Radio size="small" disabled={divisionLocked} />}
            label={seniorSecondaryGroupLabel(board)}
          />
        </RadioGroup>
      </Stack>

      <Paper variant="outlined">
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: 'center', p: 1, flexWrap: 'wrap' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title={selectedSubjectIds.size === 1 ? '' : 'Select exactly one subject to edit'}>
              <span>
                <Button
                  size="small"
                  startIcon={<EditIcon fontSize="small" />}
                  onClick={openEditSelectedSubject}
                  disabled={selectedSubjectIds.size !== 1}
                >
                  Edit
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={selectedSubjectIds.size > 0 ? '' : 'Select one or more subjects to delete'}>
              <span>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon fontSize="small" />}
                  onClick={openDeleteSelectedSubjects}
                  disabled={selectedSubjectIds.size === 0}
                >
                  Delete{selectedSubjectIds.size > 0 ? ` (${selectedSubjectIds.size})` : ''}
                </Button>
              </span>
            </Tooltip>
          </Stack>
          <Tooltip title="Selecting subjects above (Edit/Delete) manages the catalog entry itself. To add or remove a subject from one class's curriculum, use that class's own Add Subject button below, or the × on a subject chip.">
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateSubjectDialog}>
              Add Subject
            </Button>
          </Tooltip>
        </Stack>

        {/* Single-focus view — pick a class (and, for an 11/12 stream class,
            a stream/combination) from the dropdowns below to see and manage
            just that one curriculum, instead of scrolling through every
            class's panel at once. */}
        <Box sx={{ px: 2, pb: 2 }}>
          {boardClasses.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No {BOARD_LABELS[board]} classes yet — add one on Classes & Sections first.
            </Typography>
          ) : (
            <>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                <TextField
                  select
                  size="small"
                  label="Class"
                  value={effectiveClassId ?? ''}
                  onChange={(e) => {
                    setSelectedClassId(Number(e.target.value));
                    setSelectedProfileId(null);
                  }}
                  sx={{ minWidth: 160 }}
                >
                  {boardClasses.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </TextField>
                {isStreamClass && classProfiles.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label="Stream / Combination"
                    value={effectiveProfileId ?? ''}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                    sx={{ minWidth: 220 }}
                  >
                    {classProfiles.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {profileLabel(p)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {isStreamClass && selectedClass && (
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => openAddStreamForClass(selectedClass)}
                  >
                    Add Stream/Combination
                  </Button>
                )}
              </Stack>

              {!activeProfile ? (
                <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Typography color="text.secondary">
                    {isStreamClass
                      ? `No stream/combination set up yet for ${selectedClass?.name} — click "Add Stream/Combination" above to create one.`
                      : `No curriculum set up yet for ${selectedClass?.name} — click "Add Subject" below to create it.`}
                  </Typography>
                  {!isStreamClass && selectedClass && (
                    <Button
                      size="small"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() => openAddSubjectForClass(selectedClass, null)}
                    >
                      Add Subject
                    </Button>
                  )}
                </Stack>
              ) : (
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="subtitle2">
                      {isStreamClass ? profileLabel(activeProfile) : selectedClass?.name} — Current Curriculum
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() => openAddSubject(activeProfile)}
                    >
                      Add Subject
                    </Button>
                  </Stack>
                  <Stack spacing={0.75}>
                    {(Object.keys(SUBJECT_CATEGORY_LABELS) as SubjectCategoryValue[]).map((cat) => {
                      const inCategory = activeProfile.subjects.filter((ps) => ps.category === cat);
                      return (
                        <Stack key={cat} direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100, pt: 0.5 }}>
                            {SUBJECT_CATEGORY_LABELS[cat]}
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {inCategory.length === 0 && (
                              <Typography color="text.secondary" variant="body2">
                                —
                              </Typography>
                            )}
                            {inCategory.map((ps) => (
                              <Chip
                                key={ps.id}
                                size="small"
                                clickable
                                label={ps.subject_name}
                                color={selectedSubjectIds.has(ps.subject) ? 'primary' : 'default'}
                                variant={selectedSubjectIds.has(ps.subject) ? 'filled' : 'outlined'}
                                onClick={() => toggleSubjectSelected(ps.subject)}
                                onDelete={() => handleRemoveFromProfile(ps, activeProfile)}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>

                  {addingToProfileId === activeProfile.id && selectedClass && (
                    <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover' }}>
                      {addError && (
                        <Alert severity="error" sx={{ mb: 1 }}>
                          {addError}
                        </Alert>
                      )}
                      <TextField
                        select
                        size="small"
                        label="Add to category"
                        value={addCategory}
                        onChange={(e) => {
                          setAddCategory(e.target.value as SubjectCategoryValue);
                          setAddCheckedIds(new Set());
                        }}
                        sx={{ minWidth: 200, mb: 0.5 }}
                      >
                        {(Object.keys(SUBJECT_CATEGORY_LABELS) as SubjectCategoryValue[]).map((cat) => (
                          <MenuItem key={cat} value={cat}>
                            {SUBJECT_CATEGORY_LABELS[cat]}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Mandatory = required for every student here. Optional = an elective students choose
                        between. Co-Scholastic = arts/sports/activity subjects.
                      </Typography>
                      {/* Every catalog subject roughly in this class's level range shows
                          up here — one already assigned to this class (in any category,
                          "compulsory"/Mandatory included) stays visible as a muted, non-
                          clickable marker labeled with its current category, instead of
                          being hidden — so it's clear what's already required, not just
                          what's still pickable. A checked-but-still-pickable one is a
                          solid highlighted marker; unpicked ones are outlined. */}
                      <Box
                        sx={{
                          maxHeight: 220,
                          overflowY: 'auto',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 1,
                          mb: 1.5,
                        }}
                      >
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {subjects
                            .filter((s) => levelInRange(selectedClass.level, s.min_level, s.max_level))
                            .map((s) => {
                              const existing = activeProfile.subjects.find((ps) => ps.subject === s.id);
                              const checked = !!existing || addCheckedIds.has(s.id);
                              return (
                                <Chip
                                  key={s.id}
                                  size="small"
                                  clickable={!existing}
                                  disabled={!!existing}
                                  label={
                                    existing ? `${s.name} (already ${SUBJECT_CATEGORY_LABELS[existing.category]})` : s.name
                                  }
                                  color={checked ? 'primary' : 'default'}
                                  variant={checked ? 'filled' : 'outlined'}
                                  onClick={existing ? undefined : () => toggleAddChecked(s.id)}
                                />
                              );
                            })}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleInlineAddSave(activeProfile)}
                          disabled={addSubmitting || addCheckedIds.size === 0}
                        >
                          {addSubmitting ? 'Saving…' : 'Save'}
                        </Button>
                        <Button size="small" onClick={closeInlineAdd}>
                          Cancel
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Don't see the subject you need? Create it and add it here in one step:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          placeholder="New subject name"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          fullWidth
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleCreateAndAddSubject(activeProfile)}
                          disabled={creatingSubject || !newSubjectName.trim()}
                        >
                          {creatingSubject ? 'Adding…' : 'Create & Add'}
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>

      <SubjectFormDialog
        open={subjectDialogOpen}
        subject={editingSubject}
        onClose={() => setSubjectDialogOpen(false)}
        onSaved={handleSubjectSaved}
      />

      <ProfileFormDialog
        open={profileDialogOpen}
        classes={boardClasses}
        defaultBoard={board}
        initialClassId={profileDialogInitialClassId}
        onClose={closeProfileDialog}
        onSaved={handleProfileCreated}
      />

      <Dialog
        open={subjectDeleteTargets.length > 0}
        onClose={ignoreBackdropClick(() => setSubjectDeleteTargets([]))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{subjectDeleteTargets.length === 1 ? 'Delete subject?' : `Delete ${subjectDeleteTargets.length} subjects?`}</DialogTitle>
        <DialogContent>
          {subjectDeleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {subjectDeleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes{' '}
            <strong>
              {subjectDeleteTargets.length === 1
                ? subjectDeleteTargets[0].name
                : subjectDeleteTargets.map((s) => s.name).join(', ')}
            </strong>{' '}
            and removes {subjectDeleteTargets.length === 1 ? 'it' : 'them'} from any curriculum{' '}
            {subjectDeleteTargets.length === 1 ? "it's" : "they're"} part of. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubjectDeleteTargets([])}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleSubjectDeleteConfirm} disabled={deletingSubject}>
            {deletingSubject ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

function SubjectFormDialog({
  open,
  subject,
  onClose,
  onSaved,
}: {
  open: boolean;
  subject: Subject | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<SubjectFormValues>(EMPTY_SUBJECT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!subject;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      subject
        ? {
            name: subject.name,
            code: subject.code,
            min_level: subject.min_level,
            max_level: subject.max_level,
            language_tier: subject.language_tier,
            co_scholastic_category: subject.co_scholastic_category,
          }
        : EMPTY_SUBJECT_FORM,
    );
  }, [open, subject]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateSubject(subject.id, values);
        onSaved(`Updated ${values.name}.`);
      } else {
        await createSubject(values);
        onSaved(`Created ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save subject.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${subject.name}` : 'Add Subject'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Code (optional)"
            value={values.code ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="e.g. MATH, EVS"
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="From Class"
              value={values.min_level ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, min_level: e.target.value || null }))}
              fullWidth
            >
              <MenuItem value="">
                <em>No lower bound</em>
              </MenuItem>
              {CLASS_LEVEL_ORDER.map((lvl) => (
                <MenuItem key={lvl} value={lvl}>
                  {lvl}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="To Class"
              value={values.max_level ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, max_level: e.target.value || null }))}
              fullWidth
            >
              <MenuItem value="">
                <em>No upper bound</em>
              </MenuItem>
              {CLASS_LEVEL_ORDER.map((lvl) => (
                <MenuItem key={lvl} value={lvl}>
                  {lvl}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            select
            label="Language Tier"
            value={values.language_tier ?? ''}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, language_tier: (e.target.value || null) as LanguageTierValue | null }))
            }
            fullWidth
          >
            <MenuItem value="">
              <em>Not a language subject</em>
            </MenuItem>
            {(Object.keys(LANGUAGE_TIER_LABELS) as LanguageTierValue[]).map((v) => (
              <MenuItem key={v} value={v}>
                {LANGUAGE_TIER_LABELS[v]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Co-Scholastic Category"
            value={values.co_scholastic_category ?? ''}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                co_scholastic_category: (e.target.value || null) as CoScholasticCategoryValue | null,
              }))
            }
            fullWidth
          >
            <MenuItem value="">
              <em>Not a co-scholastic subject</em>
            </MenuItem>
            {(Object.keys(CO_SCHOLASTIC_CATEGORY_LABELS) as CoScholasticCategoryValue[]).map((v) => (
              <MenuItem key={v} value={v}>
                {CO_SCHOLASTIC_CATEGORY_LABELS[v]}
              </MenuItem>
            ))}
          </TextField>
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

const EMPTY_PROFILE_FORM: ClassStreamProfileFormValues = {
  school_class: null,
  stream: null,
  combination: null,
  board: 'CBSE',
};

function ProfileFormDialog({
  open,
  classes,
  defaultBoard,
  initialClassId = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  // Already scoped to the page's current Board + Classes 1-10/Intermediate
  // selection (see boardClasses) — every option here is a valid choice, so
  // there's no separate Board field on this dialog any more.
  classes: SchoolClass[];
  defaultBoard: BoardValue;
  // Pre-selects (and, since every call site now provides one, locks) the
  // Class field — set when this dialog was opened via a class panel's own
  // "Add Subject"/"Add Stream/Combination" button, so the class you clicked
  // is the class this creates a curriculum entry for.
  initialClassId?: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<ClassStreamProfileFormValues>(EMPTY_PROFILE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues({ ...EMPTY_PROFILE_FORM, board: defaultBoard, school_class: initialClassId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBoard, initialClassId]);

  const selectedClass = classes.find((c) => c.id === values.school_class) ?? null;
  const needsStream = !!selectedClass && levelHasStreams(selectedClass.level);

  const handleClassChange = (classId: number) => {
    const cls = classes.find((c) => c.id === classId) ?? null;
    setValues((prev) => ({
      ...prev,
      school_class: classId,
      stream: cls && levelHasStreams(cls.level) ? prev.stream : null,
      combination: cls && levelHasStreams(cls.level) ? prev.combination : null,
    }));
  };

  const handleStreamChange = (stream: StreamValue) => {
    setValues((prev) => ({ ...prev, stream, combination: null }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createStreamProfile(values);
      onSaved(`Created ${BOARD_LABELS[values.board]} curriculum for ${selectedClass?.name ?? ''}.`.trim());
    } catch (err) {
      setFormError(firstApiError(err, 'Could not create this curriculum.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = !!values.school_class && (!needsStream || !!values.stream);

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>Add Curriculum</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Class"
            value={values.school_class ?? ''}
            onChange={(e) => handleClassChange(Number(e.target.value))}
            disabled={initialClassId != null}
            required
            fullWidth
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          {needsStream && values.board === 'SSC' && (
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
              helperText="Required for Intermediate 1st/2nd Year classes."
            >
              {SSC_STREAM_GROUPS.map((g) => (
                <MenuItem key={g.value} value={g.value}>
                  {g.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsStream && values.board !== 'SSC' && (
            <TextField
              select
              label="Stream"
              value={values.stream ?? ''}
              onChange={(e) => handleStreamChange(e.target.value as StreamValue)}
              required
              fullWidth
            >
              {(Object.keys(STREAM_LABELS) as StreamValue[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {STREAM_LABELS[s]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsStream && values.board !== 'SSC' && values.stream && combinationsByStream(values.board)[values.stream].length > 0 && (
            <TextField
              select
              label="Combination"
              value={values.combination ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, combination: (e.target.value || null) as CombinationValue | null }))}
              fullWidth
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {combinationsByStream(values.board)[values.stream].map((c) => (
                <MenuItem key={c} value={c}>
                  {COMBINATION_LABELS[c]}
                </MenuItem>
              ))}
            </TextField>
          )}
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

