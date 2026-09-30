// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// web/src/types/comic.ts

// [AGC:START] tool=Cc author=fangkun
export type ComicCategory = 'cleaning' | 'extraction' | 'script' | 'storyboard'
export type ComicStage = 'format_clean' | 'serial_clean' | 'punct_clean' | 'shot_clean' | 'extract' | 'script' | 'storyboard'

export interface Novel {
  id: string
  name: string
  metadata: Record<string, unknown>
  created_at: number
  updated_at: number
}

export interface NovelContent {
  id: string
  novel_id: string
  original_text: string | null
  cleaned_text: string | null
  is_format_cleaned: boolean
  is_serial_cleaned: boolean
  is_punct_cleaned: boolean
  is_shot_cleaned: boolean
  created_at: number
  updated_at: number
}

export interface NovelCharacter {
  id: string
  novel_id: string
  name: string
  type: string
  appearance?: string | null
  description?: string | null
  order_index?: number | null
  created_at: number
  updated_at: number
}

export interface NovelCharacterTag {
  id: string
  character_id: string
  tag_category: string
  tag_value: string
}

export interface NovelScript {
  id: string
  novel_id: string
  scene_number?: number | null
  scene_location?: string | null
  scene_time?: string | null
  scene_description?: string | null
  order_index?: number | null
  created_at: number
  updated_at: number
}

export interface NovelScriptDialogue {
  id: string
  script_id: string
  character_name?: string | null
  dialogue_text: string
  order_index?: number | null
  created_at: number
  updated_at: number
}

export interface NovelStoryboard {
  id: string
  novel_id: string
  frame_number?: number | null
  shot_type?: string | null
  camera_angle?: string | null
  content?: string | null
  characters?: string | null
  image_prompt?: string | null
  subtitles?: string | null
  notes?: string | null
  order_index?: number | null
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

export interface PipelineRun {
  id: string
  novel_id: string
  run_id: string
  completed_steps: string[]
  current_step: string | null
  model_key: string | null
  created_at: number
  updated_at: number
}

export interface PipelineStepLog {
  id: string
  run_id: string
  novel_id: string
  template_id: string
  input_variables: Record<string, string>
  output: string | null
  model_key: string | null
  duration_ms: number | null
  status: number | null
  error: string | null
  created_at: number
}
// [AGC:END]
