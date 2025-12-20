import { randomUUID } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  teamId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL = process.env.LOG_LEVEL as LogLevel || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (better for log aggregation)
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.requestId ? `[${entry.requestId.slice(0, 8)}]` : '',
    entry.message,
  ].filter(Boolean);

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  if (entry.error) {
    parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\n  Stack: ${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: context?.requestId,
    context: context ? { ...context } : undefined,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    };
  }

  const formatted = formatLog(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export function generateRequestId(): string {
  return randomUUID();
}

export function getRequestId(headers: Headers): string {
  // Check for existing request ID from upstream proxy
  const existing = headers.get('x-request-id') || headers.get('x-correlation-id');
  return existing || generateRequestId();
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext, error?: Error) => log('warn', message, context, error),
  error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error),

  // Request lifecycle logging
  request: (method: string, path: string, requestId: string, context?: LogContext) => {
    log('info', `${method} ${path}`, { ...context, requestId, method, path });
  },

  response: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestId: string,
    context?: LogContext
  ) => {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      ...context,
      requestId,
      method,
      path,
      statusCode,
      duration,
    });
  },

  // API-specific logging
  apiError: (message: string, requestId: string, error?: Error, context?: LogContext) => {
    log('error', message, { ...context, requestId }, error);
  },

  // Auth logging
  authEvent: (event: string, userId: string, requestId: string, context?: LogContext) => {
    log('info', `Auth: ${event}`, { ...context, requestId, userId });
  },

  // Billing logging
  billingEvent: (event: string, teamId: string, requestId: string, context?: LogContext) => {
    log('info', `Billing: ${event}`, { ...context, requestId, teamId });
  },
};

export type Logger = typeof logger;
