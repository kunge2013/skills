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
        status: 200,
        error: null
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
        status: 200,
        error: null
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
        status: 200,
        error: null
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

      // Also verify content was created
      const content = service.getNovelContent(created.id)
      assert.ok(content, 'Novel content should be created')
      assert.strictEqual(content!.original_text, novelData.original_text)
    })

    it('should return empty list when no novels exist', () => {
      // Act
      const result = service.listNovels(1, 20)

      // Assert
      assert.strictEqual(result.items.length, 0, 'Should have 0 novels')
      assert.strictEqual(result.total, 0, 'Total should be 0')
    })

    it('should update novel content progress flags', () => {
      // Arrange
      const novel = service.createNovel({ name: '测试小说', original_text: '原始内容' })

      // Act - update content
      const updatedContent = service.updateNovelContent(novel.id, {
        cleaned_text: '清洗后的内容',
        is_format_cleaned: true,
        is_serial_cleaned: true
      })

      // Assert
      assert.ok(updatedContent, 'Content should be updated')
      assert.strictEqual(updatedContent!.cleaned_text, '清洗后的内容')
      assert.strictEqual(updatedContent!.is_format_cleaned, true)
      assert.strictEqual(updatedContent!.is_serial_cleaned, true)
      assert.strictEqual(updatedContent!.is_punct_cleaned, false)
    })

    it('should cascade delete novel and all sub-resources', () => {
      // Arrange
      const novel = service.createNovel({ name: '测试小说', original_text: '内容' })
      service.createNovelCharacter(novel.id, { name: '唐僧', type: 'character' })
      service.createNovelScript(novel.id, { scene_number: 1, scene_description: '场景1' })
      service.createNovelStoryboard(novel.id, { frame_number: 1, content: '分镜1' })

      // Act
      const deleted = service.deleteNovel(novel.id)

      // Assert
      assert.strictEqual(deleted, true, 'Novel should be deleted')
      assert.strictEqual(service.getNovel(novel.id), null, 'Novel should not exist')
      assert.strictEqual(service.getNovelContent(novel.id), null, 'Content should be cascade deleted')
      assert.strictEqual(service.listNovelCharacters(novel.id).length, 0, 'Characters should be cascade deleted')
      assert.strictEqual(service.listNovelScripts(novel.id).length, 0, 'Scripts should be cascade deleted')
      assert.strictEqual(service.listNovelStoryboards(novel.id).length, 0, 'Storyboards should be cascade deleted')
    })
  })

  describe('Novel Characters', () => {
    it('should create and list characters', () => {
      const novel = service.createNovel({ name: '西游记' })
      const char = service.createNovelCharacter(novel.id, {
        name: '孙悟空',
        type: 'character',
        appearance: '金甲',
        description: '齐天大圣',
        order_index: 0,
      })
      assert.ok(char.id)
      assert.strictEqual(char.name, '孙悟空')

      const chars = service.listNovelCharacters(novel.id)
      assert.strictEqual(chars.length, 1)
    })

    it('should create and list character tags', () => {
      const novel = service.createNovel({ name: '西游记' })
      const char = service.createNovelCharacter(novel.id, { name: '唐僧', type: 'character' })
      service.createNovelCharacterTag(char.id, { tag_category: '类型', tag_value: '角色' })
      service.createNovelCharacterTag(char.id, { tag_category: '时空', tag_value: '古代' })

      const tags = service.listNovelCharacterTags(char.id)
      assert.strictEqual(tags.length, 2)
    })
  })

  describe('Novel Scripts and Dialogues', () => {
    it('should create scripts with dialogues', () => {
      const novel = service.createNovel({ name: '西游记' })
      const script = service.createNovelScript(novel.id, {
        scene_number: 1,
        scene_location: '花果山',
        scene_time: '日',
        scene_description: '孙悟空出世',
        order_index: 0,
      })
      assert.ok(script.id)

      service.createNovelScriptDialogue(script.id, {
        character_name: '孙悟空',
        dialogue_text: '俺老孙来也！',
        order_index: 0,
      })
      service.createNovelScriptDialogue(script.id, {
        character_name: null,
        dialogue_text: '（旁白）花果山上，一块仙石崩裂...',
        order_index: 1,
      })

      const dialogues = service.listScriptDialogues(script.id)
      assert.strictEqual(dialogues.length, 2)
      assert.strictEqual(dialogues[0].character_name, '孙悟空')
      assert.strictEqual(dialogues[1].character_name, null)
    })
  })

  describe('Novel Storyboards', () => {
    it('should create and list storyboards', () => {
      const novel = service.createNovel({ name: '西游记' })
      service.createNovelStoryboard(novel.id, {
        frame_number: 1,
        shot_type: '全景',
        camera_angle: '俯视',
        content: '花果山全景',
        characters: '孙悟空',
        image_prompt: '一座仙山...',
        order_index: 0,
      })
      service.createNovelStoryboard(novel.id, {
        frame_number: 2,
        shot_type: '特写',
        content: '仙石崩裂',
        order_index: 1,
      })

      const storyboards = service.listNovelStoryboards(novel.id)
      assert.strictEqual(storyboards.length, 2)
      assert.strictEqual(storyboards[0].shot_type, '全景')
      assert.strictEqual(storyboards[1].shot_type, '特写')
    })
  })

  describe('End-to-End Pipeline Flow', () => {
    it('should execute complete pipeline from novel to storyboard', () => {
      // Step 1: Create a novel (also creates novel_content)
      const novel = service.createNovel({
        name: '西游记',
        original_text: '话说唐僧师徒四人西天取经...'
      })
      assert.ok(novel.id, 'Novel created')

      // Verify content was created
      const content = service.getNovelContent(novel.id)
      assert.ok(content, 'Novel content should be created')
      assert.strictEqual(content!.original_text, '话说唐僧师徒四人西天取经...')

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
        input_variables: { content: content!.original_text || '' },
        output: '清洗后的内容...',
        model_key: 'gpt-4o',
        duration_ms: 1500,
        status: 200,
        error: null
      })
      assert.ok(cleanLog.id, 'Clean log created')

      // Step 4: Update novel content with cleaned text
      service.updateNovelContent(novel.id, {
        cleaned_text: '清洗后的内容...',
        is_format_cleaned: true
      })
      const updatedContent = service.getNovelContent(novel.id)
      assert.strictEqual(updatedContent!.is_format_cleaned, true)
      assert.strictEqual(updatedContent!.cleaned_text, '清洗后的内容...')

      // Step 5: Execute extraction stage
      const extractTemplate = extractionTemplates[0]
      const extractLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: extractTemplate.id,
        stage: 'extract',
        input_variables: { content: updatedContent!.cleaned_text || '' },
        output: '角色：唐僧、孙悟空、猪八戒、沙僧',
        model_key: 'gpt-4o',
        duration_ms: 2000,
        status: 200,
        error: null
      })
      assert.ok(extractLog.id, 'Extract log created')

      // Step 6: Create characters from extraction output
      service.createNovelCharacter(novel.id, { name: '唐僧', type: 'character', order_index: 0 })
      service.createNovelCharacter(novel.id, { name: '孙悟空', type: 'character', order_index: 1 })
      const chars = service.listNovelCharacters(novel.id)
      assert.strictEqual(chars.length, 2)

      // Step 7: Execute script stage
      const scriptTemplate = scriptTemplates[0]
      const scriptLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: scriptTemplate.id,
        stage: 'script',
        input_variables: {
          content: updatedContent!.cleaned_text || '',
          character_text: '角色：唐僧、孙悟空'
        },
        output: '第一幕：唐僧师徒四人走在西行路上...',
        model_key: 'gpt-4o',
        duration_ms: 3000,
        status: 200,
        error: null
      })
      assert.ok(scriptLog.id, 'Script log created')

      // Step 8: Create script from output
      const script = service.createNovelScript(novel.id, {
        scene_number: 1,
        scene_location: '西行路上',
        scene_time: '日',
        scene_description: '第一幕：唐僧师徒四人走在西行路上',
        order_index: 0,
      })
      service.createNovelScriptDialogue(script.id, {
        character_name: '唐僧',
        dialogue_text: '悟空，前方是何处？',
        order_index: 0,
      })

      // Step 9: Execute storyboard stage
      const storyboardTemplate = storyboardTemplates[0]
      const storyboardLog = service.createCallLog({
        run_id: 'run_pipeline_1',
        novel_id: novel.id,
        template_id: storyboardTemplate.id,
        stage: 'storyboard',
        input_variables: { script_text: '第一幕：唐僧师徒四人走在西行路上...' },
        output: '分镜1：全景\n分镜2：特写',
        model_key: 'gpt-4o',
        duration_ms: 2500,
        status: 200,
        error: null
      })
      assert.ok(storyboardLog.id, 'Storyboard log created')

      // Step 10: Create storyboards from output
      service.createNovelStoryboard(novel.id, { frame_number: 1, shot_type: '全景', content: '四人走在山路上', order_index: 0 })
      service.createNovelStoryboard(novel.id, { frame_number: 2, shot_type: '特写', content: '孙悟空探路', order_index: 1 })

      // Step 11: Verify all call logs for this run
      const runLogs = service.listCallLogs({ novel_id: novel.id }, 1, 20)
      assert.strictEqual(runLogs.items.length, 4, 'Should have 4 logs for complete pipeline')

      // Step 12: Verify all sub-resources
      assert.strictEqual(service.listNovelCharacters(novel.id).length, 2, 'Should have 2 characters')
      assert.strictEqual(service.listNovelScripts(novel.id).length, 1, 'Should have 1 script')
      assert.strictEqual(service.listScriptDialogues(script.id).length, 1, 'Should have 1 dialogue')
      assert.strictEqual(service.listNovelStoryboards(novel.id).length, 2, 'Should have 2 storyboards')

      // Step 13: Verify stages
      const stages = runLogs.items.map(l => l.stage).sort()
      assert.deepStrictEqual(stages, ['extract', 'format_clean', 'script', 'storyboard'].sort(),
        'Logs should contain all 4 pipeline stages')
    })
  })

  // [AGC:START] tool=Cc author=fangkun
  describe('Pipeline Step Logs', () => {
    it('should create and retrieve step logs', () => {
      // Arrange
      const novel = service.createNovel({ name: 'Test Novel', original_text: 'Hello world' })
      const template = service.listTemplates()[0]
      const runId = 'test-run-1'
      service.createPipelineRun({
        novel_id: novel.id,
        run_id: runId,
        completed_steps: [],
        current_step: template.id,
        model_key: 'test-model'
      })

      // Act
      const stepLog = service.createStepLog({
        run_id: runId,
        novel_id: novel.id,
        template_id: template.id,
        input_variables: { original_text: 'Hello world' },
        output: 'Cleaned text output',
        model_key: 'test-model',
        duration_ms: 1500,
        status: 200,
        error: null
      })

      // Assert
      assert.ok(stepLog.id)
      assert.strictEqual(stepLog.run_id, runId)
      assert.strictEqual(stepLog.template_id, template.id)
      assert.deepStrictEqual(stepLog.input_variables, { original_text: 'Hello world' })
      assert.strictEqual(stepLog.output, 'Cleaned text output')
      assert.strictEqual(stepLog.status, 200)
    })

    it('should list step logs by run_id', () => {
      // Arrange
      const novel = service.createNovel({ name: 'Test Novel', original_text: 'Test' })
      const templates = service.listTemplates()
      const runId = 'test-run-2'
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
        template_id: templates[0].id,
        input_variables: { original_text: 'Test' },
        output: 'Output 1',
        model_key: 'test-model',
        duration_ms: 1000,
        status: 200,
        error: null
      })
      service.createStepLog({
        run_id: runId,
        novel_id: novel.id,
        template_id: templates[1].id,
        input_variables: { content: 'Output 1' },
        output: 'Output 2',
        model_key: 'test-model',
        duration_ms: 2000,
        status: 200,
        error: null
      })

      // Act
      const logs = service.listStepLogsByRunId(runId)

      // Assert
      assert.strictEqual(logs.length, 2)
      assert.strictEqual(logs[0].output, 'Output 1')
      assert.strictEqual(logs[1].output, 'Output 2')
    })

    it('should get step log by run_id and template_id', () => {
      // Arrange
      const novel = service.createNovel({ name: 'Test Novel', original_text: 'Test' })
      const template = service.listTemplates()[0]
      const runId = 'test-run-3'
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
        input_variables: {},
        output: 'Success output',
        model_key: 'test-model',
        duration_ms: 500,
        status: 200,
        error: null
      })

      // Act
      const log = service.getStepLog(runId, template.id)

      // Assert
      assert.ok(log)
      assert.strictEqual(log!.output, 'Success output')
    })

    it('should save error step logs', () => {
      // Arrange
      const novel = service.createNovel({ name: 'Test Novel', original_text: 'Test' })
      const template = service.listTemplates()[0]
      const runId = 'test-run-4'
      service.createPipelineRun({
        novel_id: novel.id,
        run_id: runId,
        completed_steps: [],
        current_step: null,
        model_key: 'test-model'
      })

      // Act
      const errorLog = service.createStepLog({
        run_id: runId,
        novel_id: novel.id,
        template_id: template.id,
        input_variables: { original_text: 'Test' },
        output: null,
        model_key: 'test-model',
        duration_ms: 300,
        status: 500,
        error: 'LLM API timeout'
      })

      // Assert
      assert.strictEqual(errorLog.status, 500)
      assert.strictEqual(errorLog.error, 'LLM API timeout')
      assert.strictEqual(errorLog.output, null)
    })
  })
  // [AGC:END]
})
// [AGC:END]
