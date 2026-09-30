// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/database/sqlite.ts

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database | null = null

// [AGC:START] tool=Cc author=fangkun
export function initDatabase(dataDir: string): Database.Database {
  if (db) return db

  const dbPath = path.join(dataDir, 'comic.db')
  const dbDir = path.dirname(dbPath)

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL')

  // Enable foreign key support for cascade deletes
  db.pragma('foreign_keys = ON')

  // Check if migration is needed (old schema exists)
  const needsMigration = checkNeedsMigration(db)

  if (needsMigration) {
    console.log('[DB] Old schema detected, running migration...')
    runMigration(db)
  }

  // Create tables (new schema)
  createTables(db)

  return db
}

function checkNeedsMigration(db: Database.Database): boolean {
  // Check if novels table exists
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='novels'").all()
  if (tableCheck.length === 0) return false // No novels table, fresh install

  // Check if novels table has old columns (original_text)
  try {
    const columnCheck = db.prepare("PRAGMA table_info(novels)").all() as { name: string }[]
    const hasOldColumns = columnCheck.some(col => col.name === 'original_text' || col.name === 'content')
    return hasOldColumns
  } catch {
    return false
  }
}

function runMigration(db: Database.Database): void {
  console.log('[Migration] Starting migration...')

  // Read old data
  const oldNovels = db.prepare('SELECT * FROM novels').all() as any[]

  if (oldNovels.length === 0) {
    console.log('[Migration] No novels to migrate')
    // Just rebuild the table
    rebuildNovelsTable(db)
    return
  }

  console.log(`[Migration] Found ${oldNovels.length} novels to migrate`)

  // Create new sub-tables first (before rebuilding novels)
  createSubTables(db)

  // Migrate data
  const transaction = db.transaction(() => {
    for (const novel of oldNovels) {
      migrateNovel(db, novel)
    }
  })

  transaction()
  console.log('[Migration] Data migration completed')

  // Rebuild novels table (drop old columns)
  rebuildNovelsTable(db)

  console.log('[Migration] Migration completed successfully!')
}

interface CharacterData {
  name: string
  content?: string
  appearance?: string
  description?: string
  type?: string
}

function migrateNovel(db: Database.Database, novel: any): void {
  const now = Date.now()

  // 1. Migrate to novel_content
  db.prepare(`
    INSERT INTO novel_content (id, novel_id, original_text, cleaned_text, is_format_cleaned, is_serial_cleaned, is_punct_cleaned, is_shot_cleaned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    novel.id,
    novel.original_text || null,
    novel.content || null,
    novel.is_format_cleaned || 0,
    novel.is_serial_cleaned || 0,
    novel.is_punct_cleaned || 0,
    novel.is_shot_cleaned || 0,
    novel.created_at,
    novel.updated_at
  )

  // 2. Migrate characters (parse JSON)
  if (novel.character_text) {
    try {
      const characters: CharacterData[] = JSON.parse(novel.character_text)
      if (Array.isArray(characters)) {
        characters.forEach((char, index) => {
          db.prepare(`
            INSERT INTO novel_character (id, novel_id, name, type, appearance, description, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            novel.id,
            char.name || 'Unknown',
            char.type || 'character',
            char.appearance || null,
            char.content || char.description || null,
            index,
            now,
            now
          )
        })
      }
    } catch (err) {
      console.warn(`[Migration] Failed to parse character_text for novel ${novel.id}, storing as-is`)
    }
  }

  // 3. Migrate script (store as single scene)
  if (novel.script_text) {
    db.prepare(`
      INSERT INTO novel_script (id, novel_id, scene_number, scene_description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      novel.id,
      1,
      novel.script_text,
      0,
      now,
      now
    )
  }

  // 4. Migrate storyboard (store as single frame)
  if (novel.storyboard_text) {
    db.prepare(`
      INSERT INTO novel_storyboard (id, novel_id, frame_number, content, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      novel.id,
      1,
      novel.storyboard_text,
      0,
      now,
      now
    )
  }

  console.log(`[Migration] Migrated novel: ${novel.name}`)
}

// [AGC:START] tool=Cc author=fangkun
function rebuildNovelsTable(db: Database.Database): void {
  // SQLite doesn't support DROP COLUMN, so we need to recreate the table.
  // Must temporarily disable foreign keys since DROP TABLE triggers FK checks.
  db.exec(`PRAGMA foreign_keys = OFF`)

  try {
    db.exec(`
      CREATE TABLE novels_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    db.exec(`INSERT INTO novels_new (id, name, metadata, created_at, updated_at) SELECT id, name, metadata, created_at, updated_at FROM novels`)

    db.exec(`DROP TABLE novels`)

    db.exec(`ALTER TABLE novels_new RENAME TO novels`)
  } finally {
    db.exec(`PRAGMA foreign_keys = ON`)
  }

  console.log('[Migration] Rebuilt novels table with new schema')
}
// [AGC:END]

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.')
  }
  return db
}

// [AGC:START] tool=Cc author=fangkun
function createSubTables(db: Database.Database): void {
  // Novel content table — original + cleaned text (1:1 with novels)
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_content (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL UNIQUE,
      original_text TEXT,
      cleaned_text TEXT,
      is_format_cleaned INTEGER DEFAULT 0,
      is_serial_cleaned INTEGER DEFAULT 0,
      is_punct_cleaned INTEGER DEFAULT 0,
      is_shot_cleaned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_content_novel_id ON novel_content(novel_id)
  `)

  // Novel characters table — one row per character/scene/prop
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_character (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      appearance TEXT,
      description TEXT,
      order_index INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_character_novel_id ON novel_character(novel_id)
  `)

  // Novel character tags — one row per tag (normalized from traits)
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_character_tags (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      tag_category TEXT NOT NULL,
      tag_value TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES novel_character(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_character_tags_character_id ON novel_character_tags(character_id)
  `)

  // Novel scripts — one row per scene
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_script (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      scene_number INTEGER,
      scene_location TEXT,
      scene_time TEXT,
      scene_description TEXT,
      order_index INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_script_novel_id ON novel_script(novel_id)
  `)

  // Novel script dialogue — one row per dialogue line
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_script_dialogue (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      character_name TEXT,
      dialogue_text TEXT NOT NULL,
      order_index INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (script_id) REFERENCES novel_script(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_script_dialogue_script_id ON novel_script_dialogue(script_id)
  `)

  // Novel storyboards — one row per frame
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_storyboard (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      frame_number INTEGER,
      shot_type TEXT,
      camera_angle TEXT,
      content TEXT,
      characters TEXT,
      image_prompt TEXT,
      subtitles TEXT,
      notes TEXT,
      order_index INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_novel_storyboard_novel_id ON novel_storyboard(novel_id)
  `)
}
// [AGC:END]

function createTables(db: Database.Database): void {
  // Enable foreign key support for cascade deletes
  db.pragma('foreign_keys = ON')

  // Novels table — slim metadata only
  db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Create all sub-tables (safe to call multiple times via IF NOT EXISTS)
  createSubTables(db)

  // Comic templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comic_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      step_order INTEGER,
      depend_on TEXT,
      system_prompt TEXT NOT NULL,
      user_prompt TEXT,
      input_variables TEXT DEFAULT '[]',
      is_builtin INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Comic call logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comic_call_logs (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      novel_id TEXT,
      template_id TEXT,
      stage TEXT,
      input_variables TEXT DEFAULT '{}',
      output TEXT,
      model_key TEXT,
      duration_ms INTEGER,
      status INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES comic_templates(id)
    )
  `)

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_call_logs_novel_id ON comic_call_logs(novel_id)
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_call_logs_run_id ON comic_call_logs(run_id)
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON comic_call_logs(created_at)
  `)

  // Pipeline runs table - track execution progress for resumption
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      completed_steps TEXT DEFAULT '[]',
      current_step TEXT,
      model_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_novel ON pipeline_runs(novel_id)
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run ON pipeline_runs(run_id)
  `)

  // Pipeline step logs — per-step input/output persistence
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_step_logs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      novel_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      input_variables TEXT DEFAULT '{}',
      output TEXT,
      model_key TEXT,
      duration_ms INTEGER,
      status INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_step_logs_run ON pipeline_step_logs(run_id)
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_step_logs_novel ON pipeline_step_logs(novel_id)
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
// [AGC:END]
