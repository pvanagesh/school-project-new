import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
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
  Typography,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import { fetchClasses, fetchSections } from '../api/academics';
import { fetchExams } from '../api/exams';
import { PageHeader } from '../components/PageHeader';
import {
  fetchAttendanceReport,
  fetchEnrollmentReport,
  fetchFeeReport,
  fetchMarksReport,
} from '../api/reports';
import {
  ASSESSMENT_MODE_LABELS,
  PAYMENT_MODE_LABELS,
  type AttendanceReport,
  type EnrollmentReport,
  type Exam,
  type FeeReport,
  type MarksReport,
  type SchoolClass,
  type Section,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { exportTableToPdf, type PdfColumn } from '../utils/pdfExport';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchClasses(), fetchSections(), fetchExams()])
      .then(([c, s, e]) => {
        setClasses(c);
        setSections(s);
        setExams(e);
      })
      .catch(() => setError('Could not load classes/sections/exams from the API.'));
  }, []);

  const handleTabChange = (_e: SyntheticEvent, value: number) => setTab(value);

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !sections || !exams) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={AssessmentIcon} title="Reports" />

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
      >
        <Tab label="Attendance" />
        <Tab label="Marks / Report Card" />
        <Tab label="Fee Collection" />
        <Tab label="Enrollment" />
      </Tabs>

      {tab === 0 && <AttendanceReportTab classes={classes} sections={sections} />}
      {tab === 1 && <MarksReportTab exams={exams} sections={sections} />}
      {tab === 2 && <FeeReportTab classes={classes} sections={sections} />}
      {tab === 3 && <EnrollmentReportTab />}
    </Box>
  );
}

// ---------- Attendance report ----------

function AttendanceReportTab({ classes, sections }: { classes: SchoolClass[]; sections: Section[] }) {
  const [classId, setClassId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const filteredSections = useMemo(
    () => (classId ? sections.filter((s) => s.school_class === classId) : sections),
    [sections, classId],
  );

  const runReport = () => {
    setLoading(true);
    setError(null);
    setPage(0);
    fetchAttendanceReport({
      date_from: dateFrom,
      date_to: dateTo,
      ...(sectionId ? { section: sectionId } : classId ? { class: classId } : {}),
    })
      .then(setReport)
      .catch((err) => setError(firstApiError(err, 'Could not load the attendance report.')))
      .finally(() => setLoading(false));
  };

  useEffect(runReport, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    if (!report) return;
    const columns: PdfColumn[] = [
      { header: 'Student ID', key: 'student_id' },
      { header: 'Name', key: 'name' },
      { header: 'Class', key: 'class_name' },
      { header: 'Section', key: 'section_name' },
      { header: 'Present', key: 'present' },
      { header: 'Absent', key: 'absent' },
      { header: 'Late', key: 'late' },
      { header: 'Half Day', key: 'half_day' },
      { header: 'Attendance %', key: 'percentage' },
    ];
    const rows = report.rows.map((r) => ({
      ...r,
      percentage: r.percentage === null ? '—' : `${r.percentage}%`,
    }));
    exportTableToPdf(
      'Attendance Report',
      `${report.date_from} to ${report.date_to}`,
      columns,
      rows,
      `attendance-report-${report.date_from}-to-${report.date_to}`,
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value ? Number(e.target.value) : '');
            setSectionId('');
          }}
          sx={{ minWidth: 180 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All Classes</MenuItem>
          {classes.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 200 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All Sections</MenuItem>
          {filteredSections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {classById[s.school_class]?.name ?? '—'} - {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" onClick={runReport} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExport} disabled={!report || report.rows.length === 0}>
          Export PDF
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell align="right">Present</TableCell>
                  <TableCell align="right">Absent</TableCell>
                  <TableCell align="right">Late</TableCell>
                  <TableCell align="right">Half Day</TableCell>
                  <TableCell align="right">Attendance %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No students found for this filter.
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                  <TableRow key={r.student} hover>
                    <TableCell>{r.student_id}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.class_name}</TableCell>
                    <TableCell>{r.section_name}</TableCell>
                    <TableCell align="right">{r.present}</TableCell>
                    <TableCell align="right">{r.absent}</TableCell>
                    <TableCell align="right">{r.late}</TableCell>
                    <TableCell align="right">{r.half_day}</TableCell>
                    <TableCell align="right">{r.percentage === null ? '—' : `${r.percentage}%`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={report.rows.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
          <Stack direction="row" spacing={3} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Total Students: <strong>{report.summary.total_students}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Average Attendance:{' '}
              <strong>{report.summary.average_percentage === null ? '—' : `${report.summary.average_percentage}%`}</strong>
            </Typography>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ---------- Marks / report card ----------

function MarksReportTab({ exams, sections }: { exams: Exam[]; sections: Section[] }) {
  const [examId, setExamId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [report, setReport] = useState<MarksReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const selectedExam = useMemo(() => exams.find((e) => e.id === examId) ?? null, [exams, examId]);
  const filteredSections = useMemo(
    () => (selectedExam ? sections.filter((s) => s.school_class === selectedExam.school_class) : []),
    [sections, selectedExam],
  );

  const runReport = () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    setPage(0);
    fetchMarksReport({ exam: examId, ...(sectionId ? { section: sectionId } : {}) })
      .then(setReport)
      .catch((err) => setError(firstApiError(err, 'Could not load the marks report.')))
      .finally(() => setLoading(false));
  };

  const isBoardMarks = report?.mode === 'BOARD_MARKS';

  const handleExport = () => {
    if (!report) return;
    const columns: PdfColumn[] = [
      { header: 'Student ID', key: 'student_id' },
      { header: 'Name', key: 'name' },
      { header: 'Section', key: 'section_name' },
      ...report.subjects.map((s) => ({ header: s.name, key: `subject_${s.id}` })),
      ...(isBoardMarks
        ? [
            { header: 'Total', key: 'total_obtained' },
            { header: '%', key: 'percentage' },
          ]
        : []),
    ];
    const rows = report.rows.map((r) => {
      const row: Record<string, string | number> = {
        student_id: r.student_id,
        name: r.name,
        section_name: r.section_name,
        total_obtained: r.total_max ? `${r.total_obtained}/${r.total_max}` : '—',
        percentage: r.percentage === null ? '—' : `${r.percentage}%`,
      };
      report.subjects.forEach((s) => {
        const cell = r.marks[s.id];
        row[`subject_${s.id}`] = cell ? (isBoardMarks ? cell.total ?? '—' : cell.grade ?? '—') : '—';
      });
      return row;
    });
    exportTableToPdf(
      `Marks Report — ${report.exam.name}`,
      `${report.exam.school_class} · ${report.exam.term} · ${report.exam.academic_year}`,
      columns,
      rows,
      `marks-report-${report.exam.name}-${report.exam.school_class}`.replace(/\s+/g, '-'),
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Exam"
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value ? Number(e.target.value) : '');
            setSectionId('');
            setReport(null);
          }}
          sx={{ minWidth: 260 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">Select an exam</MenuItem>
          {exams.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name} — {e.school_class_name} ({e.academic_year_name})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 200 }}
          disabled={!selectedExam}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All Sections</MenuItem>
          {filteredSections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={runReport} disabled={!examId || loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExport} disabled={!report || report.rows.length === 0}>
          Export PDF
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <Paper variant="outlined">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              {report.exam.school_class} · {report.exam.term} · {report.exam.academic_year} ·{' '}
              {ASSESSMENT_MODE_LABELS[report.mode]}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Section</TableCell>
                  {report.subjects.map((s) => (
                    <TableCell key={s.id} align="center">
                      {s.name}
                    </TableCell>
                  ))}
                  {isBoardMarks && (
                    <>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">%</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3 + report.subjects.length + (isBoardMarks ? 2 : 0)} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No students found for this filter.
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                  <TableRow key={r.student} hover>
                    <TableCell>{r.student_id}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.section_name}</TableCell>
                    {report.subjects.map((s) => {
                      const cell = r.marks[s.id];
                      if (!cell) return <TableCell key={s.id} align="center">—</TableCell>;
                      return (
                        <TableCell key={s.id} align="center">
                          {isBoardMarks ? cell.total ?? '—' : cell.grade ?? '—'}
                          {!cell.is_published && (
                            <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 0.5 }}>
                              (unpub.)
                            </Typography>
                          )}
                        </TableCell>
                      );
                    })}
                    {isBoardMarks && (
                      <>
                        <TableCell align="right">{r.total_max ? `${r.total_obtained}/${r.total_max}` : '—'}</TableCell>
                        <TableCell align="right">{r.percentage === null ? '—' : `${r.percentage}%`}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={report.rows.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}
    </Box>
  );
}

// ---------- Fee collection report ----------

function FeeReportTab({ classes, sections }: { classes: SchoolClass[]; sections: Section[] }) {
  const [classId, setClassId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [report, setReport] = useState<FeeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const filteredSections = useMemo(
    () => (classId ? sections.filter((s) => s.school_class === classId) : sections),
    [sections, classId],
  );

  const runReport = () => {
    setLoading(true);
    setError(null);
    setPage(0);
    fetchFeeReport({
      date_from: dateFrom,
      date_to: dateTo,
      ...(sectionId ? { section: sectionId } : classId ? { class: classId } : {}),
    })
      .then(setReport)
      .catch((err) => setError(firstApiError(err, 'Could not load the fee collection report.')))
      .finally(() => setLoading(false));
  };

  useEffect(runReport, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    if (!report) return;
    const columns: PdfColumn[] = [
      { header: 'Date', key: 'date' },
      { header: 'Student ID', key: 'student_id' },
      { header: 'Name', key: 'student_name' },
      { header: 'Class', key: 'class_name' },
      { header: 'Section', key: 'section_name' },
      { header: 'Amount', key: 'amount' },
      { header: 'Mode', key: 'mode' },
      { header: 'Reference', key: 'reference_number' },
    ];
    const rows = report.rows.map((r) => ({
      ...r,
      amount: `₹${r.amount.toLocaleString('en-IN')}`,
      mode: PAYMENT_MODE_LABELS[r.mode] ?? r.mode,
    }));
    exportTableToPdf(
      'Fee Collection Report',
      `${report.date_from} to ${report.date_to}`,
      columns,
      rows,
      `fee-collection-report-${report.date_from}-to-${report.date_to}`,
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value ? Number(e.target.value) : '');
            setSectionId('');
          }}
          sx={{ minWidth: 180 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All Classes</MenuItem>
          {classes.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
          sx={{ minWidth: 200 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All Sections</MenuItem>
          {filteredSections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {classById[s.school_class]?.name ?? '—'} - {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" onClick={runReport} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExport} disabled={!report || report.rows.length === 0}>
          Export PDF
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Reference</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No payments found for this filter.
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                  <TableRow key={r.uid} hover>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.student_id}</TableCell>
                    <TableCell>{r.student_name}</TableCell>
                    <TableCell>{r.class_name}</TableCell>
                    <TableCell>{r.section_name}</TableCell>
                    <TableCell align="right">₹{r.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>{PAYMENT_MODE_LABELS[r.mode] ?? r.mode}</TableCell>
                    <TableCell>{r.reference_number || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={report.rows.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
          <Stack direction="row" spacing={3} sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Total Collected: <strong>₹{report.summary.total_amount.toLocaleString('en-IN')}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Payments: <strong>{report.summary.count}</strong>
            </Typography>
            {Object.entries(report.summary.by_mode).map(([mode, amount]) => (
              <Typography key={mode} variant="body2" color="text.secondary">
                {PAYMENT_MODE_LABELS[mode as keyof typeof PAYMENT_MODE_LABELS] ?? mode}:{' '}
                <strong>₹{amount.toLocaleString('en-IN')}</strong>
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ---------- Enrollment report ----------

function EnrollmentReportTab() {
  const [report, setReport] = useState<EnrollmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const runReport = () => {
    setLoading(true);
    setError(null);
    setPage(0);
    fetchEnrollmentReport()
      .then(setReport)
      .catch((err) => setError(firstApiError(err, 'Could not load the enrollment report.')))
      .finally(() => setLoading(false));
  };

  useEffect(runReport, []);

  const genderKeys = useMemo(() => (report ? Object.keys(report.summary.by_gender) : []), [report]);

  const handleExport = () => {
    if (!report) return;
    const columns: PdfColumn[] = [
      { header: 'Class', key: 'class_name' },
      { header: 'Section', key: 'section_name' },
      { header: 'Stream', key: 'stream' },
      ...genderKeys.map((g) => ({ header: g, key: `gender_${g}` })),
      { header: 'Total', key: 'total' },
    ];
    const rows = report.rows.map((r) => {
      const row: Record<string, string | number> = {
        class_name: r.class_name,
        section_name: r.section_name,
        stream: r.combination || r.stream || '—',
        total: r.total,
      };
      genderKeys.forEach((g) => {
        row[`gender_${g}`] = r.gender_breakdown[g] ?? 0;
      });
      return row;
    });
    exportTableToPdf('Enrollment Report', 'Current student headcount by class and section', columns, rows, 'enrollment-report');
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={runReport} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExport} disabled={!report || report.rows.length === 0}>
          Export PDF
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Stream</TableCell>
                  {genderKeys.map((g) => (
                    <TableCell key={g} align="right">
                      {g}
                    </TableCell>
                  ))}
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4 + genderKeys.length} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No students enrolled yet.
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r) => (
                  <TableRow key={`${r.class_name}-${r.section_name}-${r.stream}-${r.combination}`} hover>
                    <TableCell>{r.class_name}</TableCell>
                    <TableCell>{r.section_name}</TableCell>
                    <TableCell>{r.combination || r.stream || '—'}</TableCell>
                    {genderKeys.map((g) => (
                      <TableCell key={g} align="right">
                        {r.gender_breakdown[g] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell align="right">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={report.rows.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
          <Stack direction="row" spacing={3} sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Total Students: <strong>{report.summary.total_students}</strong>
            </Typography>
            {Object.entries(report.summary.by_gender).map(([gender, count]) => (
              <Typography key={gender} variant="body2" color="text.secondary">
                {gender}: <strong>{count}</strong>
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
