// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/logger.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LLMCallLogRecord, LLMCallSource } from './types';

export interface LLMCallStart {
  source: LLMCallSource;
  modelKey: string;
  protocol: 'openai' | 'anthropic' | 'nano-banana';
  modelParams: Record<string, unknown>;
  request: Record<string, unknown>;
}

export interface LLMCallHandle {
  complete(result: { response?: unknown; status: number; error?: string }): void;
}

// [AGC:START] tool=Cc author=fangkun
export class LLMCallLogger {
  constructor(private logDir: string) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  private dateFile(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return path.join(this.logDir, `${y}-${m}-${day}.jsonl`);
  }

  start(init: LLMCallStart): LLMCallHandle {
    const startedAt = Date.now();
    const record: LLMCallLogRecord = {
      id: uuidv4(),
      timestamp: startedAt,
      durationMs: 0,
      source: init.source,
      modelKey: init.modelKey,
      protocol: init.protocol,
      modelParams: init.modelParams,
      request: init.request,
      response: null,
      status: 0,
      error: null,
    };
    return {
      complete: (result: { response?: unknown; status: number; error?: string }) => {
        record.durationMs = Date.now() - startedAt;
        record.response = result.response !== undefined ? (result.response as Record<string, unknown>) : null;
        record.status = result.status;
        record.error = result.error ?? null;
        // Single synchronous append per record: the event loop serializes
        // writes, so concurrent calls never interleave mid-line. Write
        // failures are swallowed so logging never breaks the caller.
        try {
          fs.appendFileSync(this.dateFile(new Date()), JSON.stringify(record) + '\n', 'utf-8');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[LLMCallLogger] write failed: ${message}`);
        }
      },
    };
  }
}
// [AGC:END]
