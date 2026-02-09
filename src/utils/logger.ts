export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type Logger = {
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  child: (context: Record<string, unknown>) => Logger;
};

const levelOrder: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const formatMeta = (meta?: Record<string, unknown>) => {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(meta)}`;
};

const createBaseLogger = (minLevel: LogLevel, context?: Record<string, unknown>): Logger => {
  const shouldLog = (level: LogLevel) => levelOrder[level] <= levelOrder[minLevel];

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) {
      return;
    }
    const payload = context ? { ...context, ...meta } : meta;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${formatMeta(
      payload,
    )}`;
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    child: (childContext) => createBaseLogger(minLevel, { ...context, ...childContext }),
  };
};

export const createLogger = (level: string): Logger => {
  const normalized = (level.toLowerCase() as LogLevel) || 'info';
  const minLevel = levelOrder[normalized] === undefined ? 'info' : normalized;
  return createBaseLogger(minLevel);
};
