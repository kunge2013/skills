import path from 'path';

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
