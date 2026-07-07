import { Router } from 'express';
import { ImageModelManager } from '../services/image/service';

export function registerImageModelRoutes(router: Router, imageModelManager: ImageModelManager) {
  // GET /image-models
  router.get('/image-models', async (_req, res) => {
    try {
      const models = await imageModelManager.getAllModels();
      res.json({ success: true, data: models });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /image-models
  router.post('/image-models', async (req, res) => {
    try {
      await imageModelManager.addModel(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /image-models/:id
  router.put('/image-models/:id', async (req, res) => {
    try {
      await imageModelManager.updateModel(req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /image-models/:id
  router.delete('/image-models/:id', async (req, res) => {
    try {
      await imageModelManager.deleteModel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
