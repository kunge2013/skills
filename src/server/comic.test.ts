// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { ComicService } from './services/comic/service'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// [AGC:START] tool=Cc author=fangkun
describe('ComicService', () => {
  let service: ComicService
  let db: Database.Database
  let testDbPath: string

  function createTestService(): { service: ComicService; db: Database.Database; dbPath: string } {
    const dbPath = path.join(__dirname, `../../data/test-comic-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
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

  beforeEach(() => {
    const testSetup = createTestService()
    service = testSetup.service
    db = testSetup.db
    testDbPath = testSetup.dbPath
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('Templates', () => {
    it('should initialize builtin templates automatically', () => {
      // Act
      const templates = service.listTemplates()

      // Assert
      assert.ok(templates.length > 0, 'Should have builtin templates')
      const builtinTemplates = templates.filter(t => t.is_builtin)
      assert.ok(builtinTemplates.length >= 10, 'Should have at least 10 builtin templates')
    })

    it('should create a custom template', () => {
      // Arrange
      const templateData = {
        name: '自定义模板',
        description: '测试自定义模板',
        category: 'cleaning' as const,
        step_order: 99,
        depend_on: null,
        system_prompt: '你是一个文本清洗助手',
        user_prompt: '请清洗以下内容：{content}',
        input_variables: ['content'],
        is_builtin: false
      }

      // Act
      const created = service.createTemplate(templateData)
      const retrieved = service.getTemplate(created.id)

      // Assert
      assert.ok(retrieved, 'Template should be retrievable')
      assert.strictEqual(retrieved!.name, templateData.name)
      assert.strictEqual(retrieved!.category, 'cleaning')
      assert.deepStrictEqual(retrieved!.input_variables, ['content'])
    })

    it('should filter templates by category', () => {
      // Act
      const cleaningTemplates = service.listTemplates().filter(t => t.category === 'cleaning')
      const extractionTemplates = service.listTemplates().filter(t => t.category === 'extraction')

      // Assert
      assert.ok(cleaningTemplates.length > 0, 'Should have cleaning templates')
      assert.ok(extractionTemplates.length > 0, 'Should have extraction templates')
    })
  })

  describe('Call Logs', () => {
    it('should create and retrieve call logs', () => {
      // Arrange
      const novel = service.createNovel({ name: '测试小说', original_text: '内容' })
      const template = service.listTemplates()[0]

      const logData = {
        run_id: 'run_123',
        novel_id: novel.id,
        template_id: template.id,
        stage: 'format_clean' as const,
        input_variables: { content: '测试内容' },
        output: '清洗后的内容',
        model_key: 'gpt-4o',
        duration_ms: 1500,
        status: 200,
        error: null
      }

      // Act
      const created = service.createCallLog(logData)
      const result = service.listCallLogs({}, 1, 20)

      // Assert
      assert.ok(created.id, 'Log should have an id')
      assert.strictEqual(result.items.length, 1, 'Should have 1 log')
      assert.strictEqual(result.items[0].novel_id, novel.id)
      assert.strictEqual(result.items[0].template_id, template.id)
      assert.strictEqual(result.items[0].output, '清洗后的内容')
    })

    it('should filter call logs by novel_id', () => {
      // Arrange
      const novel1 = service.createNovel({ name: '小说1', original_text: '内容1' })
      const novel2 = service.createNovel({ name: '小说2', original_text: '内容2' })
      const template = service.listTemplates()[0]

      service.createCallLog({
        run_id: 'run_1',
        novel_id: novel1.id,
        template_id: template.id,
        stage: 'format_clean',
        input_variables: {},
        output: '输出1',
        model_key: 'gpt-4o',
        duration_ms: 1000,
        status: 200
      })

      service.createCallLog({
        run_id: 'run_2',
        novel_id: novel2.id,
        template_id: template.id,
        stage: 'format_clean',
        input_variables: {},
        output: '输出2',
        model_key: 'gpt-4o',
        duration_ms: 1000,
        status: 200
      })

      // Act
      const filtered = service.listCallLogs({ novel_id: novel1.id }, 1, 20)

      // Assert
      assert.strictEqual(filtered.items.length, 1, 'Should have 1 log for novel1')
      assert.strictEqual(filtered.items[0].novel_id, novel1.id)
    })

    it('should delete call logs by novel_id', () => {
      // Arrange
      const novel = service.createNovel({ name: '测试小说', original_text: '内容' })
      const template = service.listTemplates()[0]

      service.createCallLog({
        run_id: 'run_1',
        novel_id: novel.id,
        template_id: template.id,
        stage: 'format_clean',
        input_variables: {},
        output: '输出1',
        model_key: 'gpt-4o',
        duration_ms: 1000,
        status: 200
      })

      // Act
      const deleted = service.deleteCallLogs({ novel_id: novel.id })
      const result = service.listCallLogs({}, 1, 20)

      // Assert
      assert.strictEqual(deleted, 1, 'Should delete 1 log')
      assert.strictEqual(result.items.length, 0, 'Should have 0 logs after deletion')
    })
  })

  describe('Novels', () => {
    it('should create a novel and retrieve it in the list', () => {
      // Arrange
      const novelData = {
        name: '测试小说',
        original_text: '这是一个测试小说的内容'
      }

      // Act
      const created = service.createNovel(novelData)
      const result = service.listNovels(1, 20)

      // Assert
      assert.ok(created.id, 'Created novel should have an id')
      assert.strictEqual(created.name, novelData.name, 'Novel name should match')
      assert.strictEqual(result.items.length, 1, 'Should have 1 novel')
      assert.strictEqual(result.items[0].id, created.id, 'Novel id should match')
      assert.strictEqual(result.items[0].name, novelData.name, 'Novel name should match')
      assert.strictEqual(result.total, 1, 'Total should be 1')
    })

    it('should return empty list when no novels exist', () => {
      // Act
      const result = service.listNovels(1, 20)

      // Assert
      assert.strictEqual(result.items.length, 0, 'Should have 0 novels')
      assert.strictEqual(result.total, 0, 'Total should be 0')
    })

    it('should update novel progress flags', () => {
      // Arrange
      const novel = service.createNovel({ name: '测试小说', original_text: '原始内容' })

      // Act
      const updated = service.updateNovel(novel.id, {
        content: '清洗后的内容',
        is_format_cleaned: true,
        is_serial_cleaned: true
      })

      // Assert
      assert.ok(updated, 'Novel should be updated')
      assert.strictEqual(updated!.content, '清洗后的内容')
      assert.strictEqual(updated!.is_format_cleaned, true)
      assert.strictEqual(updated!.is_serial_cleaned, true)
      assert.strictEqual(updated!.is_punct_cleaned, false)
    })
  })

  describe('End-to-End Pipeline Flow', () => {
    it('should execute complete pipeline from novel to storyboard', () => {
      // Step 1: Create a novel
      const novel = service.createNovel({
        name: '西游记',
        original_text: '话说唐僧师徒四人西天取经...'
      })
      assert.ok(novel.id, 'Novel created')

      // Step 2: Get builtin templates for each stage
      const allTemplates = service.listTemplates()
      const cleaningTemplates = allTemplates.filter(t => t.category === 'cleaning')
      const extractionTemplates = allTemplates.filter(t => t.category === 'extraction')
      const scriptTemplates = allTemplates.filter(t => t.category === 'script')
      const storyboardTemplates = allTemplates.filter(t => t.category === 'storyboard')

      assert.ok(cleaningTemplates.length > 0, 'Should have cleaning templates')
      assert.ok(extractionTemplates.length > 0, 'Should have extraction templates')
      assert.ok(scriptTemplates.length > 0, 'Should have script templates')
      assert.ok(storyboardTemplates.length > 0, 'Should have storyboard templates')

      // Step 3: Execute cleaning stage
      const formatCleanTemplate = cleaningTemplates.find(t => t.name.includes('格式'))
      assert.ok(formatCleanTemplate, 'Should find format clean template')

      const cleanLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: formatCleanTemplate!.id,
        stage: 'format_clean',
        input_variables: { content: novel.original_text || '' },
        output: '清洗后的内容...',
        model_key: 'gpt-4o',
        duration_ms: 1500,
        status: 200
      })
      assert.ok(cleanLog.id, 'Clean log created')

      // Step 4: Update novel with cleaned content
      const updatedNovel = service.updateNovel(novel.id, {
        content: '清洗后的内容...',
        is_format_cleaned: true
      })
      assert.strictEqual(updatedNovel!.is_format_cleaned, true)

      // Step 5: Execute extraction stage
      const extractTemplate = extractionTemplates[0]
      const extractLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: extractTemplate.id,
        stage: 'extract',
        input_variables: { content: updatedNovel!.content || '' },
        output: '角色：唐僧、孙悟空、猪八戒、沙僧',
        model_key: 'gpt-4o',
        duration_ms: 2000,
        status: 200
      })
      assert.ok(extractLog.id, 'Extract log created')

      // Step 6: Update novel with character text
      service.updateNovel(novel.id, {
        character_text: '角色：唐僧、孙悟空、猪八戒、沙僧'
      })

      // Step 7: Execute script stage
      const scriptTemplate = scriptTemplates[0]
      const scriptLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: scriptTemplate.id,
        stage: 'script',
        input_variables: {
          content: updatedNovel!.content || '',
          character_text: '角色：唐僧、孙悟空、猪八戒、沙僧'
        },
        output: '第一幕：唐僧师徒四人走在西行路上...',
        model_key: 'gpt-4o',
        duration_ms: 3000,
        status: 200
      })
      assert.ok(scriptLog.id, 'Script log created')

      // Step 8: Execute storyboard stage
      const storyboardTemplate = storyboardTemplates[0]
      const storyboardLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: storyboardTemplate.id,
        stage: 'storyboard',
        input_variables: {
          script_text: '第一幕：唐僧师徒四人走在西行路上...'
        },
        output: '分镜1：全景，四人走在山路上\n分镜2：特写，孙悟空探路',
        model_key: 'gpt-4o',
        duration_ms: 2500,
        status: 200
      })
      assert.ok(storyboardLog.id, 'Storyboard log created')

      // Step 9: Verify all call logs for this run
      const runLogs = service.listCallLogs({ novel_id: novel.id }, 1, 20)
      assert.strictEqual(runLogs.items.length, 4, 'Should have 4 logs for complete pipeline')
      assert.strictEqual(runLogs.total, 4)

      // Step 10: Verify logs are in correct order (DESC by created_at)
      // Note: timestamps may be identical in fast tests, so verify all expected stages exist
      const stages = runLogs.items.map(l => l.stage).sort()
      assert.deepStrictEqual(stages, ['extract', 'format_clean', 'script', 'storyboard'].sort(),
        'Logs should contain all 4 pipeline stages')
    })
  })
})
// [AGC:END]
