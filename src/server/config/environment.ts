// [AGC:FILE] tool=Cc author=fangkun date=2026-08-26
import path from 'path';
// [AGC:START] tool=Cc author=fangkun
import dotenv from 'dotenv';
// Load .env file from project root
dotenv.config();
// [AGC:END]

export function getPort(): number {
  return parseInt(process.env.PORT || '3000', 10);
}

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

export function getApiPassword(): string | undefined {
  return process.env.API_PASSWORD;
}

export function getEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

export function hasEnvVar(key: string): boolean {
  return !!process.env[key];
}

// [AGC:START] tool=Cc author=fangkun
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

export function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return level in LOG_LEVELS ? level : 'info';
}

export function getLogLevelValue(level: LogLevel): number {
  return LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

export function getLogModules(): string[] {
  const modules = process.env.LOG_MODULES || '';
  if (!modules) return [];
  return modules.split(',').map((m) => m.trim()).filter(Boolean);
}
// [AGC:END]
