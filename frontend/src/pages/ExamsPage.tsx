import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Alert,
  Box,
  Button,
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
import AddIcon from '@mui/icons-material/AddOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import PublishIcon from '@mui/icons-material/PublishOutlined';
import GradingIcon from '@mui/icons-material/GradingOutlined';
import { fetchAcademicYears } from '../api/core';
import { fetchClasses, fetchSubjects } from '../api/academics';
import { PageHeader } from '../components/PageHeader';
import {
  bulkSaveMarks,
  createAssessmentConfig,
  createExam,
  createSubjectMarksConfig,
  deleteAssessmentConfig,
  deleteExam,
  deleteSubjectMarksConfig,
  fetchAssessmentConfigs,
  fetchExams,
  fetchMarksEntries,
  fetchSubjectMarksConfigs,
  publishMarks,
  updateAssessmentConfig,
  updateExam,
  updateSubjectMarksConfig,
} from '../api/exams';
import { fetchStudentsBySection } from '../api/students';
import { fetchSections } from '../api/academics';
import {
  ASSESSMENT_MODE_LABELS,
  type AcademicYear,
  type AssessmentConfig,
  type AssessmentConfigFormValues,
  type AssessmentModeValue,
  type Exam,
  type ExamFormValues,
  type MarksEntry,
  type SchoolClass,
  type Section,
  type Student,
  type Subject,
  type SubjectMarksConfig,
  type SubjectMarksConfigFormValues,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_EXAM_FORM: ExamFormValues = { name: '', term: '', academic_year: null, school_class: null };
const EMPTY_ASSESSMENT_FORM: AssessmentConfigFormValues = { school_class: null, mode: null };
const EMPTY_SUBJECT_MARKS_FORM: SubjectMarksConfigFormValues = {
  subject: null,
  school_class: null,
  max_theory: 80,
  max_internal: 20,
};

export function ExamsPage() {
  const [tab, setTab] = useState(0);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [assessmentConfigs, setAssessmentConfigs] = useState<AssessmentConfig[] | null>(null);
  const [subjectMarksConfigs, setSubjectMarksConfigs] = useState<SubjectMarksConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const loadAll = () => {
    Promise.all([
      fetchClasses(),
      fetchAcademicYears(),
      fetchSubjects(),
      fetchExams(),
      fetchAssessmentConfigs(),
      fetchSubjectMarksConfigs(),
    ])
      .then(([c, y, subj, e, ac, smc]) => {
        setClasses(c);
        setAcademicYears(y);
        setSubjects(subj);
        setExams(e);
        setAssessmentConfigs(ac);
        setSubjectMarksConfigs(smc);
      })
      .catch(() => setError('Could not load exam data from the API.'));
  };

  useEffect(loadAll, []);

  const handleTabChange = (_e: SyntheticEvent, value: number) => setTab(value);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !academicYears || !subjects || !exams || !assessmentConfigs || !subjectMarksConfigs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={GradingIcon} title="Exams" />

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Exams" />
        <Tab label="Assessment Config" />
        <Tab label="Subject Marks Config" />
        <Tab label="Marks Entry" />
      </Tabs>

      {tab === 0 && (
        <ExamsTab exams={exams} classes={classes} academicYears={academicYears} onChanged={(m) => { setSnackbar(m); loadAll(); }} />
      )}
      {tab === 1 && (
        <AssessmentConfigTab
          configs={assessmentConfigs}
          classes={classes}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}
      {tab === 2 && (
        <SubjectMarksConfigTab
          configs={subjectMarksConfigs}
          classes={classes}
          subjects={subjects}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}
      {tab === 3 && (
        <MarksEntryTab exams={exams} subjects={subjects} subjectMarksConfigs={subjectMarksConfigs} onSnackbar={setSnackbar} />
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

// ---------- Exams tab ----------

function ExamsTab({
  exams,
  classes,
  academicYears,
  onChanged,
}: {
  exams: Exam[];
  classes: SchoolClass[];
  academicYears: AcademicYear[];
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (e: Exam) => {
    setEditing(e);
    setDialogOpen(true);
  };
  const openDelete = (e: Exam) => {
    setDeleteError(null);
    setDeleteTarget(e);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExam(deleteTarget.id);
      onChanged(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this exam.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Exam
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Term</TableCell>
              <TableCell>Academic Year</TableCell>
              <TableCell>Class</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exams.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.term}</TableCell>
                <TableCell>{e.academic_year_name}</TableCell>
                <TableCell>{e.school_class_name}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(e)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => openDelete(e)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {exams.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No exams yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {dialogOpen && (
        <ExamFormDialog
          exam={editing}
          classes={classes}
          academicYears={academicYears}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete exam?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes <strong>{deleteTarget?.name}</strong> and all of its marks entries. This cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function ExamFormDialog({
  exam,
  classes,
  academicYears,
  onClose,
  onSaved,
}: {
  exam: Exam | null;
  classes: SchoolClass[];
  academicYears: AcademicYear[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<ExamFormValues>(EMPTY_EXAM_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!exam;

  useEffect(() => {
    setValues(
      exam
        ? { name: exam.name, term: exam.term, academic_year: exam.academic_year, school_class: exam.school_class }
        : EMPTY_EXAM_FORM,
    );
  }, [exam]);

  const handleChange = <K extends keyof ExamFormValues>(field: K, value: ExamFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateExam(exam.id, values);
        onSaved(`Updated ${values.name}.`);
      } else {
        await createExam(values);
        onSaved(`Created ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save exam.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.name && values.term && values.academic_year && values.school_class;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${exam.name}` : 'Add Exam'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Mid Term"
            required
            fullWidth
          />
          <TextField
            label="Term"
            value={values.term}
            onChange={(e) => handleChange('term', e.target.value)}
            placeholder="e.g. Term 1"
            required
            fullWidth
          />
          <TextField
            select
            label="Academic Year"
            value={values.academic_year ?? ''}
            onChange={(e) => handleChange('academic_year', Number(e.target.value))}
            required
            fullWidth
          >
            {academicYears.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Class"
            value={values.school_class ?? ''}
            onChange={(e) => handleChange('school_class', Number(e.target.value))}
            required
            fullWidth
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
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

// ---------- Assessment Config tab ----------

function AssessmentConfigTab({
  configs,
  classes,
  onChanged,
}: {
  configs: AssessmentConfig[];
  classes: SchoolClass[];
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const availableClasses = useMemo(
    () => classes.filter((c) => !configs.some((cfg) => cfg.school_class === c.id)),
    [classes, configs],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: AssessmentConfig) => {
    setEditing(c);
    setDialogOpen(true);
  };
  const openDelete = (c: AssessmentConfig) => {
    setDeleteError(null);
    setDeleteTarget(c);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAssessmentConfig(deleteTarget.id);
      onChanged(`Removed assessment config for ${deleteTarget.school_class_name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this config.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={availableClasses.length === 0}>
          Add Config
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.school_class_name}</TableCell>
                <TableCell>{ASSESSMENT_MODE_LABELS[c.mode]}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(c)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => openDelete(c)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No assessment configs yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {dialogOpen && (
        <AssessmentConfigFormDialog
          config={editing}
          classes={editing ? classes : availableClasses}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete config?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This removes the assessment mode for <strong>{deleteTarget?.school_class_name}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function AssessmentConfigFormDialog({
  config,
  classes,
  onClose,
  onSaved,
}: {
  config: AssessmentConfig | null;
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<AssessmentConfigFormValues>(EMPTY_ASSESSMENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!config;

  useEffect(() => {
    setValues(config ? { school_class: config.school_class, mode: config.mode } : EMPTY_ASSESSMENT_FORM);
  }, [config]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateAssessmentConfig(config.id, { mode: values.mode });
        onSaved('Updated assessment config.');
      } else {
        await createAssessmentConfig(values);
        onSaved('Created assessment config.');
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save config.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.school_class && values.mode;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${config.school_class_name}` : 'Add Assessment Config'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Class"
            value={values.school_class ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, school_class: Number(e.target.value) }))}
            required
            fullWidth
            disabled={isEditing}
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mode"
            value={values.mode ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, mode: e.target.value as AssessmentModeValue }))}
            required
            fullWidth
          >
            {(Object.keys(ASSESSMENT_MODE_LABELS) as AssessmentModeValue[]).map((m) => (
              <MenuItem key={m} value={m}>
                {ASSESSMENT_MODE_LABELS[m]}
              </MenuItem>
            ))}
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

// ---------- Subject Marks Config tab ----------

function SubjectMarksConfigTab({
  configs,
  classes,
  subjects,
  onChanged,
}: {
  configs: SubjectMarksConfig[];
  classes: SchoolClass[];
  subjects: Subject[];
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectMarksConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectMarksConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: SubjectMarksConfig) => {
    setEditing(c);
    setDialogOpen(true);
  };
  const openDelete = (c: SubjectMarksConfig) => {
    setDeleteError(null);
    setDeleteTarget(c);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSubjectMarksConfig(deleteTarget.id);
      onChanged(`Removed marks config for ${deleteTarget.subject_name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this config.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Config
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell align="right">Max Theory</TableCell>
              <TableCell align="right">Max Internal</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.school_class_name}</TableCell>
                <TableCell>{c.subject_name}</TableCell>
                <TableCell align="right">{c.max_theory}</TableCell>
                <TableCell align="right">{c.max_internal}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(c)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => openDelete(c)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No subject marks configs yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {dialogOpen && (
        <SubjectMarksConfigFormDialog
          config={editing}
          classes={classes}
          subjects={subjects}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete config?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This removes the max-marks config for <strong>{deleteTarget?.subject_name}</strong> in{' '}
            <strong>{deleteTarget?.school_class_name}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function SubjectMarksConfigFormDialog({
  config,
  classes,
  subjects,
  onClose,
  onSaved,
}: {
  config: SubjectMarksConfig | null;
  classes: SchoolClass[];
  subjects: Subject[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<SubjectMarksConfigFormValues>(EMPTY_SUBJECT_MARKS_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!config;

  useEffect(() => {
    setValues(
      config
        ? {
            subject: config.subject,
            school_class: config.school_class,
            max_theory: config.max_theory,
            max_internal: config.max_internal,
          }
        : EMPTY_SUBJECT_MARKS_FORM,
    );
  }, [config]);

  const handleChange = <K extends keyof SubjectMarksConfigFormValues>(
    field: K,
    value: SubjectMarksConfigFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateSubjectMarksConfig(config.id, values);
        onSaved('Updated subject marks config.');
      } else {
        await createSubjectMarksConfig(values);
        onSaved('Created subject marks config.');
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save config.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.subject && values.school_class && values.max_theory >= 0 && values.max_internal >= 0;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? 'Edit Subject Marks Config' : 'Add Subject Marks Config'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Class"
            value={values.school_class ?? ''}
            onChange={(e) => handleChange('school_class', Number(e.target.value))}
            required
            fullWidth
            disabled={isEditing}
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Subject"
            value={values.subject ?? ''}
            onChange={(e) => handleChange('subject', Number(e.target.value))}
            required
            fullWidth
            disabled={isEditing}
          >
            {subjects.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Max Theory"
              type="number"
              value={values.max_theory}
              onChange={(e) => handleChange('max_theory', Number(e.target.value))}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              label="Max Internal"
              type="number"
              value={values.max_internal}
              onChange={(e) => handleChange('max_internal', Number(e.target.value))}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Stack>
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

// ---------- Marks Entry tab ----------

function MarksEntryTab({
  exams,
  subjects,
  subjectMarksConfigs,
  onSnackbar,
}: {
  exams: Exam[];
  subjects: Subject[];
  subjectMarksConfigs: SubjectMarksConfig[];
  onSnackbar: (message: string) => void;
}) {
  const [examId, setExamId] = useState<number | ''>('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [sections, setSections] = useState<Section[] | null>(null);
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [marksByStudent, setMarksByStudent] = useState<
    Record<number, { theory_marks: string; internal_marks: string; grade: string; is_published: boolean }>
  >({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchSections().then(setSections).catch(() => setRosterError('Could not load sections.'));
  }, []);

  const selectedExam = exams.find((e) => e.id === examId) ?? null;

  const marksConfig = useMemo(
    () => subjectMarksConfigs.find((c) => c.subject === subjectId && c.school_class === selectedExam?.school_class),
    [subjectMarksConfigs, subjectId, selectedExam],
  );

  useEffect(() => {
    if (!selectedExam || !subjectId || !sections) {
      setRoster(null);
      return;
    }
    setRoster(null);
    setRosterError(null);
    const classSections = sections.filter((s) => s.school_class === selectedExam.school_class);
    Promise.all([
      Promise.all(classSections.map((s) => fetchStudentsBySection(s.id))),
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
  }, [selectedExam, subjectId, sections]);

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
      onSnackbar(`Marks saved for ${roster.length} student(s).`);
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
      onSnackbar(`Published ${result.updated} marks entries.`);
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

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label="Exam"
          value={examId}
          onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 240 }}
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
          {subjects.map((s) => (
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
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', p: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<PublishIcon />}
                  onClick={handlePublish}
                  disabled={publishing || !!allPublished}
                >
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
    </Box>
  );
}
