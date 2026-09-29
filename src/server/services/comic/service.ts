// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/services/comic/service.ts

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  Novel,
  ComicTemplate,
  ComicCallLog,
  ComicCallLogFilter,
  Paginated,
  ComicCategory,
  ComicStage
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
    this.db.prepare(`
      INSERT INTO novels (id, name, original_text, content, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, '{}', ?, ?)
    `).run(id, data.name, data.original_text || null, data.content || null, now, now)
    return this.getNovel(id)!
  }

  updateNovel(id: string, data: Partial<Omit<Novel, 'id' | 'created_at'>>): Novel | null {
    const existing = this.getNovel(id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []

    const allowedFields: (keyof Omit<Novel, 'id' | 'created_at'>)[] = [
      'name', 'original_text', 'content', 'character_text', 'script_text', 'storyboard_text',
      'is_format_cleaned', 'is_serial_cleaned', 'is_punct_cleaned', 'is_shot_cleaned', 'metadata'
    ]

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'metadata') {
          fields.push(`${field} = ?`)
          values.push(JSON.stringify(data[field]))
        } else if (typeof data[field] === 'boolean') {
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
      is_format_cleaned: !!row.is_format_cleaned,
      is_serial_cleaned: !!row.is_serial_cleaned,
      is_punct_cleaned: !!row.is_punct_cleaned,
      is_shot_cleaned: !!row.is_shot_cleaned,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {})
    }
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

  createTemplate(data: Omit<ComicTemplate, 'id' | 'created_at' | 'updated_at'>): ComicTemplate {
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
}
// [AGC:END]
