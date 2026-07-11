import { Router, Request, Response } from 'express';
import type { AgentService } from '../services/agent/service';
import type { SkillRegistry } from '../services/agent/registry';

export function registerAgentRoutes(router: Router, agentService: AgentService, skillRegistry: SkillRegistry) {
  // POST /agent/plan — SSE streaming plan generation
  router.post('/agent/plan', async (req: Request, res: Response) => {
    try {
      const { userMessage, providerId, modelKey } = req.body;
      if (!userMessage || !modelKey) {
        res.status(400).json({ success: false, error: { message: 'userMessage and modelKey are required' } });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await agentService.createPlan({ userMessage, providerId, modelKey }, (event) => {
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      });

      res.end();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
      }
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  // GET /agent/plan/:id — Query plan details
  router.get('/agent/plan/:id', (req: Request, res: Response) => {
    const plan = agentService.getPlan(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, error: { message: 'Plan not found' } });
      return;
    }
    res.json({ success: true, data: plan });
  });

  // POST /agent/step/:id/run — Trigger step execution (SSE)
  router.post('/agent/step/:id/run', async (req: Request, res: Response) => {
    try {
      const stepId = req.params.id;
      const { userAnswers } = req.body;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await agentService.runStep(stepId, { userAnswers }, (event) => {
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      });

      res.end();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
      }
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  // GET /agent/skills — List registered skills
  router.get('/agent/skills', (_req: Request, res: Response) => {
    const skills = skillRegistry.getAll().map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
    }));
    res.json({ success: true, data: skills });
  });
}
