import { Router } from 'express';
import { ContextManager } from '../services/context/manager';

export function registerContextRoutes(router: Router, contextManager: ContextManager) {
  // GET /contexts
  router.get('/contexts', async (_req, res) => {
    try {
      const contexts = await contextManager.getAllContexts();
      res.json({ success: true, data: contexts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /contexts
  router.post('/contexts', async (req, res) => {
    try {
      await contextManager.createContext(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /contexts/:id
  router.get('/contexts/:id', async (req, res) => {
    try {
      const context = await contextManager.getContext(req.params.id);
      if (!context) {
        res.status(404).json({ success: false, error: { message: 'Context not found' } });
        return;
      }
      res.json({ success: true, data: context });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /contexts/:id
  router.put('/contexts/:id', async (req, res) => {
    try {
      await contextManager.updateContext(req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /contexts/:id
  router.delete('/contexts/:id', async (req, res) => {
    try {
      await contextManager.deleteContext(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
