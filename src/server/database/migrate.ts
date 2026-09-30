// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/database/migrate.ts

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

interface OldNovel {
  id: string
  name: string
  original_text: string | null
  content: string | null
  character_text: string | null
  script_text: string | null
  storyboard_text: string | null
  is_format_cleaned: number
  is_serial_cleaned: number
  is_punct_cleaned: number
  is_shot_cleaned: number
  metadata: string
  created_at: number
  updated_at: number
}

interface CharacterData {
  name: string
  content?: string
  appearance?: string
  description?: string
  type?: string
}

export function runMigration(dataDir: string): void {
  const dbPath = path.join(dataDir, 'comic.db')

  if (!fs.existsSync(dbPath)) {
    console.log('[Migration] No database found, skipping migration')
    return
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  console.log('[Migration] Starting migration...')

  // Step 1: Check if old schema exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='novels'").all()
  if (tables.length === 0) {
    console.log('[Migration] No old novels table found, skipping')
    db.close()
    return
  }

  // Step 2: Check if migration already done (new tables exist)
  const newTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='novel_content'").all()
  if (newTables.length > 0) {
    console.log('[Migration] New tables already exist, skipping migration')
    db.close()
    return
  }

  // Step 3: Read old data
  console.log('[Migration] Reading old novels data...')
  const oldNovels = db.prepare('SELECT * FROM novels').all() as OldNovel[]

  if (oldNovels.length === 0) {
    console.log('[Migration] No novels to migrate')
    db.close()
    return
  }

  console.log(`[Migration] Found ${oldNovels.length} novels to migrate`)

  // Step 4: Create new tables
  console.log('[Migration] Creating new tables...')
  createNewTables(db)

  // Step 5: Migrate data
  const transaction = db.transaction(() => {
    for (const novel of oldNovels) {
      migrateNovel(db, novel)
    }
  })

  try {
    transaction()
    console.log('[Migration] Data migration completed')
  } catch (err) {
    console.error('[Migration] Error during data migration:', err)
    db.close()
    throw err
  }

  // Step 6: Rebuild novels table (drop old columns)
  console.log('[Migration] Rebuilding novels table...')
  rebuildNovelsTable(db)

  console.log('[Migration] Migration completed successfully!')
  db.close()
}

function createNewTables(db: Database.Database): void {
  // novel_content
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_content_novel_id ON novel_content(novel_id)`)

  // novel_character
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_character (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'character',
      appearance TEXT,
      description TEXT,
      order_index INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_character_novel_id ON novel_character(novel_id)`)

  // novel_character_tags
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_character_tags (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      tag_category TEXT NOT NULL,
      tag_value TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES novel_character(id) ON DELETE CASCADE
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_character_tags_character_id ON novel_character_tags(character_id)`)

  // novel_script
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_script_novel_id ON novel_script(novel_id)`)

  // novel_script_dialogue
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_script_dialogue_script_id ON novel_script_dialogue(script_id)`)

  // novel_storyboard
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_novel_storyboard_novel_id ON novel_storyboard(novel_id)`)
}

function migrateNovel(db: Database.Database, novel: OldNovel): void {
  const now = Date.now()

  // 1. Migrate to novel_content
  db.prepare(`
    INSERT INTO novel_content (id, novel_id, original_text, cleaned_text, is_format_cleaned, is_serial_cleaned, is_punct_cleaned, is_shot_cleaned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    novel.id,
    novel.original_text,
    novel.content,
    novel.is_format_cleaned,
    novel.is_serial_cleaned,
    novel.is_punct_cleaned,
    novel.is_shot_cleaned,
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
      console.warn(`[Migration] Failed to parse character_text for novel ${novel.id}:`, err)
      // Store as single character if not valid JSON
      db.prepare(`
        INSERT INTO novel_character (id, novel_id, name, type, description, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        novel.id,
        'Unknown',
        'character',
        novel.character_text,
        0,
        now,
        now
      )
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

  // Recreate indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_call_logs_novel_id ON comic_call_logs(novel_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_call_logs_run_id ON comic_call_logs(run_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON comic_call_logs(created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_novel ON pipeline_runs(novel_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run ON pipeline_runs(run_id)`)
}

// Allow running as standalone script
if (require.main === module) {
  const dataDir = process.argv[2] || path.join(__dirname, '../../../data')
  runMigration(dataDir)
}
