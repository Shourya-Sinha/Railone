/** Time helpers. All railway "dates" are evaluated in Indian Standard Time. */
export const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET_MIN = 330;

/** YYYY-MM-DD for the given instant, in IST. */
export function istDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference b - a for two YYYY-MM-DD strings. */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Date column value (midnight UTC) for a YYYY-MM-DD string. */
export function toDbDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The instant at which the given IST calendar day ends (23:59:59.999 IST). */
export function endOfIstDay(dateStr: string): Date {
  return new Date(Date.parse(`${dateStr}T23:59:59.999Z`) - IST_OFFSET_MIN * 60_000);
}

/** Minutes since IST midnight for an instant. */
export function istMinutesOfDay(d: Date = new Date()): number {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
