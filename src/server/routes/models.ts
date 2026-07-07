import { Router } from 'express';
import { ModelManager } from '../services/model/manager';
import { TextModelConfig } from '../services/llm/types';

export function registerModelRoutes(router: Router, modelManager: ModelManager) {
  // GET /models - get all models
  router.get('/models', async (_req, res) => {
    try {
      const models = await modelManager.getAllModels();
      res.json({ success: true, data: models });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /models/enabled - get enabled models
  router.get('/models/enabled', async (_req, res) => {
    try {
      const models = await modelManager.getEnabledModels();
      res.json({ success: true, data: models });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /models - add model
  router.post('/models', async (req, res) => {
    try {
      const { key, config } = req.body;
      if (!key || !config) {
        res.status(400).json({ success: false, error: { message: 'key and config are required' } });
        return;
      }
      await modelManager.addModel(key, config);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /models/:id - update model
  router.put('/models/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await modelManager.updateModel(id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /models/:id - delete model
  router.delete('/models/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await modelManager.deleteModel(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /models/ensure-init
  router.post('/models/ensure-init', async (_req, res) => {
    try {
      await modelManager.ensureInitialized();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });
}
