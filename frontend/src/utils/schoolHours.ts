// The daily attendance-marking window matches school timings: 9:00 AM to
// 5:00 PM. Mirrors the backend's `_outside_school_hours_today` check in
// apps/attendance/views.py, so the UI can show the locked/reminder state
// immediately rather than waiting for a failed save — the backend is still
// the real enforcement, this is just for a responsive UI. Only ever applies
// to *today*; a past date is governed by the separate
// PastAttendanceEditGrant flow instead, and is left alone here.
const SCHOOL_DAY_START_HOUR = 9;
const SCHOOL_DAY_END_HOUR = 17;

// The school's last teaching period (see PERIOD_TIMES in types/index.ts) —
// used to nudge whoever's marking attendance to confirm/lock it now, rather
// than let it silently auto-lock at 5:00 PM with nobody having locked it in.
const LAST_PERIOD_START_HOUR = 15 + 20 / 60; // 3:20 PM
const LAST_PERIOD_END_HOUR = 16 + 10 / 60; // 4:10 PM

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHourFraction(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

export function isOutsideSchoolHours(dateIso: string): boolean {
  if (dateIso !== todayIso()) return false;
  const hour = currentHourFraction();
  return hour < SCHOOL_DAY_START_HOUR || hour >= SCHOOL_DAY_END_HOUR;
}

export function isDuringLastPeriod(dateIso: string): boolean {
  if (dateIso !== todayIso()) return false;
  const hour = currentHourFraction();
  return hour >= LAST_PERIOD_START_HOUR && hour < LAST_PERIOD_END_HOUR;
}
