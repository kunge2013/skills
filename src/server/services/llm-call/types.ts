// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// src/server/services/llm-call/types.ts

// [AGC:START] tool=Cc author=fangkun
export type LLMCallSource = 'apiTester' | 'prompt' | 'stream' | 'test-connection';

export interface LLMCallLogRecord {
  id: string;
  timestamp: number;
  durationMs: number;
  source: LLMCallSource;
  modelKey: string;
  protocol: 'openai' | 'anthropic';
  modelParams: Record<string, unknown>;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: number;
  error: string | null;
}
// [AGC:END]
