// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// web/src/types/comic.ts

// [AGC:START] tool=Cc author=fangkun
export type ComicCategory = 'cleaning' | 'extraction' | 'script' | 'storyboard'
export type ComicStage = 'format_clean' | 'serial_clean' | 'punct_clean' | 'shot_clean' | 'extract' | 'script' | 'storyboard'

export interface Novel {
  id: string
  name: string
  original_text: string | null
  content: string | null
  character_text: string | null
  script_text: string | null
  storyboard_text: string | null
  is_format_cleaned: boolean
  is_serial_cleaned: boolean
  is_punct_cleaned: boolean
  is_shot_cleaned: boolean
  metadata: Record<string, unknown>
  created_at: number
  updated_at: number
}

export interface ComicTemplate {
  id: string
  name: string
  description: string | null
  category: ComicCategory
  step_order: number | null
  depend_on: string | null
  system_prompt: string
  user_prompt: string | null
  input_variables: string[]
  is_builtin: boolean
  created_at: number
  updated_at: number
}

export interface ComicCallLog {
  id: string
  run_id: string | null
  novel_id: string | null
  template_id: string | null
  stage: ComicStage | null
  input_variables: Record<string, unknown>
  output: string | null
  model_key: string | null
  duration_ms: number | null
  status: number | null
  error: string | null
  created_at: number
}

export interface ComicCallLogFilter {
  novel_id?: string
  stage?: ComicStage
  status?: number
  from?: number
  to?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
// [AGC:END]
