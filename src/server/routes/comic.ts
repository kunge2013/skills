// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/routes/comic.ts

import { Router } from 'express'
import { ComicService } from '../services/comic/service'
import type { ComicCategory, ComicStage } from '../services/comic/types'
import type { LLMService } from '../services/llm/service'
import type { Message } from '../services/llm/types'

// [AGC:START] tool=Cc author=fangkun
export function registerComicRoutes(router: Router, comicService: ComicService, llmService?: LLMService) {
  // ============ Novels ============

  // GET /comic/novels - List novels
  router.get('/comic/novels', (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const pageSize = parseInt(req.query.pageSize as string) || 20
      const result = comicService.listNovels(page, pageSize)
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/novels/:id/latest-run - Get latest pipeline run for novel
  // NOTE: This must be registered BEFORE /novels/:id to avoid route conflict
  router.get('/comic/novels/:id/latest-run', (req, res) => {
    try {
      const run = comicService.getLatestPipelineRunByNovelId(req.params.id)
      res.json({ success: true, data: run })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/novels/:id - Get novel by ID
  router.get('/comic/novels/:id', (req, res) => {
    try {
      const novel = comicService.getNovel(req.params.id)
      if (!novel) {
        res.status(404).json({ success: false, error: { message: 'Novel not found' } })
        return
      }
      res.json({ success: true, data: novel })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/novels - Create novel
  router.post('/comic/novels', (req, res) => {
    try {
      const { name, original_text, content } = req.body
      if (!name) {
        res.status(400).json({ success: false, error: { message: 'Name is required' } })
        return
      }
      const novel = comicService.createNovel({ name, original_text, content })
      res.json({ success: true, data: novel })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/novels/:id - Update novel
  router.put('/comic/novels/:id', (req, res) => {
    try {
      const novel = comicService.updateNovel(req.params.id, req.body)
      if (!novel) {
        res.status(404).json({ success: false, error: { message: 'Novel not found' } })
        return
      }
      res.json({ success: true, data: novel })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/novels/:id - Delete novel
  router.delete('/comic/novels/:id', (req, res) => {
    try {
      const deleted = comicService.deleteNovel(req.params.id)
      if (!deleted) {
        res.status(404).json({ success: false, error: { message: 'Novel not found' } })
        return
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Novel Content ============

  // GET /comic/novels/:id/content - Get novel content
  router.get('/comic/novels/:id/content', (req, res) => {
    try {
      const content = comicService.getNovelContent(req.params.id)
      if (!content) {
        res.status(404).json({ success: false, error: { message: 'Novel content not found' } })
        return
      }
      res.json({ success: true, data: content })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/novels/:id/content - Update novel content
  router.put('/comic/novels/:id/content', (req, res) => {
    try {
      const content = comicService.updateNovelContent(req.params.id, req.body)
      if (!content) {
        res.status(404).json({ success: false, error: { message: 'Novel content not found' } })
        return
      }
      res.json({ success: true, data: content })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Novel Characters ============

  // GET /comic/novels/:id/characters - List characters for a novel
  router.get('/comic/novels/:id/characters', (req, res) => {
    try {
      const characters = comicService.listNovelCharacters(req.params.id)
      res.json({ success: true, data: characters })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/novels/:id/characters - Create character
  router.post('/comic/novels/:id/characters', (req, res) => {
    try {
      const { name, type, appearance, description, order_index } = req.body
      if (!name || !type) {
        res.status(400).json({ success: false, error: { message: 'Name and type are required' } })
        return
      }
      const character = comicService.createNovelCharacter(req.params.id, { name, type, appearance, description, order_index })
      res.json({ success: true, data: character })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/novels/:id/characters/:charId - Update character
  router.put('/comic/novels/:id/characters/:charId', (req, res) => {
    try {
      const character = comicService.updateNovelCharacter(req.params.charId, req.body)
      if (!character) {
        res.status(404).json({ success: false, error: { message: 'Character not found' } })
        return
      }
      res.json({ success: true, data: character })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/novels/:id/characters/:charId - Delete character
  router.delete('/comic/novels/:id/characters/:charId', (req, res) => {
    try {
      const deleted = comicService.deleteNovelCharacter(req.params.charId)
      if (!deleted) {
        res.status(404).json({ success: false, error: { message: 'Character not found' } })
        return
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/novels/:id/characters/:charId/tags - Create character tag
  router.post('/comic/novels/:id/characters/:charId/tags', (req, res) => {
    try {
      const { tag_category, tag_value } = req.body
      if (!tag_category || !tag_value) {
        res.status(400).json({ success: false, error: { message: 'tag_category and tag_value are required' } })
        return
      }
      const tag = comicService.createNovelCharacterTag(req.params.charId, { tag_category, tag_value })
      res.json({ success: true, data: tag })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/novels/:id/characters/:charId/tags - List character tags
  router.get('/comic/novels/:id/characters/:charId/tags', (req, res) => {
    try {
      const tags = comicService.listNovelCharacterTags(req.params.charId)
      res.json({ success: true, data: tags })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Novel Scripts ============

  // GET /comic/novels/:id/scripts - List scripts for a novel
  router.get('/comic/novels/:id/scripts', (req, res) => {
    try {
      const scripts = comicService.listNovelScripts(req.params.id)
      res.json({ success: true, data: scripts })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/novels/:id/scripts - Create script scene
  router.post('/comic/novels/:id/scripts', (req, res) => {
    try {
      const { scene_number, scene_location, scene_time, scene_description, order_index } = req.body
      const script = comicService.createNovelScript(req.params.id, { scene_number, scene_location, scene_time, scene_description, order_index })
      res.json({ success: true, data: script })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/novels/:id/scripts/:scriptId - Update script scene
  router.put('/comic/novels/:id/scripts/:scriptId', (req, res) => {
    try {
      const script = comicService.updateNovelScript(req.params.scriptId, req.body)
      if (!script) {
        res.status(404).json({ success: false, error: { message: 'Script not found' } })
        return
      }
      res.json({ success: true, data: script })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/novels/:id/scripts/:scriptId - Delete script scene
  router.delete('/comic/novels/:id/scripts/:scriptId', (req, res) => {
    try {
      const deleted = comicService.deleteNovelScript(req.params.scriptId)
      if (!deleted) {
        res.status(404).json({ success: false, error: { message: 'Script not found' } })
        return
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Novel Script Dialogues ============

  // GET /comic/scripts/:scriptId/dialogues - List dialogues for a script
  router.get('/comic/scripts/:scriptId/dialogues', (req, res) => {
    try {
      const dialogues = comicService.listScriptDialogues(req.params.scriptId)
      res.json({ success: true, data: dialogues })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/scripts/:scriptId/dialogues - Create dialogue
  router.post('/comic/scripts/:scriptId/dialogues', (req, res) => {
    try {
      const { character_name, dialogue_text, order_index } = req.body
      if (!dialogue_text) {
        res.status(400).json({ success: false, error: { message: 'dialogue_text is required' } })
        return
      }
      const dialogue = comicService.createNovelScriptDialogue(req.params.scriptId, { character_name, dialogue_text, order_index })
      res.json({ success: true, data: dialogue })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Novel Storyboards ============

  // GET /comic/novels/:id/storyboards - List storyboards for a novel
  router.get('/comic/novels/:id/storyboards', (req, res) => {
    try {
      const storyboards = comicService.listNovelStoryboards(req.params.id)
      res.json({ success: true, data: storyboards })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/novels/:id/storyboards - Create storyboard
  router.post('/comic/novels/:id/storyboards', (req, res) => {
    try {
      const { frame_number, shot_type, camera_angle, content, characters, image_prompt, subtitles, notes, order_index } = req.body
      const storyboard = comicService.createNovelStoryboard(req.params.id, {
        frame_number, shot_type, camera_angle, content, characters, image_prompt, subtitles, notes, order_index
      })
      res.json({ success: true, data: storyboard })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/novels/:id/storyboards/:sbId - Update storyboard
  router.put('/comic/novels/:id/storyboards/:sbId', (req, res) => {
    try {
      const storyboard = comicService.updateNovelStoryboard(req.params.sbId, req.body)
      if (!storyboard) {
        res.status(404).json({ success: false, error: { message: 'Storyboard not found' } })
        return
      }
      res.json({ success: true, data: storyboard })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/novels/:id/storyboards/:sbId - Delete storyboard
  router.delete('/comic/novels/:id/storyboards/:sbId', (req, res) => {
    try {
      const deleted = comicService.deleteNovelStoryboard(req.params.sbId)
      if (!deleted) {
        res.status(404).json({ success: false, error: { message: 'Storyboard not found' } })
        return
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Templates ============

  // GET /comic/templates - List templates
  router.get('/comic/templates', (req, res) => {
    try {
      const category = req.query.category as ComicCategory | undefined
      const templates = comicService.listTemplates(category)
      res.json({ success: true, data: templates })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/templates/:id - Get template by ID
  router.get('/comic/templates/:id', (req, res) => {
    try {
      const template = comicService.getTemplate(req.params.id)
      if (!template) {
        res.status(404).json({ success: false, error: { message: 'Template not found' } })
        return
      }
      res.json({ success: true, data: template })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/templates - Create template
  router.post('/comic/templates', (req, res) => {
    try {
      const { name, description, category, step_order, depend_on, system_prompt, user_prompt, input_variables } = req.body
      if (!name || !category || !system_prompt) {
        res.status(400).json({ success: false, error: { message: 'Name, category, and system_prompt are required' } })
        return
      }
      const template = comicService.createTemplate({
        id: req.body.id,
        name,
        description,
        category,
        step_order,
        depend_on,
        system_prompt,
        user_prompt,
        input_variables: input_variables || [],
        is_builtin: false
      })
      res.json({ success: true, data: template })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // PUT /comic/templates/:id - Update template
  router.put('/comic/templates/:id', (req, res) => {
    try {
      const template = comicService.updateTemplate(req.params.id, req.body)
      if (!template) {
        res.status(404).json({ success: false, error: { message: 'Template not found or is builtin' } })
        return
      }
      res.json({ success: true, data: template })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/templates/:id - Delete template
  router.delete('/comic/templates/:id', (req, res) => {
    try {
      const deleted = comicService.deleteTemplate(req.params.id)
      if (!deleted) {
        res.status(400).json({ success: false, error: { message: 'Template not found or is builtin' } })
        return
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Call Logs ============

  // GET /comic/call-logs - List call logs
  router.get('/comic/call-logs', (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const pageSize = parseInt(req.query.pageSize as string) || 20
      const filter = {
        novel_id: req.query.novel_id as string | undefined,
        stage: req.query.stage as ComicStage | undefined,
        status: req.query.status ? parseInt(req.query.status as string) : undefined,
        from: req.query.from ? parseInt(req.query.from as string) : undefined,
        to: req.query.to ? parseInt(req.query.to as string) : undefined
      }
      const result = comicService.listCallLogs(filter, page, pageSize)
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/call-logs/:id - Get call log by ID
  router.get('/comic/call-logs/:id', (req, res) => {
    try {
      const log = comicService.getCallLog(req.params.id)
      if (!log) {
        res.status(404).json({ success: false, error: { message: 'Call log not found' } })
        return
      }
      res.json({ success: true, data: log })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // POST /comic/call-logs - Create call log
  router.post('/comic/call-logs', (req, res) => {
    try {
      const { run_id, novel_id, template_id, stage, input_variables, output, model_key, duration_ms, status, error } = req.body
      const log = comicService.createCallLog({
        run_id,
        novel_id,
        template_id,
        stage,
        input_variables: input_variables || {},
        output,
        model_key,
        duration_ms,
        status,
        error
      })
      res.json({ success: true, data: log })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // DELETE /comic/call-logs - Delete call logs
  router.delete('/comic/call-logs', (req, res) => {
    try {
      const filter = {
        novel_id: req.query.novel_id as string | undefined,
        from: req.query.from ? parseInt(req.query.from as string) : undefined,
        to: req.query.to ? parseInt(req.query.to as string) : undefined
      }
      const deleted = comicService.deleteCallLogs(filter)
      res.json({ success: true, data: { deleted } })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // ============ Pipeline Runs ============

  // GET /comic/pipeline-runs - List pipeline runs (optionally filter by novel_id)
  router.get('/comic/pipeline-runs', (req, res) => {
    try {
      const novelId = req.query.novel_id as string | undefined
      const runs = comicService.listPipelineRuns(novelId || undefined)
      res.json({ success: true, data: runs })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/pipeline-runs/:run_id - Get pipeline run status
  router.get('/comic/pipeline-runs/:run_id', (req, res) => {
    try {
      const run = comicService.getPipelineRunByRunId(req.params.run_id)
      if (!run) {
        res.status(404).json({ success: false, error: { message: 'Pipeline run not found' } })
        return
      }
      res.json({ success: true, data: run })
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })

  // GET /comic/pipeline/step-logs - List step logs by run_id or novel_id
  // [AGC:START] tool=Cc author=fangkun
  router.get('/comic/pipeline/step-logs', (req, res) => {
    try {
      const { run_id, novel_id } = req.query

      if (run_id) {
        const logs = comicService.listStepLogsByRunId(run_id as string)
        res.json({ success: true, data: { items: logs, total: logs.length } })
      } else if (novel_id) {
        const logs = comicService.listStepLogsByNovelId(novel_id as string)
        res.json({ success: true, data: { items: logs, total: logs.length } })
      } else {
        res.status(400).json({ success: false, error: { message: 'run_id or novel_id is required' } })
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })
  // [AGC:END]

  // POST /comic/execute - Execute template with SSE streaming
  router.post('/comic/execute', async (req, res) => {
    try {
      const { run_id, novel_id, template_id, model, input_variables } = req.body

      if (!template_id || !novel_id) {
        res.status(400).json({ success: false, error: { message: 'template_id and novel_id are required' } })
        return
      }

      const template = comicService.getTemplate(template_id)
      if (!template) {
        res.status(404).json({ success: false, error: { message: 'Template not found' } })
        return
      }

      const novel = comicService.getNovel(novel_id)
      if (!novel) {
        res.status(404).json({ success: false, error: { message: 'Novel not found' } })
        return
      }

      // Get or create pipeline run
      let pipelineRun = comicService.getPipelineRunByRunId(run_id)
      if (!pipelineRun) {
        pipelineRun = comicService.createPipelineRun({
          novel_id,
          run_id,
          completed_steps: [],
          current_step: template_id,
          model_key: model || null
        })
      } else {
        // Update current step
        comicService.updatePipelineRun(run_id, { current_step: template_id })
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      const startTime = Date.now()
      let fullOutput = ''

      try {
        // Build the prompt with variables - replace in both system_prompt and user_prompt
        let systemPrompt = template.system_prompt || ''
        let userPrompt = template.user_prompt || ''

        for (const [key, value] of Object.entries(input_variables || {})) {
          const regex = new RegExp(`\\{${key}\\}`, 'g')
          systemPrompt = systemPrompt.replace(regex, String(value))
          userPrompt = userPrompt.replace(regex, String(value))
        }

        // If user_prompt is empty after substitution, use a default trigger
        if (!userPrompt.trim()) {
          userPrompt = '请根据上述指令执行任务。'
        }

        // Build messages
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]

        // Use LLMService if available, otherwise fallback to direct OpenAI API
        if (llmService && model) {
          await llmService.sendMessageStream(messages, model, {
            onToken: (token: string) => {
              fullOutput += token
              res.write(`data: ${JSON.stringify({ type: 'delta', content: token })}\n\n`)
            },
            onComplete: () => {
              const duration = Date.now() - startTime

              // Save call log
              comicService.createCallLog({
                run_id,
                novel_id,
                template_id,
                stage: template.category as ComicStage,
                input_variables: input_variables || {},
                output: fullOutput,
                model_key: model,
                duration_ms: duration,
                status: 200,
                error: null
              })

              // Save step log with full input/output
              comicService.createStepLog({
                run_id,
                novel_id,
                template_id,
                input_variables: input_variables || {},
                output: fullOutput,
                model_key: model,
                duration_ms: duration,
                status: 200,
                error: null
              })

              // Update pipeline run: mark step completed (deduplicate)
              const existingSteps = pipelineRun!.completed_steps || []
              const completedStepsSet = new Set(existingSteps)
              completedStepsSet.add(template_id)
              const completedSteps = Array.from(completedStepsSet)
              comicService.updatePipelineRun(run_id, {
                completed_steps: completedSteps,
                current_step: null
              })

              res.write(`data: ${JSON.stringify({ type: 'complete', output: fullOutput })}\n\n`)
              res.write('data: [DONE]\n\n')
              res.end()
            },
            onError: (error: Error) => {
              const duration = Date.now() - startTime

              // Save error log
              comicService.createCallLog({
                run_id,
                novel_id,
                template_id,
                stage: template.category as ComicStage,
                input_variables: input_variables || {},
                output: null,
                model_key: model,
                duration_ms: duration,
                status: 500,
                error: error.message
              })

              // Save step log with error
              comicService.createStepLog({
                run_id,
                novel_id,
                template_id,
                input_variables: input_variables || {},
                output: null,
                model_key: model,
                duration_ms: duration,
                status: 500,
                error: error.message
              })

              res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
              res.end()
            }
          })
        } else {
          // Fallback: direct OpenAI API call (legacy)
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
            },
            body: JSON.stringify({
              model: model || 'gpt-4o',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              stream: true
            })
          })

          if (!response.ok) {
            throw new Error(`LLM API error: ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullOutput += content
                    res.write(`data: ${JSON.stringify({ type: 'delta', content })}\n\n`)
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          const duration = Date.now() - startTime

          // Save call log
          comicService.createCallLog({
            run_id,
            novel_id,
            template_id,
            stage: template.category as ComicStage,
            input_variables: input_variables || {},
            output: fullOutput,
            model_key: model || 'gpt-4o',
            duration_ms: duration,
            status: 200,
            error: null
          })

          // Save step log with full input/output
          comicService.createStepLog({
            run_id,
            novel_id,
            template_id,
            input_variables: input_variables || {},
            output: fullOutput,
            model_key: model || 'gpt-4o',
            duration_ms: duration,
            status: 200,
            error: null
          })

          // Update pipeline run: mark step completed
          const completedSteps = [...(pipelineRun!.completed_steps || []), template_id]
          comicService.updatePipelineRun(run_id, {
            completed_steps: completedSteps,
            current_step: null
          })

          res.write(`data: ${JSON.stringify({ type: 'complete', output: fullOutput })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
        }
      } catch (error: any) {
        const duration = Date.now() - startTime

        // Save error log
        comicService.createCallLog({
          run_id,
          novel_id,
          template_id,
          stage: template.category as ComicStage,
          input_variables: input_variables || {},
          output: null,
          model_key: model || 'unknown',
          duration_ms: duration,
          status: 500,
          error: error.message
        })

        // Save step log with error
        comicService.createStepLog({
          run_id,
          novel_id,
          template_id,
          input_variables: input_variables || {},
          output: null,
          model_key: model || 'unknown',
          duration_ms: duration,
          status: 500,
          error: error.message
        })

        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
        res.end()
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })
}
// [AGC:END]
