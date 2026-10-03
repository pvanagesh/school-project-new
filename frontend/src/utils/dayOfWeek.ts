import type { DayValue } from '../types';

// JS Date.getDay() -> 0=Sunday..6=Saturday. The timetable only defines
// MON-SAT, so Sunday maps to null (no teacher is ever eligible to mark
// attendance on a day with no periods).
const JS_DAY_TO_CODE: Record<number, DayValue | null> = {
  0: null,
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

// Parses a 'YYYY-MM-DD' date input value as a local calendar date (not UTC,
// which `new Date(isoString)` would do and could shift the weekday near
// midnight) and maps it to the Timetable's 3-letter day code.
export function dayCodeForDateString(dateIso: string): DayValue | null {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return JS_DAY_TO_CODE[date.getDay()];
}
