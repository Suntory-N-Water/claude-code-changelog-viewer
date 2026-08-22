import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogId } from './log-messages/catalog.js';
import { LOG_CATALOG } from './log-messages/catalog.js';

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

type LogFn = {
  (msg: string): void;
  (msg: string, attrs: Record<string, unknown>): void;
  (msg: string, error: Error): void;
};

type MsgOptions = {
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
  serviceName?: string;
  level?: LogLevel;
  format?: 'pretty' | 'json';
};

const logContextStorage = new AsyncLocalStorage<Record<string, unknown>>();

const SENSITIVE_KEYS = new Set([
  'token',
  'secret',
  'webhookurl',
  'email',
  'emailaddress',
  'authorization',
  'apitoken',
  'encryptionkey',
  'jwt',
  'password',
]);

const OMIT = Symbol('omit');

const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
};

function detectFormat(): 'pretty' | 'json' {
  const envFormat = process.env['LOG_FORMAT'];
  if (envFormat === 'pretty' || envFormat === 'json') {
    return envFormat;
  }
  if (process.env['CI']) {
    return 'json';
  }
  if (process.stdout.isTTY) {
    return 'pretty';
  }
  return 'json';
}

function resolveLevel(): LogLevel {
  const env = process.env['LOG_LEVEL']?.toUpperCase();
  if (env && env in LOG_LEVEL_MAP) {
    return env as LogLevel;
  }
  return 'INFO';
}

function extractErrorAttrs(error: Error): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    'exception.type': error.name || error.constructor.name || 'Error',
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

  const stackTrace = attrs['exception.stack_trace'];
  const keys = Object.keys(attrs).filter(
    (key) => key !== 'log.id' && key !== 'exception.stack_trace',
  );
  if (keys.length > 0) {
    output += ` ${keys.map((key) => `${key}=${formatPrettyValue(attrs[key])}`).join(' ')}`;
  }
  if (typeof stackTrace === 'string') {
    output += `\n  exception.stack_trace:\n    ${stackTrace
      .split('\n')
      .join('\n    ')}`;
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

  return JSON.stringify(record);
}

function formatPrettyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expandErrors(
  value: unknown,
  state: { expanded: boolean; attrs?: Record<string, unknown> },
): unknown {
  if (value instanceof Error) {
    if (!state.expanded) {
      state.expanded = true;
      state.attrs = extractErrorAttrs(value);
      return OMIT;
    }
    return value.message;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const expanded = expandErrors(item, state);
      return expanded === OMIT ? undefined : expanded;
    });
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const expanded = expandErrors(child, state);
      if (expanded !== OMIT) {
        result[key] = expanded;
      }
    }
    return result;
  }

  return value;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll('_', '').replaceAll('.', '');
}

function maskSensitiveValues(value: unknown, key?: string): unknown {
  if (key !== undefined && SENSITIVE_KEYS.has(normalizeKey(key))) {
    return '***';
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveValues(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        maskSensitiveValues(childValue, childKey),
      ]),
    );
  }

  return value;
}

function prepareAttrs(
  baseAttrs: Record<string, unknown>,
  extra?: Record<string, unknown> | Error,
): Record<string, unknown> {
  const attrs = { ...baseAttrs };
  if (extra instanceof Error) {
    attrs['error'] = extra;
  } else if (extra) {
    Object.assign(attrs, extra);
  }

  const errorState: { expanded: boolean; attrs?: Record<string, unknown> } = {
    expanded: false,
  };
  const expanded = expandErrors(attrs, errorState);
  if (!isPlainObject(expanded)) {
    return attrs;
  }
  if (errorState.attrs) {
    Object.assign(expanded, errorState.attrs);
  }
  return maskSensitiveValues(expanded) as Record<string, unknown>;
}

function createLogger(
  loggerName: string,
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

    const contextAttrs = logContextStorage.getStore() ?? {};
    const attrs = prepareAttrs({ ...baseAttrs, ...contextAttrs }, extra);

    const formatted =
      format === 'pretty'
        ? formatPretty(level, msg, serviceName, attrs)
        : formatJson(level, msg, serviceName, attrs);

    getConsoleFn(level)(formatted);
  }

  function msgFn(id: LogId, options?: MsgOptions): void {
    const entry = LOG_CATALOG[id];
    const attrs: Record<string, unknown> = {
      'log.id': id,
      ...(options?.attrs ?? {}),
    };
    if (options?.error) {
      attrs['error'] = options.error;
    }
    log(entry.level, entry.template, attrs);
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
      createLogger(loggerName, serviceName, minLevel, format, {
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

  return createLogger(
    options.name,
    options.serviceName ?? options.name,
    minLevel,
    format,
    {
      'logger.name': options.name,
    },
  );
}

function runWithLogContext<T>(attrs: Record<string, unknown>, fn: () => T): T {
  const current = logContextStorage.getStore() ?? {};
  return logContextStorage.run({ ...current, ...attrs }, fn);
}

function getLogContext(): Readonly<Record<string, unknown>> {
  return logContextStorage.getStore() ?? {};
}

export { getLogContext, getLogger, runWithLogContext };
export type { AppLogger, LogFn, LoggerOptions, LogId, LogLevel, MsgOptions };
