const isDev = process.env.NEXT_PUBLIC_ENVIRO === 'dev' || process.env.ENVIRO === 'dev';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log('[LOG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args); // Always log errors
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[DEBUG]', ...args);
  },
};
