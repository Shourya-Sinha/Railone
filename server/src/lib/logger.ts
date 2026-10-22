type Level = 'debug' | 'info' | 'warn' | 'error';
const isProd = process.env.NODE_ENV === 'production';
const quiet = process.env.NODE_ENV === 'test';

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (quiet && level !== 'error') return;
  const entry = { t: new Date().toISOString(), level, msg, ...meta };
  const line = isProd ? JSON.stringify(entry) : `[${entry.t}] ${level.toUpperCase()} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => write('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => write('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write('error', m, meta),
};
