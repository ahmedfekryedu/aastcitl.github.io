import type { LectureState, ScheduleRow } from '../types/tv';

export interface CairoNow {
  date: string;       // YYYY-MM-DD in Africa/Cairo
  day: string;        // Sunday..Saturday
  minutes: number;    // 0..1439
  timeLabel: string;  // 09:45 AM
  dateLabel: string;  // Thursday, 19 November 2026
}

export function getCairoNow(ref: Date = new Date()): CairoNow {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(ref);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(ref);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ref);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
  }).format(ref);
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ref);

  return { date, day, minutes: h * 60 + m, timeLabel, dateLabel };
}

export function formatTimeSlot(raw?: string): string {
  if (!raw) return '00:00 - 00:00';
  const t = raw.trim();
  if (t.startsWith('08:30') || t.startsWith('8:30')) return '08:30 - 10:20';
  if (t.startsWith('10:30')) return '10:30 - 12:20';
  if (t.startsWith('12:30')) return '12:30 - 02:20';
  if (t.startsWith('02:30') || t.startsWith('14:30')) return '02:30 - 04:20';
  if (t.startsWith('04:30') || t.startsWith('16:30')) return '04:30 - 06:20';
  return t;
}

export function timeToMinutes(value?: string): number | null {
  if (!value) return null;
  const parts = value.trim().split(':');
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 7) h += 12;
  if (h === 24) h = 12;
  return h * 60 + m;
}

export function getLectureState(row: ScheduleRow, now: CairoNow): LectureState {
  const cancelledList = Array.isArray(row.cancelled_dates)
    ? row.cancelled_dates
    : typeof row.cancelled_dates === 'string'
      ? row.cancelled_dates.split(',')
      : [];
  const isCancelled = row.status === 'cancelled' || cancelledList.includes(now.date);

  const label = formatTimeSlot(row.time_slot);
  const [sStr, eStr] = label.split('-');
  const start = timeToMinutes(sStr);
  const end = timeToMinutes(eStr);

  if (start !== null && end !== null) {
    if (now.minutes >= end) return 'ended';
    if (now.minutes >= start && now.minutes < end) return isCancelled ? 'cancelled' : 'live';
    return isCancelled ? 'cancelled' : 'upcoming';
  }
  return isCancelled ? 'cancelled' : 'upcoming';
}

export function isDateInWindow(win: { start_date?: string | null; end_date?: string | null } | undefined, dateStr: string): boolean {
  if (!win) return true;
  if (win.start_date && dateStr < win.start_date) return false;
  if (win.end_date && dateStr > win.end_date) return false;
  return true;
}
