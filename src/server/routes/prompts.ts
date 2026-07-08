import { Router } from 'express';
import { PromptService } from '../services/prompt/service';

export function registerPromptRoutes(router: Router, promptService: PromptService) {
  // POST /prompts/optimize
  router.post('/prompts/optimize', async (req, res) => {
    try {
      const result = await promptService.optimizePrompt(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /prompts/optimize-stream (SSE)
  router.post('/prompts/optimize-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await promptService.optimizePromptStream(req.body, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: (response) => {
        const fullText = response?.content || '';
        res.write(`data: ${JSON.stringify({ done: true, fullText, reasoning: response?.reasoning })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });

  // POST /prompts/optimize-message
  router.post('/prompts/optimize-message', async (req, res) => {
    try {
      const result = await promptService.optimizeMessage(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /prompts/optimize-message-stream (SSE)
  router.post('/prompts/optimize-message-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await promptService.optimizeMessageStream(req.body, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: (response) => {
        res.write(`data: ${JSON.stringify({ done: true, fullText: response?.content || '', reasoning: response?.reasoning })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });

  // POST /prompts/iterate
  router.post('/prompts/iterate', async (req, res) => {
    try {
      const result = await promptService.iteratePrompt(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /prompts/iterate-stream (SSE)
  router.post('/prompts/iterate-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await promptService.iteratePromptStream(req.body, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: (response) => {
        res.write(`data: ${JSON.stringify({ done: true, fullText: response?.content || '', reasoning: response?.reasoning })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });

  // POST /prompts/test
  router.post('/prompts/test', async (req, res) => {
    try {
      const { systemPrompt, userPrompt, modelKey } = req.body;
      const result = await promptService.testPrompt(systemPrompt, userPrompt, modelKey);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /prompts/test-stream (SSE)
  router.post('/prompts/test-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const { systemPrompt, userPrompt, modelKey } = req.body;

    await promptService.testPromptStream(systemPrompt, userPrompt, modelKey, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: (response) => {
        res.write(`data: ${JSON.stringify({ done: true, fullText: response?.content || '', reasoning: response?.reasoning })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });

  // POST /prompts/test-conversation-stream (SSE)
  router.post('/prompts/test-conversation-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await promptService.testCustomConversationStream(req.body, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: () => {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });

  // [AGC:START] tool=Cc author=fangkun
  // POST /prompts/test-template-stream (SSE)
  router.post('/prompts/test-template-stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await promptService.testTemplateStream(req.body, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      onReasoningToken: (token) => {
        res.write(`data: ${JSON.stringify({ reasoning: token })}\n\n`);
      },
      onComplete: (response) => {
        res.write(`data: ${JSON.stringify({
          done: true,
          fullText: response?.content || '',
          reasoning: response?.reasoning,
        })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
    });
  });
  // [AGC:END]
}
