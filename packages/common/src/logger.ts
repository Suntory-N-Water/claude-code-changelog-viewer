import type { LogId } from './log-messages/catalog.js';
import { LOG_CATALOG } from './log-messages/catalog.js';

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

type LogFn = {
  (msg: string): void;
  (msg: string, attrs: Record<string, unknown>): void;
  (msg: string, error: Error): void;
};

type MsgOptions = {
  params?: ReadonlyArray<string | number>;
  attrs?: Record<string, unknown>;
  error?: Error;
};

type AppLogger = {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  msg: (id: LogId, options?: MsgOptions) => void;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

type LoggerOptions = {
  name: string;
  level?: LogLevel;
  format?: 'pretty' | 'json';
};

const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
};

function detectFormat(): 'pretty' | 'json' {
  const envFormat = process.env.LOG_FORMAT;
  if (envFormat === 'pretty' || envFormat === 'json') {
    return envFormat;
  }
  if (process.env.CI) {
    return 'json';
  }
  if (process.stdout.isTTY) {
    return 'pretty';
  }
  return 'json';
}

function resolveLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toUpperCase();
  if (env && env in LOG_LEVEL_MAP) {
    return env as LogLevel;
  }
  return 'INFO';
}

function resolveTemplate(
  template: string,
  params?: ReadonlyArray<string | number>,
): string {
  if (!params || params.length === 0) {
    return template;
  }
  let result = template;
  for (let i = 0; i < params.length; i++) {
    result = result.replaceAll(`$${i}`, String(params[i]));
  }
  return result;
}

function extractErrorAttrs(error: Error): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    'exception.type': error.constructor.name,
    'exception.message': error.message,
  };
  if (error.stack) {
    attrs['exception.stack_trace'] = error.stack;
  }
  return attrs;
}

function getConsoleFn(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'TRACE':
    case 'DEBUG':
      return console.debug;
    case 'INFO':
      return console.log;
    case 'WARN':
      return console.warn;
    case 'ERROR':
    case 'FATAL':
      return console.error;
  }
}

function formatPretty(
  level: LogLevel,
  message: string,
  serviceName: string,
  attrs: Record<string, unknown>,
): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const time = `${h}:${m}:${s}.${ms}`;
  const paddedLevel = level.padEnd(5);

  const logId = attrs['log.id'];
  let output: string;
  if (typeof logId === 'string') {
    output = `${time} ${paddedLevel} [${serviceName}] ${logId} ${message}`;
  } else {
    output = `${time} ${paddedLevel} [${serviceName}] ${message}`;
  }

  const keys = Object.keys(attrs).filter((k) => k !== 'log.id');
  if (keys.length > 0) {
    for (const key of keys) {
      const value = attrs[key];
      if (key === 'exception.stack_trace' && typeof value === 'string') {
        output += `\n  ${key}:\n    ${value.split('\n').join('\n    ')}`;
      } else {
        output += `\n  ${key}: ${value}`;
      }
    }
  }

  return output;
}

function formatJson(
  level: LogLevel,
  message: string,
  serviceName: string,
  attrs: Record<string, unknown>,
): string {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    'severity.text': level,
    message,
    'service.name': serviceName,
    ...attrs,
  };

  delete record['exception.stack_trace'];

  return JSON.stringify(record);
}

function createLogger(
  serviceName: string,
  minLevel: number,
  format: 'pretty' | 'json',
  baseAttrs: Record<string, unknown>,
): AppLogger {
  function log(
    level: LogLevel,
    msg: string,
    extra?: Record<string, unknown> | Error,
  ): void {
    if (LOG_LEVEL_MAP[level] < minLevel) {
      return;
    }

    let attrs: Record<string, unknown> = { ...baseAttrs };

    if (extra instanceof Error) {
      attrs = { ...attrs, ...extractErrorAttrs(extra) };
    } else if (extra) {
      attrs = { ...attrs, ...extra };
    }

    const formatted =
      format === 'pretty'
        ? formatPretty(level, msg, serviceName, attrs)
        : formatJson(level, msg, serviceName, attrs);

    getConsoleFn(level)(formatted);
  }

  function msgFn(id: LogId, options?: MsgOptions): void {
    const entry = LOG_CATALOG[id];
    const message = resolveTemplate(entry.template, options?.params);
    const attrs: Record<string, unknown> = {
      'log.id': id,
      ...(options?.attrs ?? {}),
    };
    if (options?.error) {
      Object.assign(attrs, extractErrorAttrs(options.error));
    }
    log(entry.level, message, attrs);
  }

  const logger: AppLogger = {
    trace: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('TRACE', msg, extra),
    debug: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('DEBUG', msg, extra),
    info: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('INFO', msg, extra),
    warn: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('WARN', msg, extra),
    error: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('ERROR', msg, extra),
    fatal: (msg: string, extra?: Record<string, unknown> | Error) =>
      log('FATAL', msg, extra),
    msg: msgFn,
    child: (bindings: Record<string, unknown>) =>
      createLogger(serviceName, minLevel, format, {
        ...baseAttrs,
        ...bindings,
      }),
  };

  return logger;
}

function getLogger(options: LoggerOptions): AppLogger {
  const level = options.level ?? resolveLevel();
  const format = options.format ?? detectFormat();
  const minLevel = LOG_LEVEL_MAP[level];

  return createLogger(options.name, minLevel, format, {});
}

export { getLogger };
export type { AppLogger, LogFn, LoggerOptions, LogId, LogLevel, MsgOptions };
