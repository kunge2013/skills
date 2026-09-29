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

  // ============ Pipeline Execution ============

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

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      const startTime = Date.now()
      let fullOutput = ''

      try {
        // Build the prompt with variables
        let userPrompt = template.user_prompt || ''
        for (const [key, value] of Object.entries(input_variables || {})) {
          userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
        }

        // Build messages
        const messages: Message[] = [
          { role: 'system', content: template.system_prompt },
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
                { role: 'system', content: template.system_prompt },
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

        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
        res.end()
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } })
    }
  })
}
// [AGC:END]
