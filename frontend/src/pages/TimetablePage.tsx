// import { Fragment, useEffect, useMemo, useState } from 'react';
// import {
//   Alert,
//   Box,
//   Button,
//   CircularProgress,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   IconButton,
//   MenuItem,
//   Paper,
//   Snackbar,
//   Stack,
//   Tab,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Tabs,
//   TextField,
//   Typography,
// } from '@mui/material';
// import AddIcon from '@mui/icons-material/AddOutlined';
// import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
// import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
// import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
// import DeleteIcon from '@mui/icons-material/DeleteOutlined';
// import HistoryIcon from '@mui/icons-material/HistoryOutlined';
// import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
// import {
//   createTimetableSlot,
//   deleteAITimetableHistory,
//   deleteTimetableSlot,
//   fetchAITimetableHistory,
//   fetchClasses,
//   fetchCommonRooms,
//   fetchSectionSubjects,
//   fetchSections,
//   fetchSubjects,
//   fetchTimetable,
//   fetchTimetableByTeacher,
//   generateAITimetable,
//   updateTimetableSlot,
// } from '../api/academics';
// import { fetchTeachers } from '../api/teachers';
// import {
//   AI_PROVIDERS,
//   DAY_LABELS,
//   DAYS,
//   PERIODS,
//   PERIOD_BREAKS,
//   PERIOD_TIMES,
//   type AITimetableHistoryItem,
//   type AITimetableRequestValues,
//   type AITimetableResult,
//   type CommonRoom,
//   type DayValue,
//   type SchoolClass,
//   type Section,
//   type SectionSubject,
//   type Subject,
//   type Teacher,
//   type TimetableFormValues,
//   type TimetableSlot,
// } from '../types';
// import { firstApiError } from '../utils/apiError';
// import { ignoreBackdropClick } from '../utils/dialog';

// const EMPTY_AI_FORM: AITimetableRequestValues = {
//   provider: '',
//   model: '',
//   extra_instructions: '',
//   class_names: [],
// };

// const EMPTY_FORM: TimetableFormValues = {
//   section: null,
//   subject: null,
//   teacher: null,
//   day_of_week: null,
//   period: null,
//   start_time: '',
//   end_time: '',
//   classroom: '',
// };

// export function TimetablePage() {
//   const [classes, setClasses] = useState<SchoolClass[] | null>(null);
//   const [sections, setSections] = useState<Section[] | null>(null);
//   const [teachers, setTeachers] = useState<Teacher[] | null>(null);
//   const [subjects, setSubjects] = useState<Subject[] | null>(null);
//   const [sectionSubjects, setSectionSubjects] = useState<SectionSubject[] | null>(null);
//   const [commonRooms, setCommonRooms] = useState<CommonRoom[]>([]);
//   const [error, setError] = useState<string | null>(null);
//   const [snackbar, setSnackbar] = useState<string | null>(null);

//   const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');

//   const [sectionId, setSectionId] = useState<number | ''>('');
//   const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
//   const [slotsError, setSlotsError] = useState<string | null>(null);

//   const [teacherId, setTeacherId] = useState<number | ''>('');
//   const [teacherSlots, setTeacherSlots] = useState<TimetableSlot[] | null>(null);
//   const [teacherSlotsError, setTeacherSlotsError] = useState<string | null>(null);

//   const [dialogTarget, setDialogTarget] = useState<{ day: DayValue; period: number; slot: TimetableSlot | null } | null>(
//     null,
//   );
//   const [aiDialogOpen, setAiDialogOpen] = useState(false);
//   const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

//   const classById = useMemo(() => {
//     const map: Record<number, SchoolClass> = {};
//     classes?.forEach((c) => (map[c.id] = c));
//     return map;
//   }, [classes]);

//   useEffect(() => {
//     Promise.all([
//       fetchClasses(),
//       fetchSections(),
//       fetchTeachers(),
//       fetchSubjects(),
//       fetchSectionSubjects(),
//       fetchCommonRooms(),
//     ])
//       .then(([c, s, t, subj, ss, rooms]) => {
//         setClasses(c);
//         setSections(s);
//         setTeachers(t);
//         setSubjects(subj);
//         setSectionSubjects(ss);
//         setCommonRooms(rooms);
//       })
//       .catch(() => setError('Could not load classes/sections/teachers/subjects from the API.'));
//   }, []);

//   const loadSlots = (id: number) => {
//     fetchTimetable(id)
//       .then(setSlots)
//       .catch(() => setSlotsError('Could not load the timetable for this section.'));
//   };

//   useEffect(() => {
//     if (!sectionId) {
//       setSlots(null);
//       return;
//     }
//     setSlotsError(null);
//     loadSlots(sectionId);
//   }, [sectionId]);

//   const selectedSection = sections?.find((s) => s.id === sectionId) ?? null;

//   const sectionById = useMemo(() => {
//     const map: Record<number, Section> = {};
//     sections?.forEach((s) => (map[s.id] = s));
//     return map;
//   }, [sections]);

//   const selectedTeacher = teachers?.find((t) => t.id === teacherId) ?? null;

//   // Section.class_teacher is a homeroom assignment, independent of the
//   // subjects a teacher teaches — a teacher can be the designated Class
//   // Teacher of at most one section (assigned on the Classes & Sections page).
//   const classTeacherOfSection = sections?.find((s) => s.class_teacher === teacherId) ?? null;

//   useEffect(() => {
//     if (!teacherId) {
//       setTeacherSlots(null);
//       return;
//     }
//     setTeacherSlots(null);
//     setTeacherSlotsError(null);
//     fetchTimetableByTeacher(teacherId)
//       .then(setTeacherSlots)
//       .catch(() => setTeacherSlotsError("Could not load this teacher's timetable."));
//   }, [teacherId]);

//   const availableSubjects = useMemo(() => {
//     if (!sectionId || !sectionSubjects || !subjects) return [];
//     const subjectIds = new Set(sectionSubjects.filter((ss) => ss.section === sectionId).map((ss) => ss.subject));
//     return subjects.filter((s) => subjectIds.has(s.id));
//   }, [sectionId, sectionSubjects, subjects]);

//   const breakAfter = (period: number) => PERIOD_BREAKS.find((b) => b.afterPeriod === period);

//   const slotFor = (day: DayValue, period: number) => slots?.find((s) => s.day_of_week === day && s.period === period) ?? null;
//   const teacherSlotFor = (day: DayValue, period: number) =>
//     teacherSlots?.find((s) => s.day_of_week === day && s.period === period) ?? null;

//   const handleSaved = (message: string) => {
//     setDialogTarget(null);
//     setSnackbar(message);
//     if (sectionId) loadSlots(sectionId);
//   };

//   if (error) return <Alert severity="error">{error}</Alert>;

//   if (!classes || !sections || !teachers || !subjects || !sectionSubjects) {
//     return (
//       <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   return (
//     <Box>
//       <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
//         <Typography variant="h4">Timetable</Typography>
//         <Stack direction="row" spacing={1}>
//           <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryDialogOpen(true)}>
//             AI History
//           </Button>
//           <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => setAiDialogOpen(true)}>
//             Generate with AI
//           </Button>
//         </Stack>
//       </Stack>

//       <Tabs value={viewMode} onChange={(_e, v) => setViewMode(v)} sx={{ mb: 3 }}>
//         <Tab label="By Class" value="class" />
//         <Tab label="By Teacher" value="teacher" />
//       </Tabs>

//       {viewMode === 'class' && (
//         <>
//           <TextField
//             select
//             label="Section"
//             value={sectionId}
//             onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
//             sx={{ maxWidth: 420, mb: 3 }}
//             fullWidth
//           >
//             {sections.length === 0 && <MenuItem value="">No sections yet</MenuItem>}
//             {sections.map((s) => (
//               <MenuItem key={s.id} value={s.id}>
//                 {classById[s.school_class]?.name ?? '—'} - {s.name}
//                 {s.stream ? ` (${s.stream})` : ''}
//               </MenuItem>
//             ))}
//           </TextField>

//           {selectedSection && (
//             <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
//               <CastForEducationIcon fontSize="small" color="action" />
//               <Typography variant="body2" color="text.secondary">
//                 Class Teacher:{' '}
//                 {selectedSection.class_teacher_name ? (
//                   <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
//                     {selectedSection.class_teacher_name}
//                   </Typography>
//                 ) : (
//                   'Unassigned'
//                 )}
//               </Typography>
//             </Stack>
//           )}

//           {slotsError && <Alert severity="error">{slotsError}</Alert>}

//           {selectedSection && !slots && !slotsError && (
//             <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
//               <CircularProgress />
//             </Box>
//           )}

//           {selectedSection && slots && (
//             <>
//               {availableSubjects.length === 0 && (
//                 <Alert severity="warning" sx={{ mb: 2 }}>
//                   No subjects are assigned to this section yet. Assign subjects on the Classes & Sections page's
//                   Subject Assignment tab before building a timetable.
//                 </Alert>
//               )}
//               <Paper
//   variant="outlined"
//   sx={{
//     flex: 1,
//     minHeight: 0,
//     overflow: 'hidden',
//   }}
// >
//   <TableContainer
//     sx={{
//       height: '100%',
//       maxHeight: '100%',
//       overflow: 'auto',
//     }}
//   >
//                   <Table size="small">
//                     <TableHead>
//                       <TableRow>
//                         <TableCell sx={{ padding: '4px 8px' }}>Day</TableCell>
//                         {PERIODS.map((p) => {
//                           const brk = breakAfter(p);
//                           return (
//                             <Fragment key={p}>
//                               <TableCell sx={{ padding: '4px 8px' }}>
//                                 P{p}
//                                 <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
//                                   {PERIOD_TIMES[p]}
//                                 </Typography>
//                               </TableCell>
//                               {brk && (
//                                 <TableCell
//                                   title={`${brk.label} · ${brk.time}`}
//                                   sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
//                                 />
//                               )}
//                             </Fragment>
//                           );
//                         })}
//                       </TableRow>
//                     </TableHead>
//                     <TableBody>
//                       {DAYS.map((day) => (
//                         <TableRow key={day}>
//                           <TableCell sx={{ padding: '4px 8px' }}>{DAY_LABELS[day]}</TableCell>
//                           {PERIODS.map((period) => {
//                             const slot = slotFor(day, period);
//                             const brk = breakAfter(period);
//                             return (
//                               <Fragment key={period}>
//                                 <TableCell sx={{ minWidth: 68, verticalAlign: 'top', padding: '4px 6px' }}>
//                                   {slot ? (
//                                     <Box
//                                       onClick={() => setDialogTarget({ day, period, slot })}
//                                       sx={{
//                                         cursor: 'pointer',
//                                         p: 0.5,
//                                         borderRadius: 1,
//                                         bgcolor: 'action.hover',
//                                         '&:hover': { bgcolor: 'action.selected' },
//                                       }}
//                                     >
//                                       <Typography variant="body2" sx={{ fontWeight: 600 }}>
//                                         {slot.subject_name}
//                                       </Typography>
//                                       <Typography variant="caption" sx={{ display: 'block' }}>
//                                         {slot.teacher_name}
//                                       </Typography>
//                                       <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
//                                         {slot.classroom}
//                                       </Typography>
//                                     </Box>
//                                   ) : (
//                                     <IconButton
//                                       size="small"
//                                       title="Add"
//                                       onClick={() => setDialogTarget({ day, period, slot: null })}
//                                       disabled={availableSubjects.length === 0}
//                                     >
//                                       <AddIcon fontSize="small" />
//                                     </IconButton>
//                                   )}
//                                 </TableCell>
//                                 {brk && (
//                                   <TableCell
//                                     title={`${brk.label} · ${brk.time}`}
//                                     sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
//                                   />
//                                 )}
//                               </Fragment>
//                             );
//                           })}
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </TableContainer>
//               </Paper>
//             </>
//           )}
//         </>
//       )}

//       {viewMode === 'teacher' && (
//         <>
//           <TextField
//             select
//             label="Teacher"
//             value={teacherId}
//             onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : '')}
//             sx={{ maxWidth: 420, mb: 3 }}
//             fullWidth
//           >
//             {teachers.length === 0 && <MenuItem value="">No teachers yet</MenuItem>}
//             {teachers.map((t) => (
//               <MenuItem key={t.id} value={t.id}>
//                 {t.first_name} {t.last_name} ({t.subject_specialization})
//               </MenuItem>
//             ))}
//           </TextField>

//           {selectedTeacher && (
//             <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
//               <CastForEducationIcon fontSize="small" color="action" />
//               <Typography variant="body2" color="text.secondary">
//                 Designation:{' '}
//                 <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
//                   {classTeacherOfSection
//                     ? `Class Teacher of ${classById[classTeacherOfSection.school_class]?.name ?? '—'} - ${classTeacherOfSection.name}`
//                     : 'Subject Teacher'}
//                 </Typography>
//               </Typography>
//             </Stack>
//           )}

//           {teacherSlotsError && <Alert severity="error">{teacherSlotsError}</Alert>}

//           {teacherId && !teacherSlots && !teacherSlotsError && (
//             <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
//               <CircularProgress />
//             </Box>
//           )}

//           {teacherId && teacherSlots && (
//             <>
//               {teacherSlots.length === 0 && (
//                 <Alert severity="info" sx={{ mb: 2 }}>
//                   This teacher has no timetable slots yet.
//                 </Alert>
//               )}
//               <Paper
//   variant="outlined"
//   sx={{
//     flex: 1,
//     minHeight: 0,
//     overflow: 'hidden',
//   }}
// >
//   <TableContainer
//     sx={{
//       height: '100%',
//       maxHeight: '100%',
//       overflow: 'auto',
//     }}
//   >
//                   <Table size="small">
//                     <TableHead>
//                       <TableRow>
//                         <TableCell sx={{ padding: '4px 8px' }}>Day</TableCell>
//                         {PERIODS.map((p) => {
//                           const brk = breakAfter(p);
//                           return (
//                             <Fragment key={p}>
//                               <TableCell sx={{ padding: '4px 8px' }}>
//                                 P{p}
//                                 <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
//                                   {PERIOD_TIMES[p]}
//                                 </Typography>
//                               </TableCell>
//                               {brk && (
//                                 <TableCell
//                                   title={`${brk.label} · ${brk.time}`}
//                                   sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
//                                 />
//                               )}
//                             </Fragment>
//                           );
//                         })}
//                       </TableRow>
//                     </TableHead>
//                     <TableBody>
//                       {DAYS.map((day) => (
//                         <TableRow key={day}>
//                           <TableCell sx={{ padding: '4px 8px' }}>{DAY_LABELS[day]}</TableCell>
//                           {PERIODS.map((period) => {
//                             const slot = teacherSlotFor(day, period);
//                             const slotSection = slot ? sectionById[slot.section] : null;
//                             const brk = breakAfter(period);
//                             return (
//                               <Fragment key={period}>
//                                 <TableCell sx={{ minWidth: 68, verticalAlign: 'top', padding: '4px 6px' }}>
//                                   {slot ? (
//                                     <Box sx={{ p: 0.5, borderRadius: 1, bgcolor: 'action.hover' }}>
//                                       <Typography variant="body2" sx={{ fontWeight: 600 }}>
//                                         {slot.subject_name}
//                                       </Typography>
//                                       <Typography variant="caption" sx={{ display: 'block' }}>
//                                         {slotSection
//                                           ? `${classById[slotSection.school_class]?.name ?? '—'} - ${slotSection.name}`
//                                           : '—'}
//                                       </Typography>
//                                       <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
//                                         {slot.classroom}
//                                       </Typography>
//                                     </Box>
//                                   ) : null}
//                                 </TableCell>
//                                 {brk && (
//                                   <TableCell
//                                     title={`${brk.label} · ${brk.time}`}
//                                     sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
//                                   />
//                                 )}
//                               </Fragment>
//                             );
//                           })}
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </TableContainer>
//               </Paper>
//             </>
//           )}
//         </>
//       )}

//       {dialogTarget && selectedSection && (
//         <SlotFormDialog
//           section={selectedSection}
//           day={dialogTarget.day}
//           period={dialogTarget.period}
//           slot={dialogTarget.slot}
//           subjects={availableSubjects}
//           teachers={teachers}
//           commonRooms={commonRooms}
//           onClose={() => setDialogTarget(null)}
//           onSaved={handleSaved}
//         />
//       )}

//       {aiDialogOpen && <AIGenerateDialog classes={classes} onClose={() => setAiDialogOpen(false)} />}

//       {historyDialogOpen && <AIHistoryDialog onClose={() => setHistoryDialogOpen(false)} />}

//       <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
//     </Box>
//   );
// }

// function AIGenerateDialog({ classes, onClose }: { classes: SchoolClass[]; onClose: () => void }) {
//   const [values, setValues] = useState<AITimetableRequestValues>(EMPTY_AI_FORM);
//   const [submitting, setSubmitting] = useState(false);
//   const [formError, setFormError] = useState<string | null>(null);
//   const [result, setResult] = useState<AITimetableResult | null>(null);
//   const [copied, setCopied] = useState(false);

//   const handleChange = <K extends keyof AITimetableRequestValues>(field: K, value: AITimetableRequestValues[K]) => {
//     setValues((prev) => ({ ...prev, [field]: value }));
//   };

//   const handleGenerate = async () => {
//     setSubmitting(true);
//     setFormError(null);
//     try {
//       const data = await generateAITimetable(values);
//       setResult(data);
//     } catch (err) {
//       setFormError(firstApiError(err, 'Could not generate a timetable. Is the AI service running?'));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleCopy = async () => {
//     if (!result) return;
//     await navigator.clipboard.writeText(result.raw_output);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   return (
//     <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="md" fullWidth>
//       <DialogTitle>Generate Timetable with AI</DialogTitle>
//       <DialogContent>
//         <Stack spacing={2} sx={{ mt: 1 }}>
//           {formError && <Alert severity="error">{formError}</Alert>}

//           {!result && (
//             <>
//               <Alert severity="info">
//                 This sends your current classes, sections, subjects and teachers to the AI service and proposes a
//                 timetable. Nothing is saved automatically — review the output and enter slots yourself on this page.
//               </Alert>

//               <TextField
//                 select
//                 label="Provider"
//                 value={values.provider}
//                 onChange={(e) => handleChange('provider', e.target.value)}
//                 slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
//                 fullWidth
//               >
//                 {AI_PROVIDERS.map((p) => (
//                   <MenuItem key={p.value} value={p.value}>
//                     {p.label}
//                   </MenuItem>
//                 ))}
//               </TextField>

//               <TextField
//                 label="Model override (optional)"
//                 value={values.model}
//                 onChange={(e) => handleChange('model', e.target.value)}
//                 placeholder="Leave blank to use the provider's default model"
//                 fullWidth
//               />

//               <TextField
//                 select
//                 label="Limit to classes (optional)"
//                 value={values.class_names}
//                 onChange={(e) => {
//                   const v = e.target.value;
//                   handleChange('class_names', typeof v === 'string' ? v.split(',') : v);
//                 }}
//                 slotProps={{ select: { multiple: true } }}
//                 helperText="Leave empty to generate for the whole school"
//                 fullWidth
//               >
//                 {classes.map((c) => (
//                   <MenuItem key={c.id} value={c.name}>
//                     {c.name}
//                   </MenuItem>
//                 ))}
//               </TextField>

//               <TextField
//                 label="Additional instructions (optional)"
//                 value={values.extra_instructions}
//                 onChange={(e) => handleChange('extra_instructions', e.target.value)}
//                 multiline
//                 minRows={3}
//                 fullWidth
//               />

//               {submitting && (
//                 <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', py: 2 }}>
//                   <CircularProgress size={24} />
//                   <Typography variant="body2" color="text.secondary">
//                     Generating… this can take up to a few minutes.
//                   </Typography>
//                 </Stack>
//               )}
//             </>
//           )}

//           {result && (
//             <>
//               <Alert severity="success">
//                 Generated using {result.provider}
//                 {result.model ? ` (${result.model})` : ''}. Review below, then apply the desired slots manually on
//                 the timetable grid.
//               </Alert>
//               <AIOutputPanel text={result.raw_output} />
//             </>
//           )}
//         </Stack>
//       </DialogContent>
//       <DialogActions>
//         {result && (
//           <Button startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ mr: 'auto' }}>
//             {copied ? 'Copied!' : 'Copy output'}
//           </Button>
//         )}
//         <Button onClick={onClose}>Close</Button>
//         {!result && (
//           <Button variant="contained" onClick={handleGenerate} disabled={submitting}>
//             {submitting ? 'Generating…' : 'Generate'}
//           </Button>
//         )}
//       </DialogActions>
//     </Dialog>
//   );
// }

// function AIOutputPanel({ text }: { text: string }) {
//   return (
//     <Paper variant="outlined" sx={{ p: 2, maxHeight: 480, overflow: 'auto', bgcolor: 'action.hover' }}>
//       <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', m: 0 }}>
//         {text}
//       </Typography>
//     </Paper>
//   );
// }

// function AIHistoryDialog({ onClose }: { onClose: () => void }) {
//   const [items, setItems] = useState<AITimetableHistoryItem[] | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [selected, setSelected] = useState<AITimetableHistoryItem | null>(null);
//   const [copied, setCopied] = useState(false);

//   const load = () => {
//     fetchAITimetableHistory()
//       .then(setItems)
//       .catch(() => setError('Could not load AI generation history.'));
//   };

//   useEffect(load, []);

//   const handleDelete = async (id: number) => {
//     try {
//       await deleteAITimetableHistory(id);
//       setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
//       if (selected?.id === id) setSelected(null);
//     } catch {
//       setError('Could not delete this history entry.');
//     }
//   };

//   const handleCopy = async () => {
//     if (!selected) return;
//     await navigator.clipboard.writeText(selected.raw_output);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   return (
//     <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="md" fullWidth>
//       <DialogTitle>
//         {selected ? 'AI Generation Output' : 'AI Generation History'}
//       </DialogTitle>
//       <DialogContent>
//         <Stack spacing={2} sx={{ mt: 1 }}>
//           {error && <Alert severity="error">{error}</Alert>}

//           {!selected && (
//             <>
//               <Alert severity="info">
//                 Past AI timetable proposals, saved automatically each time you generate one — reopen a past result
//                 here instead of generating it again.
//               </Alert>

//               {!items && !error && (
//                 <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
//                   <CircularProgress />
//                 </Box>
//               )}

//               {items && items.length === 0 && <Alert severity="info">No AI generations yet.</Alert>}

//               {items && items.length > 0 && (
//                 <TableContainer component={Paper} variant="outlined">
//                   <Table size="small">
//                     <TableHead>
//                       <TableRow>
//                         <TableCell>Date</TableCell>
//                         <TableCell>Provider / Model</TableCell>
//                         <TableCell>Scope</TableCell>
//                         <TableCell>By</TableCell>
//                         <TableCell align="right">Actions</TableCell>
//                       </TableRow>
//                     </TableHead>
//                     <TableBody>
//                       {items.map((item) => (
//                         <TableRow key={item.id} hover>
//                           <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
//                           <TableCell>
//                             {item.provider}
//                             {item.model ? ` (${item.model})` : ''}
//                           </TableCell>
//                           <TableCell>
//                             {item.class_names.length > 0 ? item.class_names.join(', ') : 'Whole school'}
//                           </TableCell>
//                           <TableCell>{item.created_by_name ?? '—'}</TableCell>
//                           <TableCell align="right">
//                             <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setSelected(item)}>
//                               View
//                             </Button>
//                             <Button
//                               size="small"
//                               color="error"
//                               startIcon={<DeleteIcon />}
//                               onClick={() => handleDelete(item.id)}
//                             >
//                               Delete
//                             </Button>
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </TableContainer>
//               )}
//             </>
//           )}

//           {selected && (
//             <>
//               <Alert severity="success">
//                 Generated {new Date(selected.created_at).toLocaleString()} using {selected.provider}
//                 {selected.model ? ` (${selected.model})` : ''}
//                 {selected.class_names.length > 0 ? ` — scoped to ${selected.class_names.join(', ')}` : ''}.
//               </Alert>
//               <AIOutputPanel text={selected.raw_output} />
//             </>
//           )}
//         </Stack>
//       </DialogContent>
//       <DialogActions>
//         {selected && (
//           <>
//             <Button startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ mr: 'auto' }}>
//               {copied ? 'Copied!' : 'Copy output'}
//             </Button>
//             <Button onClick={() => setSelected(null)}>Back to list</Button>
//           </>
//         )}
//         <Button onClick={onClose}>Close</Button>
//       </DialogActions>
//     </Dialog>
//   );
// }

// function SlotFormDialog({
//   section,
//   day,
//   period,
//   slot,
//   subjects,
//   teachers,
//   commonRooms,
//   onClose,
//   onSaved,
// }: {
//   section: Section;
//   day: DayValue;
//   period: number;
//   slot: TimetableSlot | null;
//   subjects: Subject[];
//   teachers: Teacher[];
//   commonRooms: CommonRoom[];
//   onClose: () => void;
//   onSaved: (message: string) => void;
// }) {
//   const [values, setValues] = useState<TimetableFormValues>(EMPTY_FORM);
//   const [submitting, setSubmitting] = useState(false);
//   const [deleting, setDeleting] = useState(false);
//   const [formError, setFormError] = useState<string | null>(null);
//   const isEditing = !!slot;

//   // A slot's room is derived from its subject: special subjects (Art
//   // Education, Music, Physical Education, ...) use the Common Room mapped to
//   // them on the Class/Common Rooms tab; everything else falls back to the
//   // section's own assigned room, or "Unassigned" if it has none yet.
//   const sectionRoomLabel = section.room_name ?? 'Unassigned';
//   const roomBySubjectId = useMemo(() => {
//     const map: Record<number, string> = {};
//     commonRooms.forEach((r) => {
//       if (r.subject) map[r.subject] = r.name;
//     });
//     return map;
//   }, [commonRooms]);
//   const resolveClassroom = (subjectId: number | null) => (subjectId && roomBySubjectId[subjectId]) || sectionRoomLabel;
//   const isSpecialRoom = !!(values.subject && roomBySubjectId[values.subject]);

//   useEffect(() => {
//     setFormError(null);
//     setValues(
//       slot
//         ? {
//             section: slot.section,
//             subject: slot.subject,
//             teacher: slot.teacher,
//             day_of_week: slot.day_of_week,
//             period: slot.period,
//             start_time: slot.start_time.slice(0, 5),
//             end_time: slot.end_time.slice(0, 5),
//             classroom: resolveClassroom(slot.subject),
//           }
//         : { ...EMPTY_FORM, section: section.id, day_of_week: day, period, classroom: resolveClassroom(null) },
//     );
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [slot, section, day, period, roomBySubjectId]);

//   const handleChange = <K extends keyof TimetableFormValues>(field: K, value: TimetableFormValues[K]) => {
//     setValues((prev) => {
//       const next = { ...prev, [field]: value };
//       if (field === 'subject') {
//         next.classroom = resolveClassroom(value as number | null);
//       }
//       return next;
//     });
//   };

//   const handleSubmit = async () => {
//     setSubmitting(true);
//     setFormError(null);
//     try {
//       if (isEditing) {
//         await updateTimetableSlot(slot.id, values);
//         onSaved('Timetable slot updated.');
//       } else {
//         await createTimetableSlot(values);
//         onSaved('Timetable slot added.');
//       }
//     } catch (err) {
//       setFormError(firstApiError(err, 'Could not save this timetable slot.'));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDelete = async () => {
//     if (!slot) return;
//     setDeleting(true);
//     setFormError(null);
//     try {
//       await deleteTimetableSlot(slot.id);
//       onSaved('Timetable slot removed.');
//     } catch (err) {
//       setFormError(firstApiError(err, 'Could not remove this timetable slot.'));
//     } finally {
//       setDeleting(false);
//     }
//   };

//   const isValid = values.subject && values.teacher && values.start_time && values.end_time;

//   return (
//     <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
//       <DialogTitle>
//         {DAY_LABELS[day]} - Period {period}
//       </DialogTitle>
//       <DialogContent>
//         <Stack spacing={2} sx={{ mt: 1 }}>
//           {formError && <Alert severity="error">{formError}</Alert>}

//           <TextField
//             select
//             label="Subject"
//             value={values.subject ?? ''}
//             onChange={(e) => handleChange('subject', e.target.value ? Number(e.target.value) : null)}
//             required
//             fullWidth
//           >
//             {subjects.map((s) => (
//               <MenuItem key={s.id} value={s.id}>
//                 {s.name}
//               </MenuItem>
//             ))}
//           </TextField>

//           <TextField
//             select
//             label="Teacher"
//             value={values.teacher ?? ''}
//             onChange={(e) => handleChange('teacher', e.target.value ? Number(e.target.value) : null)}
//             required
//             fullWidth
//           >
//             {teachers.map((t) => (
//               <MenuItem key={t.id} value={t.id}>
//                 {t.first_name} {t.last_name} ({t.subject_specialization})
//               </MenuItem>
//             ))}
//           </TextField>

//           <Stack direction="row" spacing={2}>
//             <TextField
//               label="Start Time"
//               type="time"
//               value={values.start_time}
//               onChange={(e) => handleChange('start_time', e.target.value)}
//               slotProps={{ inputLabel: { shrink: true } }}
//               required
//               fullWidth
//             />
//             <TextField
//               label="End Time"
//               type="time"
//               value={values.end_time}
//               onChange={(e) => handleChange('end_time', e.target.value)}
//               slotProps={{ inputLabel: { shrink: true } }}
//               required
//               fullWidth
//             />
//           </Stack>

//           <Typography variant="body2" color="text.secondary">
//             Room: <strong>{values.classroom}</strong>
//             {isSpecialRoom ? ' (auto-set for this subject)' : ' (set on the Common Rooms tab)'}
//           </Typography>
//         </Stack>
//       </DialogContent>
//       <DialogActions>
//         {isEditing && (
//           <Button color="error" startIcon={<DeleteIcon />} onClick={handleDelete} disabled={deleting} sx={{ mr: 'auto' }}>
//             {deleting ? 'Removing…' : 'Remove'}
//           </Button>
//         )}
//         <Button onClick={onClose}>Cancel</Button>
//         <Button variant="contained" onClick={handleSubmit} disabled={submitting || !isValid}>
//           {submitting ? 'Saving…' : 'Save'}
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// }
import { Fragment, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
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
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import { useAuth } from '../auth/AuthContext';
import { useActiveDivision } from '../school/ActiveDivisionContext';
import { PageHeader } from '../components/PageHeader';
import {
  createTimetableSlot,
  deleteAITimetableHistory,
  deleteTimetableSlot,
  fetchAITimetableHistory,
  fetchClasses,
  fetchCommonRooms,
  fetchSectionSubjects,
  fetchSections,
  fetchSubjects,
  fetchTimetable,
  fetchTimetableByTeacher,
  generateAITimetable,
  updateTimetableSlot,
} from '../api/academics';
import { fetchTeachers } from '../api/teachers';
import {
  AI_PROVIDERS,
  DAY_LABELS,
  DAYS,
  DIVISION_SCOPED_ROLES,
  levelHasStreams,
  PERIODS,
  PERIOD_BREAKS,
  PERIOD_TIMES,
  type AITimetableHistoryItem,
  type AITimetableRequestValues,
  type AITimetableResult,
  type BoardValue,
  type CommonRoom,
  type DayValue,
  type DivisionGroupValue,
  type SchoolClass,
  type Section,
  type SectionSubject,
  type Subject,
  type Teacher,
  type TimetableFormValues,
  type TimetableSlot,
} from '../types';
import { firstApiError } from '../utils/apiError';
import { ignoreBackdropClick } from '../utils/dialog';

const EMPTY_AI_FORM: AITimetableRequestValues = {
  provider: '',
  model: '',
  extra_instructions: '',
  class_names: [],
};

const EMPTY_FORM: TimetableFormValues = {
  section: null,
  subject: null,
  teacher: null,
  day_of_week: null,
  period: null,
  start_time: '',
  end_time: '',
  classroom: '',
};

export function TimetablePage() {
  const { user } = useAuth();
  const { board: activeDivisionBoard, group: activeDivisionGroup } = useActiveDivision();

  // Same Board (CBSE/SSC) x Classes-1-10/11-12 division split as Students/
  // Attendance — locked the same way for a division-scoped account
  // (Principal/Teacher/Class Teacher/Accountant), following School
  // Profile's active division for everyone else.
  const isDivisionScopedRole = !!user?.role_name && DIVISION_SCOPED_ROLES.includes(user.role_name);
  const lockedBoard = isDivisionScopedRole ? user?.assigned_board ?? null : activeDivisionBoard;
  const lockedGroup = isDivisionScopedRole ? user?.assigned_group ?? null : activeDivisionGroup;
  const divisionLocked = !!lockedBoard && !!lockedGroup;

  const [boardTab, setBoardTab] = useState<BoardValue>(lockedBoard ?? 'CBSE');
  const [groupTab, setGroupTab] = useState<DivisionGroupValue>(lockedGroup ?? 'JUNIOR');

  useEffect(() => {
    if (lockedBoard) setBoardTab(lockedBoard);
    if (lockedGroup) setGroupTab(lockedGroup);
  }, [lockedBoard, lockedGroup]);

  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [sectionSubjects, setSectionSubjects] = useState<SectionSubject[] | null>(null);
  const [commonRooms, setCommonRooms] = useState<CommonRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [viewMenuAnchor, setViewMenuAnchor] = useState<HTMLElement | null>(null);
  const closeViewMenu = () => setViewMenuAnchor(null);

  const [sectionId, setSectionId] = useState<number | ''>('');
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState<number | ''>('');
  const [teacherSlots, setTeacherSlots] = useState<TimetableSlot[] | null>(null);
  const [teacherSlotsError, setTeacherSlotsError] = useState<string | null>(null);

  const [dialogTarget, setDialogTarget] = useState<{ day: DayValue; period: number; slot: TimetableSlot | null } | null>(
    null,
  );
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const classById = useMemo(() => {
    const map: Record<number, SchoolClass> = {};
    classes?.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  useEffect(() => {
    Promise.all([
      fetchClasses(),
      fetchSections(),
      fetchTeachers(),
      fetchSubjects(),
      fetchSectionSubjects(),
      fetchCommonRooms(),
    ])
      .then(([c, s, t, subj, ss, rooms]) => {
        setClasses(c);
        setSections(s);
        setTeachers(t);
        setSubjects(subj);
        setSectionSubjects(ss);
        setCommonRooms(rooms);
      })
      .catch(() => setError('Could not load classes/sections/teachers/subjects from the API.'));
  }, []);

  const loadSlots = (id: number) => {
    fetchTimetable(id)
      .then(setSlots)
      .catch(() => setSlotsError('Could not load the timetable for this section.'));
  };

  useEffect(() => {
    if (!sectionId) {
      setSlots(null);
      return;
    }
    setSlotsError(null);
    loadSlots(sectionId);
  }, [sectionId]);

  // Sections/teachers shown in the pickers are scoped to the selected
  // division — a section's own class carries board+level, a teacher carries
  // its own assigned_board/assigned_group.
  const visibleSections = useMemo(() => {
    if (!sections) return [];
    return sections.filter((s) => {
      const cls = classById[s.school_class];
      return cls ? cls.board === boardTab && levelHasStreams(cls.level) === (groupTab === 'SENIOR') : true;
    });
  }, [sections, classById, boardTab, groupTab]);

  const visibleTeachers = useMemo(
    () => (teachers ?? []).filter((t) => t.user_assigned_board === boardTab && t.user_assigned_group === groupTab),
    [teachers, boardTab, groupTab],
  );

  // The division toggle can change out from under an already-selected
  // section/teacher — drop the selection back to the picker rather than
  // leaving a now-ineligible one selected.
  useEffect(() => {
    if (sectionId && !visibleSections.some((s) => s.id === sectionId)) setSectionId('');
    if (teacherId && !visibleTeachers.some((t) => t.id === teacherId)) setTeacherId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSections, visibleTeachers]);

  const handleBoardTabChange = (_e: SyntheticEvent, value: BoardValue | null) => {
    if (value) setBoardTab(value);
  };
  const handleGroupTabChange = (_e: SyntheticEvent, value: DivisionGroupValue | null) => {
    if (value) setGroupTab(value);
  };

  const selectedSection = sections?.find((s) => s.id === sectionId) ?? null;

  const sectionById = useMemo(() => {
    const map: Record<number, Section> = {};
    sections?.forEach((s) => (map[s.id] = s));
    return map;
  }, [sections]);

  const selectedTeacher = teachers?.find((t) => t.id === teacherId) ?? null;

  // Section.class_teacher is a homeroom assignment, independent of the
  // subjects a teacher teaches — a teacher can be the designated Class
  // Teacher of at most one section (assigned on the Classes & Sections page).
  const classTeacherOfSection = sections?.find((s) => s.class_teacher === teacherId) ?? null;

  useEffect(() => {
    if (!teacherId) {
      setTeacherSlots(null);
      return;
    }
    setTeacherSlots(null);
    setTeacherSlotsError(null);
    fetchTimetableByTeacher(teacherId)
      .then(setTeacherSlots)
      .catch(() => setTeacherSlotsError("Could not load this teacher's timetable."));
  }, [teacherId]);

  const availableSubjects = useMemo(() => {
    if (!sectionId || !sectionSubjects || !subjects) return [];
    const subjectIds = new Set(sectionSubjects.filter((ss) => ss.section === sectionId).map((ss) => ss.subject));
    return subjects.filter((s) => subjectIds.has(s.id));
  }, [sectionId, sectionSubjects, subjects]);

  const breakAfter = (period: number) => PERIOD_BREAKS.find((b) => b.afterPeriod === period);

  const slotFor = (day: DayValue, period: number) => slots?.find((s) => s.day_of_week === day && s.period === period) ?? null;
  const teacherSlotFor = (day: DayValue, period: number) =>
    teacherSlots?.find((s) => s.day_of_week === day && s.period === period) ?? null;

  const handleSaved = (message: string) => {
    setDialogTarget(null);
    setSnackbar(message);
    if (sectionId) loadSlots(sectionId);
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!classes || !sections || !teachers || !subjects || !sectionSubjects) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader icon={ScheduleIcon} title="Timetable" />
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap' }} spacing={1}>
            <ToggleButtonGroup value={boardTab} exclusive onChange={handleBoardTabChange} size="small" color="primary">
              <ToggleButton value="CBSE" disabled={divisionLocked && lockedBoard !== 'CBSE'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                CBSE
              </ToggleButton>
              <ToggleButton value="SSC" disabled={divisionLocked && lockedBoard !== 'SSC'} sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                SSC (State Board)
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup value={groupTab} exclusive onChange={handleGroupTabChange} size="small" color="primary">
              <ToggleButton value="JUNIOR" disabled={divisionLocked && lockedGroup !== 'JUNIOR'} sx={{ textTransform: 'none', px: 2 }}>
                Classes 1 – 10
              </ToggleButton>
              <ToggleButton value="SENIOR" disabled={divisionLocked && lockedGroup !== 'SENIOR'} sx={{ textTransform: 'none', px: 2 }}>
                11th & 12th
              </ToggleButton>
            </ToggleButtonGroup>
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
                  label={isDivisionScopedRole ? 'Locked to your division' : "Locked to School Profile's division"}
                />
              </Tooltip>
            )}
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ExpandMoreIcon />}
              onClick={(e) => setViewMenuAnchor(e.currentTarget)}
            >
              {viewMode === 'class' ? 'By Class' : 'By Teacher'}
            </Button>
            <Menu anchorEl={viewMenuAnchor} open={!!viewMenuAnchor} onClose={closeViewMenu}>
              <MenuItem
                selected={viewMode === 'class'}
                onClick={() => {
                  setViewMode('class');
                  closeViewMenu();
                }}
              >
                By Class
              </MenuItem>
              <MenuItem
                selected={viewMode === 'teacher'}
                onClick={() => {
                  setViewMode('teacher');
                  closeViewMenu();
                }}
              >
                By Teacher
              </MenuItem>
            </Menu>
            <Button variant="outlined" size="small" startIcon={<HistoryIcon />} onClick={() => setHistoryDialogOpen(true)}>
              AI History
            </Button>
            <Button variant="outlined" size="small" startIcon={<AutoAwesomeIcon />} onClick={() => setAiDialogOpen(true)}>
              Generate with AI
            </Button>
          </Stack>
        </Stack>
      </Box>

      {viewMode === 'class' && (
        <>
          <TextField
            select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
            sx={{ maxWidth: 420, mb: 3 }}
            fullWidth
          >
            {visibleSections.length === 0 && <MenuItem value="">No sections here yet</MenuItem>}
            {visibleSections.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {classById[s.school_class]?.name ?? '—'} - {s.name}
                {s.stream ? ` (${s.stream})` : ''}
              </MenuItem>
            ))}
          </TextField>

          {selectedSection && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <CastForEducationIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Class Teacher:{' '}
                {selectedSection.class_teacher_name ? (
                  <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedSection.class_teacher_name}
                  </Typography>
                ) : (
                  'Unassigned'
                )}
              </Typography>
            </Stack>
          )}

          {slotsError && <Alert severity="error">{slotsError}</Alert>}

          {selectedSection && !slots && !slotsError && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {selectedSection && slots && (
            <>
              {availableSubjects.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No subjects are assigned to this section yet. Assign subjects on the Classes & Sections page's
                  Subject Assignment tab before building a timetable.
                </Alert>
              )}
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <TableContainer
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ padding: '4px 8px' }}>Day</TableCell>
                        {PERIODS.map((p) => {
                          const brk = breakAfter(p);
                          return (
                            <Fragment key={p}>
                              <TableCell sx={{ padding: '4px 8px' }}>
                                P{p}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {PERIOD_TIMES[p]}
                                </Typography>
                              </TableCell>
                              {brk && (
                                <TableCell
                                  title={`${brk.label} · ${brk.time}`}
                                  sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {DAYS.map((day) => (
                        <TableRow key={day}>
                          <TableCell sx={{ padding: '4px 8px' }}>{DAY_LABELS[day]}</TableCell>
                          {PERIODS.map((period) => {
                            const slot = slotFor(day, period);
                            const brk = breakAfter(period);
                            return (
                              <Fragment key={period}>
                                <TableCell sx={{ minWidth: 68, verticalAlign: 'top', padding: '4px 6px' }}>
                                  {slot ? (
                                    <Box
                                      onClick={() => setDialogTarget({ day, period, slot })}
                                      sx={{
                                        cursor: 'pointer',
                                        p: 0.5,
                                        borderRadius: 1,
                                        bgcolor: 'action.hover',
                                        '&:hover': { bgcolor: 'action.selected' },
                                      }}
                                    >
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {slot.subject_name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'block' }}>
                                        {slot.teacher_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {slot.classroom}
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <IconButton
                                      size="small"
                                      title="Add"
                                      onClick={() => setDialogTarget({ day, period, slot: null })}
                                      disabled={availableSubjects.length === 0}
                                    >
                                      <AddIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </TableCell>
                                {brk && (
                                  <TableCell
                                    title={`${brk.label} · ${brk.time}`}
                                    sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                                  />
                                )}
                              </Fragment>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </>
      )}

      {viewMode === 'teacher' && (
        <>
          <TextField
            select
            label="Teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : '')}
            sx={{ maxWidth: 420, mb: 3 }}
            fullWidth
          >
            {visibleTeachers.length === 0 && <MenuItem value="">No teachers here yet</MenuItem>}
            {visibleTeachers.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.first_name} {t.last_name} ({t.subject_specialization})
              </MenuItem>
            ))}
          </TextField>

          {selectedTeacher && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <CastForEducationIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Designation:{' '}
                <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                  {classTeacherOfSection
                    ? `Class Teacher of ${classById[classTeacherOfSection.school_class]?.name ?? '—'} - ${classTeacherOfSection.name}`
                    : 'Subject Teacher'}
                </Typography>
              </Typography>
            </Stack>
          )}

          {teacherSlotsError && <Alert severity="error">{teacherSlotsError}</Alert>}

          {teacherId && !teacherSlots && !teacherSlotsError && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {teacherId && teacherSlots && (
            <>
              {teacherSlots.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This teacher has no timetable slots yet.
                </Alert>
              )}
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <TableContainer
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ padding: '4px 8px' }}>Day</TableCell>
                        {PERIODS.map((p) => {
                          const brk = breakAfter(p);
                          return (
                            <Fragment key={p}>
                              <TableCell sx={{ padding: '4px 8px' }}>
                                P{p}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {PERIOD_TIMES[p]}
                                </Typography>
                              </TableCell>
                              {brk && (
                                <TableCell
                                  title={`${brk.label} · ${brk.time}`}
                                  sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {DAYS.map((day) => (
                        <TableRow key={day}>
                          <TableCell sx={{ padding: '4px 8px' }}>{DAY_LABELS[day]}</TableCell>
                          {PERIODS.map((period) => {
                            const slot = teacherSlotFor(day, period);
                            const slotSection = slot ? sectionById[slot.section] : null;
                            const brk = breakAfter(period);
                            return (
                              <Fragment key={period}>
                                <TableCell sx={{ minWidth: 68, verticalAlign: 'top', padding: '4px 6px' }}>
                                  {slot ? (
                                    <Box sx={{ p: 0.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {slot.subject_name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: 'block' }}>
                                        {slotSection
                                          ? `${classById[slotSection.school_class]?.name ?? '—'} - ${slotSection.name}`
                                          : '—'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {slot.classroom}
                                      </Typography>
                                    </Box>
                                  ) : null}
                                </TableCell>
                                {brk && (
                                  <TableCell
                                    title={`${brk.label} · ${brk.time}`}
                                    sx={{ bgcolor: 'divider', width: 10, minWidth: 10, maxWidth: 10, padding: 0 }}
                                  />
                                )}
                              </Fragment>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </>
      )}

      {dialogTarget && selectedSection && (
        <SlotFormDialog
          section={selectedSection}
          day={dialogTarget.day}
          period={dialogTarget.period}
          slot={dialogTarget.slot}
          subjects={availableSubjects}
          teachers={teachers}
          commonRooms={commonRooms}
          onClose={() => setDialogTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {aiDialogOpen && <AIGenerateDialog classes={classes} onClose={() => setAiDialogOpen(false)} />}

      {historyDialogOpen && <AIHistoryDialog onClose={() => setHistoryDialogOpen(false)} />}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar ?? ''} />
    </Box>
  );
}

function AIGenerateDialog({ classes, onClose }: { classes: SchoolClass[]; onClose: () => void }) {
  const [values, setValues] = useState<AITimetableRequestValues>(EMPTY_AI_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AITimetableResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = <K extends keyof AITimetableRequestValues>(field: K, value: AITimetableRequestValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const data = await generateAITimetable(values);
      setResult(data);
    } catch (err) {
      setFormError(firstApiError(err, 'Could not generate a timetable. Is the AI service running?'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.raw_output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="md" fullWidth>
      <DialogTitle>Generate Timetable with AI</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          {!result && (
            <>
              <Alert severity="info">
                This sends your current classes, sections, subjects and teachers to the AI service and proposes a
                timetable. Nothing is saved automatically — review the output and enter slots yourself on this page.
              </Alert>

              <TextField
                select
                label="Provider"
                value={values.provider}
                onChange={(e) => handleChange('provider', e.target.value)}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                fullWidth
              >
                {AI_PROVIDERS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Model override (optional)"
                value={values.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Leave blank to use the provider's default model"
                fullWidth
              />

              <TextField
                select
                label="Limit to classes (optional)"
                value={values.class_names}
                onChange={(e) => {
                  const v = e.target.value;
                  handleChange('class_names', typeof v === 'string' ? v.split(',') : v);
                }}
                slotProps={{ select: { multiple: true } }}
                helperText="Leave empty to generate for the whole school"
                fullWidth
              >
                {classes.map((c) => (
                  <MenuItem key={c.id} value={c.name}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Additional instructions (optional)"
                value={values.extra_instructions}
                onChange={(e) => handleChange('extra_instructions', e.target.value)}
                multiline
                minRows={3}
                fullWidth
              />

              {submitting && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Generating… this can take up to a few minutes.
                  </Typography>
                </Stack>
              )}
            </>
          )}

          {result && (
            <>
              <Alert severity="success">
                Generated using {result.provider}
                {result.model ? ` (${result.model})` : ''}. Review below, then apply the desired slots manually on
                the timetable grid.
              </Alert>
              <AIOutputPanel text={result.raw_output} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {result && (
          <Button startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ mr: 'auto' }}>
            {copied ? 'Copied!' : 'Copy output'}
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
        {!result && (
          <Button variant="contained" onClick={handleGenerate} disabled={submitting}>
            {submitting ? 'Generating…' : 'Generate'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function AIOutputPanel({ text }: { text: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, maxHeight: 480, overflow: 'auto', bgcolor: 'action.hover' }}>
      <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', m: 0 }}>
        {text}
      </Typography>
    </Paper>
  );
}

function AIHistoryDialog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<AITimetableHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AITimetableHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetchAITimetableHistory()
      .then(setItems)
      .catch(() => setError('Could not load AI generation history.'));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteAITimetableHistory(id);
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
      if (selected?.id === id) setSelected(null);
    } catch {
      setError('Could not delete this history entry.');
    }
  };

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.raw_output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="md" fullWidth>
      <DialogTitle>
        {selected ? 'AI Generation Output' : 'AI Generation History'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!selected && (
            <>
              <Alert severity="info">
                Past AI timetable proposals, saved automatically each time you generate one — reopen a past result
                here instead of generating it again.
              </Alert>

              {!items && !error && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              )}

              {items && items.length === 0 && <Alert severity="info">No AI generations yet.</Alert>}

              {items && items.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Provider / Model</TableCell>
                        <TableCell>Scope</TableCell>
                        <TableCell>By</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            {item.provider}
                            {item.model ? ` (${item.model})` : ''}
                          </TableCell>
                          <TableCell>
                            {item.class_names.length > 0 ? item.class_names.join(', ') : 'Whole school'}
                          </TableCell>
                          <TableCell>{item.created_by_name ?? '—'}</TableCell>
                          <TableCell align="right">
                            <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setSelected(item)}>
                              View
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}

          {selected && (
            <>
              <Alert severity="success">
                Generated {new Date(selected.created_at).toLocaleString()} using {selected.provider}
                {selected.model ? ` (${selected.model})` : ''}
                {selected.class_names.length > 0 ? ` — scoped to ${selected.class_names.join(', ')}` : ''}.
              </Alert>
              <AIOutputPanel text={selected.raw_output} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {selected && (
          <>
            <Button startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ mr: 'auto' }}>
              {copied ? 'Copied!' : 'Copy output'}
            </Button>
            <Button onClick={() => setSelected(null)}>Back to list</Button>
          </>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function SlotFormDialog({
  section,
  day,
  period,
  slot,
  subjects,
  teachers,
  commonRooms,
  onClose,
  onSaved,
}: {
  section: Section;
  day: DayValue;
  period: number;
  slot: TimetableSlot | null;
  subjects: Subject[];
  teachers: Teacher[];
  commonRooms: CommonRoom[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<TimetableFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = !!slot;

  // A slot's room is derived from its subject: special subjects (Art
  // Education, Music, Physical Education, ...) use the Common Room mapped to
  // them on the Class/Common Rooms tab; everything else falls back to the
  // section's own assigned room, or "Unassigned" if it has none yet.
  const sectionRoomLabel = section.room_code || section.room_name || 'Unassigned';
  const roomBySubjectId = useMemo(() => {
    const map: Record<number, string> = {};
    commonRooms.forEach((r) => {
      if (r.subject) map[r.subject] = r.code || r.name;
    });
    return map;
  }, [commonRooms]);
  const resolveClassroom = (subjectId: number | null) => (subjectId && roomBySubjectId[subjectId]) || sectionRoomLabel;
  const isSpecialRoom = !!(values.subject && roomBySubjectId[values.subject]);

  useEffect(() => {
    setFormError(null);
    setValues(
      slot
        ? {
            section: slot.section,
            subject: slot.subject,
            teacher: slot.teacher,
            day_of_week: slot.day_of_week,
            period: slot.period,
            start_time: slot.start_time.slice(0, 5),
            end_time: slot.end_time.slice(0, 5),
            classroom: resolveClassroom(slot.subject),
          }
        : { ...EMPTY_FORM, section: section.id, day_of_week: day, period, classroom: resolveClassroom(null) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, section, day, period, roomBySubjectId]);

  const handleChange = <K extends keyof TimetableFormValues>(field: K, value: TimetableFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'subject') {
        next.classroom = resolveClassroom(value as number | null);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing) {
        await updateTimetableSlot(slot.id, values);
        onSaved('Timetable slot updated.');
      } else {
        await createTimetableSlot(values);
        onSaved('Timetable slot added.');
      }
    } catch (err) {
      setFormError(firstApiError(err, 'Could not save this timetable slot.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!slot) return;
    setDeleting(true);
    setFormError(null);
    try {
      await deleteTimetableSlot(slot.id);
      onSaved('Timetable slot removed.');
    } catch (err) {
      setFormError(firstApiError(err, 'Could not remove this timetable slot.'));
    } finally {
      setDeleting(false);
    }
  };

  const isValid = values.subject && values.teacher && values.start_time && values.end_time;

  return (
    <Dialog open onClose={ignoreBackdropClick(onClose)} maxWidth="sm" fullWidth>
      <DialogTitle>
        {DAY_LABELS[day]} - Period {period}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            select
            label="Subject"
            value={values.subject ?? ''}
            onChange={(e) => handleChange('subject', e.target.value ? Number(e.target.value) : null)}
            required
            fullWidth
          >
            {subjects.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Teacher"
            value={values.teacher ?? ''}
            onChange={(e) => handleChange('teacher', e.target.value ? Number(e.target.value) : null)}
            required
            fullWidth
          >
            {teachers.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.first_name} {t.last_name} ({t.subject_specialization})
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Start Time"
              type="time"
              value={values.start_time}
              onChange={(e) => handleChange('start_time', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              label="End Time"
              type="time"
              value={values.end_time}
              onChange={(e) => handleChange('end_time', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Room: <strong>{values.classroom}</strong>
            {isSpecialRoom ? ' (auto-set for this subject)' : ' (set on the Common Rooms tab)'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {isEditing && (
          <Button color="error" startIcon={<DeleteIcon />} onClick={handleDelete} disabled={deleting} sx={{ mr: 'auto' }}>
            {deleting ? 'Removing…' : 'Remove'}
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !isValid}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}