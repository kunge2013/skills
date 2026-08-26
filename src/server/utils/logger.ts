// [AGC:FILE] tool=Cc author=fangkun date=2026-08-26
import { getLogLevel, getLogLevelValue, getLogModules } from '../config/environment';
import type { LogLevel } from '../config/environment';

// [AGC:START] tool=Cc author=fangkun
// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
} as const;

const LEVEL_COLORS: Record<Exclude<LogLevel, 'silent'>, string> = {
  debug: COLORS.gray,
  info: COLORS.cyan,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_LABELS: Record<Exclude<LogLevel, 'silent'>, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(namespace: string): Logger;
}

function formatTimestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatData(data: unknown): string {
  if (data === undefined) return '';
  if (data instanceof Error) {
    return `\n${data.stack || data.message}`;
  }
  if (typeof data === 'object') {
    try {
      return ` ${JSON.stringify(data)}`;
    } catch {
      return ' [unserializable]';
    }
  }
  return ` ${String(data)}`;
}

function shouldLog(moduleName: string, level: LogLevel): boolean {
  const enabledModules = getLogModules();
  if (enabledModules.length > 0) {
    return enabledModules.includes(moduleName);
  }
  const configuredLevel = getLogLevel();
  return getLogLevelValue(level) >= getLogLevelValue(configuredLevel);
}

function writeLog(
  level: Exclude<LogLevel, 'silent'>,
  namespace: string,
  message: string,
  data: unknown,
): void {
  const timestamp = formatTimestamp();
  const color = LEVEL_COLORS[level];
  const label = LEVEL_LABELS[level];
  const dataStr = formatData(data);
  const line = `${COLORS.gray}${timestamp}${COLORS.reset} ${color}${label}${COLORS.reset} ${COLORS.magenta}[${namespace}]${COLORS.reset} ${message}${dataStr}`;

  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export function createLogger(namespace: string): Logger {
  const debug = (message: string, data?: unknown): void => {
    if (shouldLog(namespace, 'debug')) {
      writeLog('debug', namespace, message, data);
    }
  };

  const info = (message: string, data?: unknown): void => {
    if (shouldLog(namespace, 'info')) {
      writeLog('info', namespace, message, data);
    }
  };

  const warn = (message: string, data?: unknown): void => {
    if (shouldLog(namespace, 'warn')) {
      writeLog('warn', namespace, message, data);
    }
  };

  const error = (message: string, data?: unknown): void => {
    if (shouldLog(namespace, 'error')) {
      writeLog('error', namespace, message, data);
    }
  };

  const child = (childNamespace: string): Logger => {
    return createLogger(`${namespace}:${childNamespace}`);
  };

  return { debug, info, warn, error, child };
}
// [AGC:END]
