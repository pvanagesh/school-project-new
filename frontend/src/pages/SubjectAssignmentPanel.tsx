import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  assignSectionSubject,
  fetchSectionSubjects,
  fetchStreamProfiles,
  fetchSubjects,
  unassignSectionSubject,
} from '../api/academics';
import {
  classDisplayName,
  levelHasStreams,
  profileLabel,
  seniorSecondaryGroupLabel,
  SUBJECT_CATEGORY_LABELS,
  type BoardValue,
  type ClassStreamProfile,
  type SchoolClass,
  type Section,
  type SectionSubject,
  type Subject,
  type SubjectCategoryValue,
} from '../types';
import { firstApiError } from '../utils/apiError';

export function SubjectAssignmentPanel({
  classes,
  sections,
  board,
  divisionLocked,
  groupMode,
  onGroupModeChange,
}: {
  classes: SchoolClass[];
  sections: Section[];
  // Which board's classes/sections are being shown — passed down from the
  // Classes & Sections page's Board toggle (locked to their own division for
  // Principal/Teacher/Class Teacher/Accountant) so labels here always match
  // the board of the class/section actually being assigned subjects, rather
  // than the school's one overall board setting.
  board: BoardValue;
  // Same lock as the Classes/Sections tabs — true whenever the account (or
  // Super Admin's active School Profile division) can't switch board/group
  // here, so the radio below should be disabled too.
  divisionLocked: boolean;
  // Controlled by the parent, same as classGroupMode/sectionGroupMode, so a
  // locked division (or Super Admin's active School Profile division) drives
  // this radio too instead of it always starting on Classes 1 – 10.
  groupMode: 'junior' | 'senior';
  onGroupModeChange: (mode: 'junior' | 'senior') => void;
}) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [profiles, setProfiles] = useState<ClassStreamProfile[] | null>(null);
  const [sectionSubjects, setSectionSubjects] = useState<SectionSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [sectionId, setSectionId] = useState<number | ''>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const loadAll = () => {
    Promise.all([fetchSubjects(), fetchStreamProfiles(), fetchSectionSubjects()])
      .then(([subj, prof, secSubj]) => {
        setSubjects(subj);
        setProfiles(prof);
        setSectionSubjects(secSubj);
      })
      .catch(() => setError('Could not load subjects/curriculum from the API.'));
  };

  useEffect(loadAll, []);

  const selectedSection = sections.find((s) => s.id === sectionId) ?? null;

  const sectionLabel = (s: Section) => {
    const cls = classById[s.school_class];
    const className = cls ? classDisplayName(cls.level, cls.name, board) : '—';
    return `${className} - ${s.name}${s.stream ? ` (${s.stream})` : ''}`;
  };

  // Same Classes 1-10 vs 11-12 split used on the Classes & Sections page —
  // two separate pickers instead of one long combined list.
  const isSenior = (s: Section) => levelHasStreams(classById[s.school_class]?.level ?? '');
  const juniorSections = sections.filter((s) => !isSenior(s));
  const seniorSections = sections.filter((s) => isSenior(s));

  const matchingProfile = useMemo(() => {
    if (!selectedSection || !profiles) return null;
    return (
      profiles.find(
        (p) =>
          p.school_class === selectedSection.school_class &&
          p.stream === selectedSection.stream &&
          p.combination === selectedSection.combination,
      ) ?? null
    );
  }, [selectedSection, profiles]);

  useEffect(() => {
    if (!sectionId || !sectionSubjects) {
      setSelected(new Set());
      return;
    }
    const assigned = sectionSubjects.filter((ss) => ss.section === sectionId).map((ss) => ss.subject);
    setSelected(new Set(assigned));
    setSaveError(null);
  }, [sectionId, sectionSubjects]);

  const toggleSubject = (subjectId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const selectAllMandatory = () => {
    if (!matchingProfile) return;
    setSelected((prev) => {
      const next = new Set(prev);
      matchingProfile.subjects.filter((ps) => ps.category === 'MANDATORY').forEach((ps) => next.add(ps.subject));
      return next;
    });
  };

  const handleSave = async () => {
    if (!sectionId || !sectionSubjects) return;
    setSaving(true);
    setSaveError(null);
    try {
      const existing = sectionSubjects.filter((ss) => ss.section === sectionId);
      const existingSubjectIds = new Set(existing.map((ss) => ss.subject));

      const toAdd = [...selected].filter((id) => !existingSubjectIds.has(id));
      const toRemove = existing.filter((ss) => !selected.has(ss.subject));

      await Promise.all([
        ...toAdd.map((subjectId) => assignSectionSubject(sectionId, subjectId)),
        ...toRemove.map((ss) => unassignSectionSubject(ss.id)),
      ]);

      setSnackbar(`Saved subject assignment for ${selectedSection?.name}.`);
      loadAll();
    } catch (err) {
      setSaveError(firstApiError(err, 'Could not save subject assignment.'));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!subjects || !profiles || !sectionSubjects) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const subjectById: Record<number, Subject> = {};
  subjects.forEach((s) => (subjectById[s.id] = s));

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={3}>
        <RadioGroup row value={groupMode} onChange={(e) => onGroupModeChange(e.target.value as 'junior' | 'senior')}>
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

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Box sx={{ flex: 1, maxWidth: 420, opacity: groupMode === 'junior' ? 1 : 0.6 }}>
            <Autocomplete
              options={juniorSections}
              getOptionLabel={(s) => sectionLabel(s)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={selectedSection && !isSenior(selectedSection) ? selectedSection : null}
              onChange={(_e, value) => setSectionId(value ? value.id : '')}
              // Radio-gated like the Sections tab — only the live group's
              // picker is interactive; the other is greyed out until the
              // radio above is switched.
              disabled={groupMode !== 'junior'}
              noOptionsText="No sections yet in Classes 1 – 10"
              fullWidth
              renderInput={(params) => <TextField {...params} label="Section (Classes 1 – 10)" />}
            />
          </Box>
          <Box sx={{ flex: 1, maxWidth: 420, opacity: groupMode === 'senior' ? 1 : 0.6 }}>
            <Autocomplete
              options={seniorSections}
              getOptionLabel={(s) => sectionLabel(s)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={selectedSection && isSenior(selectedSection) ? selectedSection : null}
              onChange={(_e, value) => setSectionId(value ? value.id : '')}
              disabled={groupMode !== 'senior'}
              noOptionsText="No sections yet"
              fullWidth
              renderInput={(params) => <TextField {...params} label={`Section (${seniorSecondaryGroupLabel(board)})`} />}
            />
          </Box>
        </Stack>

        {selectedSection && !matchingProfile && (
          <Alert severity="warning">
            No curriculum is defined for this section's class/stream/combination yet. Configure it on the Subjects
            page's Curriculum tab first.
          </Alert>
        )}

        {selectedSection && matchingProfile && (
          <>
            <Alert severity="info">
              Showing subjects from <strong>{profileLabel(matchingProfile)}</strong>'s curriculum. Check the ones
              taught in this section.
            </Alert>

            {saveError && <Alert severity="error">{saveError}</Alert>}

            {(Object.keys(SUBJECT_CATEGORY_LABELS) as SubjectCategoryValue[]).map((cat) => {
              const items = matchingProfile.subjects.filter((ps) => ps.category === cat);
              if (items.length === 0) return null;
              return (
                <Box key={cat}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">{SUBJECT_CATEGORY_LABELS[cat]}</Typography>
                    {cat === 'MANDATORY' && (
                      <Button size="small" onClick={selectAllMandatory}>
                        Select all mandatory
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
                    {items.map((ps) => (
                      <FormControlLabel
                        key={ps.id}
                        control={
                          <Checkbox
                            checked={selected.has(ps.subject)}
                            onChange={() => toggleSubject(ps.subject)}
                          />
                        }
                        label={subjectById[ps.subject]?.name ?? ps.subject_name}
                        sx={{ width: { xs: '100%', sm: '33%' } }}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}

            <Box>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Assignment'}
              </Button>
            </Box>
          </>
        )}
      </Stack>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Paper>
  );
}
