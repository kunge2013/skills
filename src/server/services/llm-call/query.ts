// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/query.ts
import fs from 'fs';
import path from 'path';
import { LLMCallLogRecord } from './types';

export interface LLMCallLogFilter {
  from?: number;
  to?: number;
  modelKey?: string;
  source?: string;
  status?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// [AGC:START] tool=Cc author=fangkun
export class LLMCallLogQuery {
  constructor(private logDir: string) {}

  private readAll(filter: LLMCallLogFilter): LLMCallLogRecord[] {
    if (!fs.existsSync(this.logDir)) return [];
    const files = fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl'));
    const records: LLMCallLogRecord[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.logDir, file), 'utf-8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line) as LLMCallLogRecord;
            if (typeof rec?.id !== 'string' || typeof rec?.timestamp !== 'number') continue;
            if (filter.from !== undefined && rec.timestamp < filter.from) continue;
            if (filter.to !== undefined && rec.timestamp > filter.to) continue;
            if (filter.modelKey && rec.modelKey !== filter.modelKey) continue;
            if (filter.source && rec.source !== filter.source) continue;
            if (filter.status !== undefined && rec.status !== filter.status) continue;
            records.push(rec);
          } catch {
            // skip corrupted line
          }
        }
      } catch {
        // skip unreadable file (stray directory, permission error, ENOENT race)
      }
    }
    return records;
  }

  async list(filter: LLMCallLogFilter, page = 1, pageSize = 20): Promise<Paginated<LLMCallLogRecord>> {
    const all = this.readAll(filter).sort((a, b) => b.timestamp - a.timestamp);
    const p = Math.max(1, Math.floor(page || 1));
    const ps = Math.max(1, Math.floor(pageSize || 20));
    const start = (p - 1) * ps;
    return { items: all.slice(start, start + ps), total: all.length, page: p, pageSize: ps };
  }

  async getById(id: string): Promise<LLMCallLogRecord | null> {
    if (!fs.existsSync(this.logDir)) return null;
    const files = fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files) {
      try {
        const lines = fs.readFileSync(path.join(this.logDir, file), 'utf-8').split('\n').reverse();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line) as LLMCallLogRecord;
            if (typeof rec?.id !== 'string' || typeof rec?.timestamp !== 'number') continue;
            if (rec.id === id) return rec;
          } catch {
            // skip corrupted line
          }
        }
      } catch {
        // skip unreadable file (stray directory, permission error, ENOENT race)
      }
    }
    return null;
  }

  private toYMD(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async deleteRange(from: number, to: number): Promise<number> {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    if (!fs.existsSync(this.logDir)) return 0;
    const fromDate = this.toYMD(from);
    const toDate = this.toYMD(to);
    let deleted = 0;
    for (const file of fs.readdirSync(this.logDir).filter(f => f.endsWith('.jsonl'))) {
      const name = file.replace('.jsonl', '');
      if (name >= fromDate && name <= toDate) {
        fs.unlinkSync(path.join(this.logDir, file));
        deleted++;
      }
    }
    return deleted;
  }
}
// [AGC:END]
