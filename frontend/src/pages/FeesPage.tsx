import { useEffect, useState, type SyntheticEvent } from 'react';
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
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import { useAuth } from '../auth/AuthContext';
import { fetchAcademicYears } from '../api/core';
import { fetchClasses } from '../api/academics';
import { PageHeader } from '../components/PageHeader';
import {
  createFeeCategory,
  createFeeStructure,
  createPayment,
  createPaymentAdjustment,
  deleteFeeCategory,
  deleteFeeStructure,
  deletePaymentAdjustment,
  fetchFeeCategories,
  fetchFeeStructures,
  fetchPaymentAdjustments,
  fetchPayments,
  updateFeeCategory,
  updateFeeStructure,
} from '../api/fees';
import { fetchStudents } from '../api/students';
import {
  PAYMENT_MODE_LABELS,
  STREAM_LABELS,
  type AcademicYear,
  type FeeCategory,
  type FeeCategoryFormValues,
  type FeeStructure,
  type FeeStructureFormValues,
  type Payment,
  type PaymentAdjustment,
  type PaymentAdjustmentFormValues,
  type PaymentFormValues,
  type PaymentModeValue,
  type SchoolClass,
  type Student,
  type StreamValue,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_CATEGORY_FORM: FeeCategoryFormValues = { name: '' };
const EMPTY_STRUCTURE_FORM: FeeStructureFormValues = {
  school_class: null,
  stream: null,
  category: null,
  amount: null,
  academic_year: null,
};
const EMPTY_PAYMENT_FORM: PaymentFormValues = {
  student: null,
  amount: null,
  mode: null,
  reference_number: '',
  date: new Date().toISOString().slice(0, 10),
};
const EMPTY_ADJUSTMENT_FORM: PaymentAdjustmentFormValues = { payment: null, adjustment_amount: null, reason: '' };

const FEES_WRITE_ROLES = ['SUPER_ADMIN', 'ACCOUNTANT'];

export function FeesPage() {
  const { user } = useAuth();
  const canWrite = !!user?.role_name && FEES_WRITE_ROLES.includes(user.role_name);
  const [tab, setTab] = useState(0);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [categories, setCategories] = useState<FeeCategory[] | null>(null);
  const [structures, setStructures] = useState<FeeStructure[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [adjustments, setAdjustments] = useState<PaymentAdjustment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const loadAll = () => {
    Promise.all([
      fetchClasses(),
      fetchAcademicYears(),
      fetchStudents(),
      fetchFeeCategories(),
      fetchFeeStructures(),
      fetchPayments(),
      fetchPaymentAdjustments(),
    ])
      .then(([c, y, st, cat, struct, pay, adj]) => {
        setClasses(c);
        setAcademicYears(y);
        setStudents(st);
        setCategories(cat);
        setStructures(struct);
        setPayments(pay);
        setAdjustments(adj);
      })
      .catch(() => setError('Could not load fees data from the API.'));
  };

  useEffect(loadAll, []);

  const handleTabChange = (_e: SyntheticEvent, value: number) => setTab(value);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !academicYears || !students || !categories || !structures || !payments || !adjustments) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={PaymentsIcon} title="Fees" />

      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have read-only access to Fees. Recording payments and editing fee structures is handled by Accounts.
        </Alert>
      )}

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Fee Categories" />
        <Tab label="Fee Structures" />
        <Tab label="Payments" />
        <Tab label="Adjustments" />
      </Tabs>

      {tab === 0 && (
        <CategoriesTab categories={categories} canWrite={canWrite} onChanged={(m) => { setSnackbar(m); loadAll(); }} />
      )}
      {tab === 1 && (
        <StructuresTab
          structures={structures}
          classes={classes}
          categories={categories}
          academicYears={academicYears}
          canWrite={canWrite}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}
      {tab === 2 && (
        <PaymentsTab
          payments={payments}
          students={students}
          canWrite={canWrite}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}
      {tab === 3 && (
        <AdjustmentsTab
          adjustments={adjustments}
          payments={payments}
          canWrite={canWrite}
          onChanged={(m) => { setSnackbar(m); loadAll(); }}
        />
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

// ---------- Fee Categories tab ----------

function CategoriesTab({
  categories,
  canWrite,
  onChanged,
}: {
  categories: FeeCategory[];
  canWrite: boolean;
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFeeCategory(deleteTarget.id);
      onChanged(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this category.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      {canWrite && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Category
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                {canWrite && (
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(c);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No fee categories yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {canWrite && dialogOpen && (
        <CategoryFormDialog
          category={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete category?</DialogTitle>
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
    </Paper>
  );
}

function CategoryFormDialog({
  category,
  onClose,
  onSaved,
}: {
  category: FeeCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<FeeCategoryFormValues>(EMPTY_CATEGORY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!category;

  useEffect(() => {
    setValues(category ? { name: category.name } : EMPTY_CATEGORY_FORM);
  }, [category]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateFeeCategory(category.id, values);
        onSaved(`Updated ${values.name}.`);
      } else {
        await createFeeCategory(values);
        onSaved(`Created ${values.name}.`);
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save category.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? `Edit ${category.name}` : 'Add Fee Category'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            onChange={(e) => setValues({ name: e.target.value })}
            placeholder="e.g. Tuition Fee"
            required
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

// ---------- Fee Structures tab ----------

function StructuresTab({
  structures,
  classes,
  categories,
  academicYears,
  canWrite,
  onChanged,
}: {
  structures: FeeStructure[];
  classes: SchoolClass[];
  categories: FeeCategory[];
  academicYears: AcademicYear[];
  canWrite: boolean;
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeStructure | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFeeStructure(deleteTarget.id);
      onChanged(`Deleted fee structure for ${deleteTarget.school_class_name}.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this fee structure.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      {canWrite && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Structure
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Stream</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Academic Year</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {structures.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.school_class_name}</TableCell>
                <TableCell>{s.stream ? STREAM_LABELS[s.stream] : '—'}</TableCell>
                <TableCell>{s.category_name}</TableCell>
                <TableCell align="right">₹{s.amount}</TableCell>
                <TableCell>{s.academic_year_name}</TableCell>
                {canWrite && (
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditing(s);
                        setDialogOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(s);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {structures.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No fee structures yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {canWrite && dialogOpen && (
        <StructureFormDialog
          structure={editing}
          classes={classes}
          categories={categories}
          academicYears={academicYears}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete fee structure?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>This permanently deletes this fee structure. This cannot be undone.</Typography>
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

function StructureFormDialog({
  structure,
  classes,
  categories,
  academicYears,
  onClose,
  onSaved,
}: {
  structure: FeeStructure | null;
  classes: SchoolClass[];
  categories: FeeCategory[];
  academicYears: AcademicYear[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<FeeStructureFormValues>(EMPTY_STRUCTURE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!structure;

  useEffect(() => {
    setValues(
      structure
        ? {
            school_class: structure.school_class,
            stream: structure.stream,
            category: structure.category,
            amount: Number(structure.amount),
            academic_year: structure.academic_year,
          }
        : EMPTY_STRUCTURE_FORM,
    );
  }, [structure]);

  const handleChange = <K extends keyof FeeStructureFormValues>(field: K, value: FeeStructureFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateFeeStructure(structure.id, values);
        onSaved('Updated fee structure.');
      } else {
        await createFeeStructure(values);
        onSaved('Created fee structure.');
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save fee structure.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.school_class && values.category && values.amount != null && values.academic_year;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? 'Edit Fee Structure' : 'Add Fee Structure'}</DialogTitle>
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
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Stream (optional)"
            value={values.stream ?? ''}
            onChange={(e) => handleChange('stream', (e.target.value || null) as StreamValue | null)}
            fullWidth
          >
            <MenuItem value="">
              <em>Not set</em>
            </MenuItem>
            {(Object.keys(STREAM_LABELS) as StreamValue[]).map((s) => (
              <MenuItem key={s} value={s}>
                {STREAM_LABELS[s]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Category"
            value={values.category ?? ''}
            onChange={(e) => handleChange('category', Number(e.target.value))}
            required
            fullWidth
          >
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Amount"
            type="number"
            value={values.amount ?? ''}
            onChange={(e) => handleChange('amount', e.target.value ? Number(e.target.value) : null)}
            required
            fullWidth
            slotProps={{ htmlInput: { min: 0 } }}
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

// ---------- Payments tab ----------

function PaymentsTab({
  payments,
  students,
  canWrite,
  onChanged,
}: {
  payments: Payment[];
  students: Student[];
  canWrite: boolean;
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Paper variant="outlined">
      {canWrite && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Record Payment
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student ID</TableCell>
              <TableCell>Student</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Recorded By</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.student_id_code}</TableCell>
                <TableCell>{p.student_name}</TableCell>
                <TableCell align="right">₹{p.amount}</TableCell>
                <TableCell>{PAYMENT_MODE_LABELS[p.mode]}</TableCell>
                <TableCell>{p.reference_number || '—'}</TableCell>
                <TableCell>{p.date}</TableCell>
                <TableCell>{p.recorded_by_username ?? '—'}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No payments recorded yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {canWrite && dialogOpen && (
        <PaymentFormDialog
          students={students}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}
    </Paper>
  );
}

function PaymentFormDialog({
  students,
  onClose,
  onSaved,
}: {
  students: Student[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<PaymentFormValues>(EMPTY_PAYMENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleChange = <K extends keyof PaymentFormValues>(field: K, value: PaymentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createPayment(values);
      onSaved('Payment recorded.');
    } catch (err) {
      setFormError(firstApiError(err, 'Could not record this payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.student && values.amount != null && values.mode && values.date;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>Record Payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Alert severity="info">Payments are immutable receipts — they cannot be edited or deleted once saved.</Alert>
          <TextField
            select
            label="Student"
            value={values.student ?? ''}
            onChange={(e) => handleChange('student', Number(e.target.value))}
            required
            fullWidth
          >
            {students.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.student_id} - {s.first_name} {s.last_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Amount"
            type="number"
            value={values.amount ?? ''}
            onChange={(e) => handleChange('amount', e.target.value ? Number(e.target.value) : null)}
            required
            fullWidth
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField
            select
            label="Mode"
            value={values.mode ?? ''}
            onChange={(e) => handleChange('mode', e.target.value as PaymentModeValue)}
            required
            fullWidth
          >
            {(Object.keys(PAYMENT_MODE_LABELS) as PaymentModeValue[]).map((m) => (
              <MenuItem key={m} value={m}>
                {PAYMENT_MODE_LABELS[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reference number (optional)"
            value={values.reference_number}
            onChange={(e) => handleChange('reference_number', e.target.value)}
            fullWidth
          />
          <TextField
            label="Date"
            type="date"
            value={values.date}
            onChange={(e) => handleChange('date', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !isValid}>
          {submitting ? 'Saving…' : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- Adjustments tab ----------

function AdjustmentsTab({
  adjustments,
  payments,
  canWrite,
  onChanged,
}: {
  adjustments: PaymentAdjustment[];
  payments: Payment[];
  canWrite: boolean;
  onChanged: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentAdjustment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePaymentAdjustment(deleteTarget.id);
      onChanged('Deleted adjustment.');
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(firstApiError(err, 'Could not delete this adjustment.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined">
      {canWrite && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} disabled={payments.length === 0}>
            Add Adjustment
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Payment</TableCell>
              <TableCell align="right">Original Amount</TableCell>
              <TableCell align="right">Adjustment</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Created</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {adjustments.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.payment_student_name}</TableCell>
                <TableCell align="right">₹{a.payment_amount}</TableCell>
                <TableCell align="right">₹{a.adjustment_amount}</TableCell>
                <TableCell>{a.reason}</TableCell>
                <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                {canWrite && (
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(a);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {adjustments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No adjustments yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {canWrite && dialogOpen && (
        <AdjustmentFormDialog
          payments={payments}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setDialogOpen(false);
            onChanged(m);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={ignoreBackdropClick(() => setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Delete adjustment?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>This permanently deletes this adjustment. This cannot be undone.</Typography>
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

function AdjustmentFormDialog({
  payments,
  onClose,
  onSaved,
}: {
  payments: Payment[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<PaymentAdjustmentFormValues>(EMPTY_ADJUSTMENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createPaymentAdjustment(values);
      onSaved('Adjustment added.');
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save this adjustment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = values.payment && values.adjustment_amount != null && values.reason;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="xs" fullWidth>
      <DialogTitle>Add Adjustment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select
            label="Payment"
            value={values.payment ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, payment: Number(e.target.value) }))}
            required
            fullWidth
          >
            {payments.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.student_name} - ₹{p.amount} ({p.date})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Adjustment amount"
            type="number"
            helperText="Use a negative value for a refund/waiver, positive for an additional charge."
            value={values.adjustment_amount ?? ''}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, adjustment_amount: e.target.value ? Number(e.target.value) : null }))
            }
            required
            fullWidth
          />
          <TextField
            label="Reason"
            value={values.reason}
            onChange={(e) => setValues((prev) => ({ ...prev, reason: e.target.value }))}
            multiline
            minRows={2}
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
