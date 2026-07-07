import { Router } from 'express';
import { LLMService } from '../services/llm/service';
import { ModelManager } from '../services/model/manager';
import { ITextAdapterRegistry } from '../services/llm/types';
import { TemplateManager, TemplateProcessor, createDefaultTemplates } from '../services/template/manager';
import { PromptService } from '../services/prompt/service';
import { HistoryManager } from '../services/history/manager';

export function registerLLMRoutes(router: Router, llmService: LLMService, modelManager: ModelManager, registry: ITextAdapterRegistry) {
  // POST /llm/test-connection
  router.post('/llm/test-connection', async (req, res) => {
    try {
      const { modelKey } = req.body;
      if (!modelKey) {
        res.status(400).json({ success: false, error: { message: 'modelKey is required' } });
        return;
      }
      await llmService.testConnection(modelKey);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /llm/send
  router.post('/llm/send', async (req, res) => {
    try {
      const { messages, provider } = req.body;
      if (!messages || !provider) {
        res.status(400).json({ success: false, error: { message: 'messages and provider are required' } });
        return;
      }
      const content = await llmService.sendMessage(messages, provider);
      res.json({ success: true, data: { content } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /llm/send-stream (SSE)
  router.post('/llm/send-stream', async (req, res) => {
    try {
      const { messages, provider } = req.body;
      if (!messages || !provider) {
        res.status(400).json({ success: false, error: { message: 'messages and provider are required' } });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      let fullContent = '';
      let reasoningContent = '';

      await llmService.sendMessageStream(messages, provider, {
        onToken: (token) => {
          fullContent += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        onReasoningToken: (token) => {
          reasoningContent += token;
          res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
        },
        onComplete: (response) => {
          const finalContent = response?.content || fullContent;
          res.write(`data: ${JSON.stringify({ done: true, fullText: finalContent, reasoning: reasoningContent })}\n\n`);
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        },
      });
    } catch (error: any) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // GET /llm/providers
  router.get('/llm/providers', (_req, res) => {
    try {
      const providers = registry.getAllProviders();
      res.json({ success: true, data: providers });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });
}
