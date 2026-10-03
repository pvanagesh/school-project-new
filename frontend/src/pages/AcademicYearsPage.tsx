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
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import { createAcademicYear, deleteAcademicYear, fetchAcademicYears, updateAcademicYear } from '../api/core';
import { PageHeader } from '../components/PageHeader';
import type { AcademicYear, AcademicYearFormValues } from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_FORM: AcademicYearFormValues = {
  name: '',
  start_date: '',
  end_date: '',
  is_active: false,
};

export function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAll = () => {
    fetchAcademicYears()
      .then(setYears)
      .catch(() => setError('Could not load academic years from the API.'));
  };

  useEffect(loadAll, []);

  const openCreateDialog = () => {
    setEditingYear(null);
    setDialogOpen(true);
  };

  const openEditDialog = (year: AcademicYear) => {
    setEditingYear(year);
    setDialogOpen(true);
  };

  const handleSaved = (message: string) => {
    setDialogOpen(false);
    setSnackbar(message);
    loadAll();
  };

  const openDeleteDialog = (year: AcademicYear) => {
    setDeleteError(null);
    setDeleteTarget(year);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAcademicYear(deleteTarget.id);
      setSnackbar(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this academic year.'));
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!years) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={EventNoteIcon} title="Academic Years" />

      <Paper variant="outlined">
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Academic Year
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id} hover>
                  <TableCell>{y.name}</TableCell>
                  <TableCell>{y.start_date}</TableCell>
                  <TableCell>{y.end_date}</TableCell>
                  <TableCell>
                    <Chip size="small" color={y.is_active ? 'success' : 'default'} label={y.is_active ? 'Active' : 'Inactive'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEditDialog(y)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openDeleteDialog(y)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {years.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No academic years yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <AcademicYearFormDialog
        open={dialogOpen}
        year={editingYear}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete academic year?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            This permanently deletes <strong>{deleteTarget?.name}</strong>. This cannot be undone.
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

function AcademicYearFormDialog({
  open,
  year,
  onClose,
  onSaved,
}: {
  open: boolean;
  year: AcademicYear | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<AcademicYearFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!year;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setValues(
      year
        ? { name: year.name, start_date: year.start_date, end_date: year.end_date, is_active: year.is_active }
        : EMPTY_FORM,
    );
  }, [open, year]);

  const handleChange = <K extends keyof AcademicYearFormValues>(field: K, value: AcademicYearFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateAcademicYear(year.id, values);
        onSaved(`Updated ${values.name}.`);
      } else {
        await createAcademicYear(values);
        onSaved(`Created ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save academic year.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.name && values.start_date && values.end_date && values.start_date <= values.end_date;

  return (
    <Dialog open={open} onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${year.name}` : 'Add Academic Year'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. 2026-27"
            required
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={values.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              value={values.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
              error={!!values.start_date && !!values.end_date && values.start_date > values.end_date}
              helperText={
                values.start_date && values.end_date && values.start_date > values.end_date
                  ? 'End date must be on or after the start date.'
                  : undefined
              }
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch checked={values.is_active} onChange={(e) => handleChange('is_active', e.target.checked)} />
            }
            label="Active"
          />
          {values.is_active && (
            <Alert severity="info">Marking this active will automatically deactivate any other active academic year.</Alert>
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
