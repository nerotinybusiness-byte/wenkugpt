export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const base: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (error instanceof Error) {
    base.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error !== undefined) {
    base.error = error;
  }

  return JSON.stringify(base);
}

export function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logDebug(message: string, context?: LogContext) {
  console.debug(formatMessage('debug', message, context));
}

export function logInfo(message: string, context?: LogContext) {
  console.info(formatMessage('info', message, context));
}

export function logWarn(message: string, context?: LogContext, error?: unknown) {
  console.warn(formatMessage('warn', message, context, error));
}

export function logError(message: string, context?: LogContext, error?: unknown) {
  console.error(formatMessage('error', message, context, error));
}

