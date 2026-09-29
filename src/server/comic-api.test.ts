// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import express from 'express'
import { registerComicRoutes } from './routes/comic'
import { ComicService } from './services/comic/service'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// [AGC:START] tool=Cc author=fangkun
describe('Comic API Routes', () => {
  let app: express.Express
  let server: http.Server
  let service: ComicService
  let db: Database.Database
  let testDbPath: string
  let baseUrl: string

  function createTestService(): { service: ComicService; db: Database.Database; dbPath: string } {
    const dbPath = path.join(__dirname, `../../data/test-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    const testDb = new Database(dbPath)
    testDb.pragma('journal_mode = WAL')

    testDb.exec(`
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
      );

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
      );

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
      );
    `)

    const testService = new ComicService(testDb)
    return { service: testService, db: testDb, dbPath }
  }

  before((_, done) => {
    const testSetup = createTestService()
    service = testSetup.service
    db = testSetup.db
    testDbPath = testSetup.dbPath

    app = express()
    app.use(express.json())

    const router = express.Router()
    registerComicRoutes(router, service)
    app.use(router)

    server = app.listen(0, () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        baseUrl = `http://localhost:${address.port}`
      }
      done()
    })
  })

  after((_, done) => {
    server.close(() => {
      db.close()
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath)
      }
      done()
    })
  })

  describe('Novels API', () => {
    it('POST /comic/novels - should create a novel', async () => {
      const response = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '测试小说',
          original_text: '这是原始内容'
        })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(result.data.id, 'Should return novel with id')
      assert.strictEqual(result.data.name, '测试小说')
    })

    it('GET /comic/novels - should list novels', async () => {
      const response = await fetch(`${baseUrl}/comic/novels?page=1&pageSize=20`)

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(Array.isArray(result.data.items), 'Should return items array')
      assert.ok(typeof result.data.total === 'number', 'Should return total count')
    })

    it('GET /comic/novels/:id - should get novel by id', async () => {
      // Create a novel first
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '查询测试', original_text: '内容' })
      })
      const createResult = await createResponse.json() as any
      const createdId = createResult.data.id

      const response = await fetch(`${baseUrl}/comic/novels/${createdId}`)
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.id, createdId)
      assert.strictEqual(result.data.name, '查询测试')
    })

    it('GET /comic/novels/:id - should return 404 for non-existent novel', async () => {
      const response = await fetch(`${baseUrl}/comic/novels/non-existent-id`)
      assert.strictEqual(response.status, 404)
    })

    it('PUT /comic/novels/:id - should update novel', async () => {
      // Create a novel first
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '更新前', original_text: '内容' })
      })
      const createResult = await createResponse.json() as any
      const createdId = createResult.data.id

      const response = await fetch(`${baseUrl}/comic/novels/${createdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '更新后', is_format_cleaned: true })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.name, '更新后')
      assert.strictEqual(result.data.is_format_cleaned, true)
    })

    it('DELETE /comic/novels/:id - should delete novel', async () => {
      // Create a novel first
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '删除测试', original_text: '内容' })
      })
      const createResult = await createResponse.json() as any
      const createdId = createResult.data.id

      const response = await fetch(`${baseUrl}/comic/novels/${createdId}`, {
        method: 'DELETE'
      })

      assert.strictEqual(response.status, 200)

      // Verify deletion
      const getResponse = await fetch(`${baseUrl}/comic/novels/${createdId}`)
      assert.strictEqual(getResponse.status, 404)
    })
  })

  describe('Templates API', () => {
    it('GET /comic/templates - should list all templates including builtins', async () => {
      const response = await fetch(`${baseUrl}/comic/templates`)

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(Array.isArray(result.data), 'Should return array')
      assert.ok(result.data.length > 0, 'Should have builtin templates')

      const builtinTemplates = result.data.filter((t: any) => t.is_builtin)
      assert.ok(builtinTemplates.length >= 10, 'Should have at least 10 builtin templates')
    })

    it('POST /comic/templates - should create custom template', async () => {
      const response = await fetch(`${baseUrl}/comic/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '自定义模板',
          description: '测试模板',
          category: 'cleaning',
          step_order: 99,
          system_prompt: '你是一个助手',
          input_variables: ['content'],
          is_builtin: false
        })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(result.data.id, 'Should return template with id')
      assert.strictEqual(result.data.name, '自定义模板')
      assert.strictEqual(result.data.is_builtin, false)
    })
  })

  describe('Call Logs API', () => {
    it('POST /comic/call-logs - should create call log', async () => {
      // Create novel and template first
      const novelResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '日志测试', original_text: '内容' })
      })
      const novelResult = await novelResponse.json() as any
      const novelId = novelResult.data.id

      const templatesResponse = await fetch(`${baseUrl}/comic/templates`)
      const templatesResult = await templatesResponse.json() as any
      const templateId = templatesResult.data[0].id

      const response = await fetch(`${baseUrl}/comic/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: 'run_test_1',
          novel_id: novelId,
          template_id: templateId,
          stage: 'format_clean',
          input_variables: { content: '测试内容' },
          output: '清洗后的内容',
          model_key: 'gpt-4o',
          duration_ms: 1500,
          status: 200
        })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(result.data.id, 'Should return log with id')
      assert.strictEqual(result.data.run_id, 'run_test_1')
      assert.strictEqual(result.data.output, '清洗后的内容')
    })

    it('GET /comic/call-logs - should list call logs with filters', async () => {
      const response = await fetch(`${baseUrl}/comic/call-logs?page=1&pageSize=20`)

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.ok(Array.isArray(result.data.items), 'Should return items array')
      assert.ok(typeof result.data.total === 'number', 'Should return total count')
    })
  })
})
// [AGC:END]
