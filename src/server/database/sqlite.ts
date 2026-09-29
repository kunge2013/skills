// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/database/sqlite.ts

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

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

  // Create tables
  createTables(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.')
  }
  return db
}

function createTables(db: Database.Database): void {
  // Novels table
  db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_text TEXT,
      content TEXT,
      character_text TEXT,
      script_text TEXT,
      storyboard_text TEXT,
      is_format_cleaned INTEGER DEFAULT 0,
      is_serial_cleaned INTEGER DEFAULT 0,
      is_punct_cleaned INTEGER DEFAULT 0,
      is_shot_cleaned INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

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
      FOREIGN KEY (novel_id) REFERENCES novels(id),
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
      FOREIGN KEY (novel_id) REFERENCES novels(id)
    )
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_novel ON pipeline_runs(novel_id)
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run ON pipeline_runs(run_id)
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
// [AGC:END]
