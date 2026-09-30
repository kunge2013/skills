// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/services/comic/service.ts

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  Novel,
  NovelContent,
  NovelCharacter,
  NovelCharacterTag,
  NovelScript,
  NovelScriptDialogue,
  NovelStoryboard,
  ComicTemplate,
  ComicCallLog,
  ComicCallLogFilter,
  Paginated,
  ComicCategory,
  ComicStage,
  PipelineRun,
  PipelineStepLog
} from './types'
import { createBuiltinTemplates } from './builtin-templates'

// [AGC:START] tool=Cc author=fangkun
export class ComicService {
  private db: Database.Database
  private builtinInitialized = false

  constructor(db: Database.Database) {
    this.db = db
    this.ensureBuiltinTemplates()
  }

  private ensureBuiltinTemplates(): void {
    if (this.builtinInitialized) return

    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM comic_templates WHERE is_builtin = 1').get() as { cnt: number }
    if (count.cnt === 0) {
      const templates = createBuiltinTemplates()
      const insert = this.db.prepare(`
        INSERT INTO comic_templates (id, name, description, category, step_order, depend_on, system_prompt, user_prompt, input_variables, is_builtin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const insertMany = this.db.transaction(() => {
        const now = Date.now()
        for (const t of templates) {
          insert.run(
            t.id,
            t.name,
            t.description,
            t.category,
            t.step_order,
            t.depend_on,
            t.system_prompt,
            t.user_prompt,
            JSON.stringify(t.input_variables),
            t.is_builtin ? 1 : 0,
            now,
            now
          )
        }
      })
      insertMany()
    }
    this.builtinInitialized = true
  }

  // ============ Novels ============

  listNovels(page = 1, pageSize = 20): Paginated<Novel> {
    const offset = (page - 1) * pageSize
    const total = (this.db.prepare('SELECT COUNT(*) as cnt FROM novels').get() as { cnt: number }).cnt
    const items = this.db.prepare('SELECT * FROM novels ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as Novel[]

    return {
      items: items.map(this.normalizeNovel),
      total,
      page,
      pageSize
    }
  }

  getNovel(id: string): Novel | null {
    const row = this.db.prepare('SELECT * FROM novels WHERE id = ?').get(id) as any
    return row ? this.normalizeNovel(row) : null
  }

  createNovel(data: { name: string; original_text?: string; content?: string }): Novel {
    const id = uuidv4()
    const now = Date.now()

    const insertNovel = this.db.prepare(`
      INSERT INTO novels (id, name, metadata, created_at, updated_at)
      VALUES (?, ?, '{}', ?, ?)
    `)

    const insertContent = this.db.prepare(`
      INSERT INTO novel_content (id, novel_id, original_text, cleaned_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const transaction = this.db.transaction(() => {
      insertNovel.run(id, data.name, now, now)
      insertContent.run(uuidv4(), id, data.original_text || null, data.content || null, now, now)
    })
    transaction()

    return this.getNovel(id)!
  }

  updateNovel(id: string, data: Partial<Omit<Novel, 'id' | 'created_at'>>): Novel | null {
    const existing = this.getNovel(id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []

    const allowedFields: (keyof Omit<Novel, 'id' | 'created_at'>)[] = [
      'name', 'metadata'
    ]

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'metadata') {
          fields.push(`${field} = ?`)
          values.push(JSON.stringify(data[field]))
        } else {
          fields.push(`${field} = ?`)
          values.push(data[field])
        }
      }
    }

    if (fields.length === 0) return existing

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE novels SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getNovel(id)
  }

  deleteNovel(id: string): boolean {
    const result = this.db.prepare('DELETE FROM novels WHERE id = ?').run(id)
    return result.changes > 0
  }

  private normalizeNovel(row: any): Novel {
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {})
    }
  }

  // ============ Novel Content ============

  getNovelContent(novelId: string): NovelContent | null {
    const row = this.db.prepare('SELECT * FROM novel_content WHERE novel_id = ?').get(novelId) as any
    return row ? this.normalizeNovelContent(row) : null
  }

  updateNovelContent(novelId: string, data: Partial<Omit<NovelContent, 'id' | 'novel_id' | 'created_at'>>): NovelContent | null {
    const existing = this.getNovelContent(novelId)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []

    const allowedFields = [
      'original_text', 'cleaned_text',
      'is_format_cleaned', 'is_serial_cleaned', 'is_punct_cleaned', 'is_shot_cleaned'
    ] as const

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (typeof data[field] === 'boolean') {
          fields.push(`${field} = ?`)
          values.push((data[field] as boolean) ? 1 : 0)
        } else {
          fields.push(`${field} = ?`)
          values.push(data[field])
        }
      }
    }

    if (fields.length === 0) return existing

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(novelId)

    this.db.prepare(`UPDATE novel_content SET ${fields.join(', ')} WHERE novel_id = ?`).run(...values)
    return this.getNovelContent(novelId)
  }

  private normalizeNovelContent(row: any): NovelContent {
    return {
      ...row,
      is_format_cleaned: !!row.is_format_cleaned,
      is_serial_cleaned: !!row.is_serial_cleaned,
      is_punct_cleaned: !!row.is_punct_cleaned,
      is_shot_cleaned: !!row.is_shot_cleaned
    }
  }

  // ============ Novel Characters ============

  listNovelCharacters(novelId: string): NovelCharacter[] {
    const rows = this.db.prepare('SELECT * FROM novel_character WHERE novel_id = ? ORDER BY order_index ASC').all(novelId) as any[]
    return rows
  }

  getNovelCharacter(id: string): NovelCharacter | null {
    return this.db.prepare('SELECT * FROM novel_character WHERE id = ?').get(id) as NovelCharacter | null
  }

  createNovelCharacter(novelId: string, data: Omit<NovelCharacter, 'id' | 'novel_id' | 'created_at' | 'updated_at'>): NovelCharacter {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO novel_character (id, novel_id, name, type, appearance, description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, novelId, data.name, data.type, data.appearance || null, data.description || null, data.order_index || null, now, now)
    return this.getNovelCharacter(id)!
  }

  updateNovelCharacter(id: string, data: Partial<Omit<NovelCharacter, 'id' | 'novel_id' | 'created_at'>>): NovelCharacter | null {
    const existing = this.getNovelCharacter(id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []
    const allowedFields = ['name', 'type', 'appearance', 'description', 'order_index'] as const

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(data[field])
      }
    }

    if (fields.length === 0) return existing
    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE novel_character SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getNovelCharacter(id)
  }

  deleteNovelCharacter(id: string): boolean {
    return this.db.prepare('DELETE FROM novel_character WHERE id = ?').run(id).changes > 0
  }

  deleteNovelCharactersByNovelId(novelId: string): number {
    return this.db.prepare('DELETE FROM novel_character WHERE novel_id = ?').run(novelId).changes
  }

  // ============ Novel Character Tags ============

  listNovelCharacterTags(characterId: string): NovelCharacterTag[] {
    return this.db.prepare('SELECT * FROM novel_character_tags WHERE character_id = ?').all(characterId) as NovelCharacterTag[]
  }

  createNovelCharacterTag(characterId: string, data: Omit<NovelCharacterTag, 'id' | 'character_id'>): NovelCharacterTag {
    const id = uuidv4()
    this.db.prepare(`
      INSERT INTO novel_character_tags (id, character_id, tag_category, tag_value)
      VALUES (?, ?, ?, ?)
    `).run(id, characterId, data.tag_category, data.tag_value)
    return { id, character_id: characterId, tag_category: data.tag_category, tag_value: data.tag_value }
  }

  deleteNovelCharacterTags(characterId: string): number {
    return this.db.prepare('DELETE FROM novel_character_tags WHERE character_id = ?').run(characterId).changes
  }

  // ============ Novel Scripts ============

  listNovelScripts(novelId: string): NovelScript[] {
    return this.db.prepare('SELECT * FROM novel_script WHERE novel_id = ? ORDER BY order_index ASC').all(novelId) as NovelScript[]
  }

  getNovelScript(id: string): NovelScript | null {
    return this.db.prepare('SELECT * FROM novel_script WHERE id = ?').get(id) as NovelScript | null
  }

  createNovelScript(novelId: string, data: Omit<NovelScript, 'id' | 'novel_id' | 'created_at' | 'updated_at'>): NovelScript {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO novel_script (id, novel_id, scene_number, scene_location, scene_time, scene_description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, novelId, data.scene_number || null, data.scene_location || null, data.scene_time || null, data.scene_description || null, data.order_index || null, now, now)
    return this.getNovelScript(id)!
  }

  updateNovelScript(id: string, data: Partial<Omit<NovelScript, 'id' | 'novel_id' | 'created_at'>>): NovelScript | null {
    const existing = this.getNovelScript(id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []
    const allowedFields = ['scene_number', 'scene_location', 'scene_time', 'scene_description', 'order_index'] as const

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(data[field])
      }
    }

    if (fields.length === 0) return existing
    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE novel_script SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getNovelScript(id)
  }

  deleteNovelScript(id: string): boolean {
    return this.db.prepare('DELETE FROM novel_script WHERE id = ?').run(id).changes > 0
  }

  deleteNovelScriptsByNovelId(novelId: string): number {
    return this.db.prepare('DELETE FROM novel_script WHERE novel_id = ?').run(novelId).changes
  }

  // ============ Novel Script Dialogues ============

  listScriptDialogues(scriptId: string): NovelScriptDialogue[] {
    return this.db.prepare('SELECT * FROM novel_script_dialogue WHERE script_id = ? ORDER BY order_index ASC').all(scriptId) as NovelScriptDialogue[]
  }

  getNovelScriptDialogue(id: string): NovelScriptDialogue | null {
    return this.db.prepare('SELECT * FROM novel_script_dialogue WHERE id = ?').get(id) as NovelScriptDialogue | null
  }

  createNovelScriptDialogue(scriptId: string, data: Omit<NovelScriptDialogue, 'id' | 'script_id' | 'created_at' | 'updated_at'>): NovelScriptDialogue {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO novel_script_dialogue (id, script_id, character_name, dialogue_text, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, scriptId, data.character_name || null, data.dialogue_text, data.order_index || null, now, now)
    return this.getNovelScriptDialogue(id)!
  }

  deleteNovelScriptDialoguesByScriptId(scriptId: string): number {
    return this.db.prepare('DELETE FROM novel_script_dialogue WHERE script_id = ?').run(scriptId).changes
  }

  // ============ Novel Storyboards ============

  listNovelStoryboards(novelId: string): NovelStoryboard[] {
    return this.db.prepare('SELECT * FROM novel_storyboard WHERE novel_id = ? ORDER BY order_index ASC').all(novelId) as NovelStoryboard[]
  }

  getNovelStoryboard(id: string): NovelStoryboard | null {
    return this.db.prepare('SELECT * FROM novel_storyboard WHERE id = ?').get(id) as NovelStoryboard | null
  }

  createNovelStoryboard(novelId: string, data: Omit<NovelStoryboard, 'id' | 'novel_id' | 'created_at' | 'updated_at'>): NovelStoryboard {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO novel_storyboard (id, novel_id, frame_number, shot_type, camera_angle, content, characters, image_prompt, subtitles, notes, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, novelId,
      data.frame_number || null, data.shot_type || null, data.camera_angle || null,
      data.content || null, data.characters || null, data.image_prompt || null,
      data.subtitles || null, data.notes || null, data.order_index || null,
      now, now
    )
    return this.getNovelStoryboard(id)!
  }

  updateNovelStoryboard(id: string, data: Partial<Omit<NovelStoryboard, 'id' | 'novel_id' | 'created_at'>>): NovelStoryboard | null {
    const existing = this.getNovelStoryboard(id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []
    const allowedFields = [
      'frame_number', 'shot_type', 'camera_angle', 'content',
      'characters', 'image_prompt', 'subtitles', 'notes', 'order_index'
    ] as const

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(data[field])
      }
    }

    if (fields.length === 0) return existing
    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE novel_storyboard SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getNovelStoryboard(id)
  }

  deleteNovelStoryboard(id: string): boolean {
    return this.db.prepare('DELETE FROM novel_storyboard WHERE id = ?').run(id).changes > 0
  }

  deleteNovelStoryboardsByNovelId(novelId: string): number {
    return this.db.prepare('DELETE FROM novel_storyboard WHERE novel_id = ?').run(novelId).changes
  }

  // ============ Templates ============

  listTemplates(category?: ComicCategory): ComicTemplate[] {
    let sql = 'SELECT * FROM comic_templates'
    const params: unknown[] = []

    if (category) {
      sql += ' WHERE category = ?'
      params.push(category)
    }

    sql += ' ORDER BY step_order ASC'
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(this.normalizeTemplate)
  }

  getTemplate(id: string): ComicTemplate | null {
    const row = this.db.prepare('SELECT * FROM comic_templates WHERE id = ?').get(id) as any
    return row ? this.normalizeTemplate(row) : null
  }

  createTemplate(data: Partial<Pick<ComicTemplate, 'id'>> & Omit<ComicTemplate, 'id' | 'created_at' | 'updated_at'>): ComicTemplate {
    const id = data.id || uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO comic_templates (id, name, description, category, step_order, depend_on, system_prompt, user_prompt, input_variables, is_builtin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description,
      data.category,
      data.step_order,
      data.depend_on,
      data.system_prompt,
      data.user_prompt,
      JSON.stringify(data.input_variables || []),
      data.is_builtin ? 1 : 0,
      now,
      now
    )
    return this.getTemplate(id)!
  }

  updateTemplate(id: string, data: Partial<Omit<ComicTemplate, 'id' | 'created_at'>>): ComicTemplate | null {
    const existing = this.getTemplate(id)
    if (!existing) return null
    if (existing.is_builtin && (data.name || data.system_prompt || data.category)) {
      // For builtin templates, only allow copying to custom
      return null
    }

    const fields: string[] = []
    const values: unknown[] = []

    const allowedFields: (keyof Omit<ComicTemplate, 'id' | 'created_at'>)[] = [
      'name', 'description', 'category', 'step_order', 'depend_on',
      'system_prompt', 'user_prompt', 'input_variables', 'is_builtin'
    ]

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'input_variables') {
          fields.push(`${field} = ?`)
          values.push(JSON.stringify(data[field]))
        } else if (field === 'is_builtin') {
          fields.push(`${field} = ?`)
          values.push(data[field] ? 1 : 0)
        } else {
          fields.push(`${field} = ?`)
          values.push(data[field])
        }
      }
    }

    if (fields.length === 0) return existing

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE comic_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getTemplate(id)
  }

  deleteTemplate(id: string): boolean {
    const template = this.getTemplate(id)
    if (!template) return false
    if (template.is_builtin) return false // Cannot delete builtin templates

    const result = this.db.prepare('DELETE FROM comic_templates WHERE id = ?').run(id)
    return result.changes > 0
  }

  private normalizeTemplate(row: any): ComicTemplate {
    return {
      ...row,
      input_variables: typeof row.input_variables === 'string' ? JSON.parse(row.input_variables || '[]') : (row.input_variables || []),
      is_builtin: !!row.is_builtin
    }
  }

  // ============ Call Logs ============

  listCallLogs(filter: ComicCallLogFilter, page = 1, pageSize = 20): Paginated<ComicCallLog> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.novel_id) {
      conditions.push('novel_id = ?')
      params.push(filter.novel_id)
    }
    if (filter.stage) {
      conditions.push('stage = ?')
      params.push(filter.stage)
    }
    if (filter.status !== undefined) {
      conditions.push('status = ?')
      params.push(filter.status)
    }
    if (filter.from !== undefined) {
      conditions.push('created_at >= ?')
      params.push(filter.from)
    }
    if (filter.to !== undefined) {
      conditions.push('created_at <= ?')
      params.push(filter.to)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const total = (this.db.prepare(`SELECT COUNT(*) as cnt FROM comic_call_logs ${where}`).get(...params) as { cnt: number }).cnt
    const items = this.db.prepare(`SELECT * FROM comic_call_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset) as ComicCallLog[]

    return {
      items: items.map(this.normalizeCallLog),
      total,
      page,
      pageSize
    }
  }

  getCallLog(id: string): ComicCallLog | null {
    const row = this.db.prepare('SELECT * FROM comic_call_logs WHERE id = ?').get(id) as any
    return row ? this.normalizeCallLog(row) : null
  }

  createCallLog(data: Omit<ComicCallLog, 'id' | 'created_at'>): ComicCallLog {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO comic_call_logs (id, run_id, novel_id, template_id, stage, input_variables, output, model_key, duration_ms, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.run_id,
      data.novel_id,
      data.template_id,
      data.stage,
      JSON.stringify(data.input_variables || {}),
      data.output,
      data.model_key,
      data.duration_ms,
      data.status,
      data.error,
      now
    )
    return this.getCallLog(id)!
  }

  deleteCallLogs(filter: ComicCallLogFilter): number {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.novel_id) {
      conditions.push('novel_id = ?')
      params.push(filter.novel_id)
    }
    if (filter.from !== undefined) {
      conditions.push('created_at >= ?')
      params.push(filter.from)
    }
    if (filter.to !== undefined) {
      conditions.push('created_at <= ?')
      params.push(filter.to)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = this.db.prepare(`DELETE FROM comic_call_logs ${where}`).run(...params)
    return result.changes
  }

  private normalizeCallLog(row: any): ComicCallLog {
    return {
      ...row,
      input_variables: typeof row.input_variables === 'string' ? JSON.parse(row.input_variables || '{}') : (row.input_variables || {})
    }
  }

  // ============ Pipeline Runs ============

  getPipelineRunByRunId(runId: string): PipelineRun | null {
    const row = this.db.prepare('SELECT * FROM pipeline_runs WHERE run_id = ?').get(runId) as any
    return row ? this.normalizePipelineRun(row) : null
  }

  getLatestPipelineRunByNovelId(novelId: string): PipelineRun | null {
    const row = this.db.prepare('SELECT * FROM pipeline_runs WHERE novel_id = ? ORDER BY updated_at DESC LIMIT 1').get(novelId) as any
    return row ? this.normalizePipelineRun(row) : null
  }

  listPipelineRuns(novelId?: string): PipelineRun[] {
    if (novelId) {
      const rows = this.db.prepare('SELECT * FROM pipeline_runs WHERE novel_id = ? ORDER BY updated_at DESC').all(novelId) as any[]
      return rows.map(row => this.normalizePipelineRun(row))
    }
    const rows = this.db.prepare('SELECT * FROM pipeline_runs ORDER BY updated_at DESC').all() as any[]
    return rows.map(row => this.normalizePipelineRun(row))
  }

  createPipelineRun(data: Omit<PipelineRun, 'id' | 'created_at' | 'updated_at'>): PipelineRun {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO pipeline_runs (id, novel_id, run_id, completed_steps, current_step, model_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.novel_id,
      data.run_id,
      JSON.stringify(data.completed_steps || []),
      data.current_step,
      data.model_key,
      now,
      now
    )
    return this.getPipelineRunByRunId(data.run_id)!
  }

  updatePipelineRun(runId: string, data: Partial<Omit<PipelineRun, 'id' | 'created_at' | 'run_id'>>): PipelineRun | null {
    const existing = this.getPipelineRunByRunId(runId)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []

    const allowedFields: (keyof Omit<PipelineRun, 'id' | 'created_at' | 'run_id'>)[] = [
      'completed_steps', 'current_step', 'model_key'
    ]

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'completed_steps') {
          fields.push(`${field} = ?`)
          values.push(JSON.stringify(data[field]))
        } else {
          fields.push(`${field} = ?`)
          values.push(data[field])
        }
      }
    }

    if (fields.length === 0) return existing

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(runId)

    this.db.prepare(`UPDATE pipeline_runs SET ${fields.join(', ')} WHERE run_id = ?`).run(...values)
    return this.getPipelineRunByRunId(runId)
  }

  private normalizePipelineRun(row: any): PipelineRun {
    return {
      ...row,
      completed_steps: typeof row.completed_steps === 'string' ? JSON.parse(row.completed_steps || '[]') : (row.completed_steps || [])
    }
  }

  // ============ Pipeline Step Logs ============

  // [AGC:START] tool=Cc author=fangkun
  createStepLog(data: Omit<PipelineStepLog, 'id' | 'created_at'>): PipelineStepLog {
    const id = uuidv4()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO pipeline_step_logs (id, run_id, novel_id, template_id, input_variables, output, model_key, duration_ms, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.run_id,
      data.novel_id,
      data.template_id,
      JSON.stringify(data.input_variables || {}),
      data.output,
      data.model_key,
      data.duration_ms,
      data.status,
      data.error,
      now
    )
    return this.getStepLogById(id)!
  }

  getStepLogById(id: string): PipelineStepLog | null {
    const row = this.db.prepare('SELECT * FROM pipeline_step_logs WHERE id = ?').get(id) as any
    return row ? this.normalizeStepLog(row) : null
  }

  getStepLog(runId: string, templateId: string): PipelineStepLog | null {
    const row = this.db.prepare(
      'SELECT * FROM pipeline_step_logs WHERE run_id = ? AND template_id = ? AND status = 200 ORDER BY created_at DESC LIMIT 1'
    ).get(runId, templateId) as any
    return row ? this.normalizeStepLog(row) : null
  }

  listStepLogsByRunId(runId: string): PipelineStepLog[] {
    const rows = this.db.prepare(
      'SELECT * FROM pipeline_step_logs WHERE run_id = ? ORDER BY created_at ASC'
    ).all(runId) as any[]
    return rows.map(row => this.normalizeStepLog(row))
  }

  listStepLogsByNovelId(novelId: string): PipelineStepLog[] {
    const rows = this.db.prepare(
      'SELECT * FROM pipeline_step_logs WHERE novel_id = ? ORDER BY created_at DESC'
    ).all(novelId) as any[]
    return rows.map(row => this.normalizeStepLog(row))
  }

  private normalizeStepLog(row: any): PipelineStepLog {
    return {
      ...row,
      input_variables: typeof row.input_variables === 'string' ? JSON.parse(row.input_variables || '{}') : (row.input_variables || {})
    }
  }
  // [AGC:END]
}
// [AGC:END]
