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
    testDb.pragma('foreign_keys = ON')

    // Use the same schema as the production sqlite.ts
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS novels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

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
      );

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
      );

      CREATE TABLE IF NOT EXISTS novel_character_tags (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        tag_category TEXT NOT NULL,
        tag_value TEXT NOT NULL,
        FOREIGN KEY (character_id) REFERENCES novel_character(id) ON DELETE CASCADE
      );

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
      );

      CREATE TABLE IF NOT EXISTS novel_script_dialogue (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        character_name TEXT,
        dialogue_text TEXT NOT NULL,
        order_index INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (script_id) REFERENCES novel_script(id) ON DELETE CASCADE
      );

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
        FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES comic_templates(id)
      );

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
      );

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

    it('PUT /comic/novels/:id - should update novel name', async () => {
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
        body: JSON.stringify({ name: '更新后' })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.name, '更新后')
    })

    it('DELETE /comic/novels/:id - should delete novel', async () => {
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

      const getResponse = await fetch(`${baseUrl}/comic/novels/${createdId}`)
      assert.strictEqual(getResponse.status, 404)
    })
  })

  describe('Novel Content API', () => {
    it('GET /comic/novels/:id/content - should get novel content', async () => {
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '内容测试', original_text: '这是原始内容' })
      })
      const createResult = await createResponse.json() as any
      const createdId = createResult.data.id

      const response = await fetch(`${baseUrl}/comic/novels/${createdId}/content`)
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.original_text, '这是原始内容')
    })

    it('PUT /comic/novels/:id/content - should update novel content', async () => {
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '内容更新测试', original_text: '原始内容' })
      })
      const createResult = await createResponse.json() as any
      const createdId = createResult.data.id

      const response = await fetch(`${baseUrl}/comic/novels/${createdId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleaned_text: '清洗后的内容', is_format_cleaned: true })
      })

      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.cleaned_text, '清洗后的内容')
      assert.strictEqual(result.data.is_format_cleaned, true)
    })
  })

  describe('Novel Characters API', () => {
    it('POST and GET /comic/novels/:id/characters - should create and list characters', async () => {
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '角色测试' })
      })
      const createResult = await createResponse.json() as any
      const novelId = createResult.data.id

      // Create characters
      await fetch(`${baseUrl}/comic/novels/${novelId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '唐僧', type: 'character', appearance: '袈裟', description: '取经人' })
      })
      await fetch(`${baseUrl}/comic/novels/${novelId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '孙悟空', type: 'character', appearance: '金甲' })
      })

      // List characters
      const response = await fetch(`${baseUrl}/comic/novels/${novelId}/characters`)
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.data.length, 2)
      assert.strictEqual(result.data[0].name, '唐僧')
      assert.strictEqual(result.data[1].name, '孙悟空')
    })
  })

  describe('Novel Scripts API', () => {
    it('POST and GET /comic/novels/:id/scripts - should create and list scripts', async () => {
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '剧本测试' })
      })
      const createResult = await createResponse.json() as any
      const novelId = createResult.data.id

      // Create script
      const scriptResponse = await fetch(`${baseUrl}/comic/novels/${novelId}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_number: 1, scene_location: '花果山', scene_description: '孙悟空出世' })
      })
      const scriptResult = await scriptResponse.json() as any
      assert.ok(scriptResult.data.id)

      // List scripts
      const response = await fetch(`${baseUrl}/comic/novels/${novelId}/scripts`)
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.data[0].scene_location, '花果山')
    })
  })

  describe('Novel Storyboards API', () => {
    it('POST and GET /comic/novels/:id/storyboards - should create and list storyboards', async () => {
      const createResponse = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '分镜测试' })
      })
      const createResult = await createResponse.json() as any
      const novelId = createResult.data.id

      // Create storyboards
      await fetch(`${baseUrl}/comic/novels/${novelId}/storyboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_number: 1, shot_type: '全景', content: '花果山全景' })
      })
      await fetch(`${baseUrl}/comic/novels/${novelId}/storyboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_number: 2, shot_type: '特写', content: '仙石崩裂' })
      })

      // List storyboards
      const response = await fetch(`${baseUrl}/comic/novels/${novelId}/storyboards`)
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.data.length, 2)
      assert.strictEqual(result.data[0].shot_type, '全景')
      assert.strictEqual(result.data[1].shot_type, '特写')
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

  // [AGC:START] tool=Cc author=fangkun
  describe('Pipeline Step Logs API', () => {
    it('GET /comic/pipeline/step-logs - should return 400 without params', async () => {
      const response = await fetch(`${baseUrl}/comic/pipeline/step-logs`)

      assert.strictEqual(response.status, 400)
    })

    it('GET /comic/pipeline/step-logs?run_id=xxx - should return step logs', async () => {
      // Arrange: create novel, pipeline run, and step logs
      const novelRes = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Step Log Test', original_text: 'Test content' })
      })
      const novel = (await novelRes.json() as any).data

      const template = service.listTemplates()[0]
      const runId = 'api-test-run-1'
      service.createPipelineRun({
        novel_id: novel.id,
        run_id: runId,
        completed_steps: [],
        current_step: null,
        model_key: 'test-model'
      })
      service.createStepLog({
        run_id: runId,
        novel_id: novel.id,
        template_id: template.id,
        input_variables: { original_text: 'Test content' },
        output: 'Step output text',
        model_key: 'test-model',
        duration_ms: 1000,
        status: 200,
        error: null
      })

      // Act
      const response = await fetch(`${baseUrl}/comic/pipeline/step-logs?run_id=${runId}`)

      // Assert
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.items.length, 1)
      assert.strictEqual(result.data.items[0].output, 'Step output text')
      assert.deepStrictEqual(result.data.items[0].input_variables, { original_text: 'Test content' })
    })

    it('GET /comic/pipeline/step-logs?novel_id=xxx - should return step logs by novel', async () => {
      // Arrange
      const novelRes = await fetch(`${baseUrl}/comic/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Novel Step Logs', original_text: 'Content' })
      })
      const novel = (await novelRes.json() as any).data

      const template = service.listTemplates()[0]
      service.createStepLog({
        run_id: 'novel-run-1',
        novel_id: novel.id,
        template_id: template.id,
        input_variables: {},
        output: 'Novel step output',
        model_key: 'test-model',
        duration_ms: 500,
        status: 200,
        error: null
      })

      // Act
      const response = await fetch(`${baseUrl}/comic/pipeline/step-logs?novel_id=${novel.id}`)

      // Assert
      assert.strictEqual(response.status, 200)
      const result = await response.json() as any
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.data.items.length, 1)
      assert.strictEqual(result.data.items[0].output, 'Novel step output')
    })
  })
  // [AGC:END]
})
// [AGC:END]
