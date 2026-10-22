export const inr = (paise: number, opts: { decimals?: boolean } = {}) => {
  const rupees = paise / 100;
  const decimals = opts.decimals ?? !Number.isInteger(rupees);
  return '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 });
};

const IST = 'Asia/Kolkata';

export const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(typeof d === 'string' && d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-IN', { timeZone: typeof d === 'string' && d.length === 10 ? 'UTC' : IST, ...opts });

export const fmtDay = (d: string) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

export function relativeTime(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return fmtDate(new Date(d));
}

export const TRAIN_TYPE_LABEL: Record<string, string> = { ORDINARY: 'Ordinary', EXPRESS: 'Mail/Express', SUPERFAST: 'Superfast' };
export const METHOD_LABEL: Record<string, string> = { WALLET: 'Demo wallet', DEMO_UPI: 'Demo UPI', DEMO_CARD: 'Demo card' };
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
