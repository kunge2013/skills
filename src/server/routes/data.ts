import { Router } from 'express';
import { DataManager } from '../services/data/manager';

export function registerDataRoutes(router: Router, dataManager: DataManager) {
  // POST /data/export
  router.post('/data/export', async (_req, res) => {
    try {
      const data = await dataManager.exportAll();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /data/import
  router.post('/data/import', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        res.status(400).json({ success: false, error: { message: 'data is required' } });
        return;
      }
      await dataManager.importAll(data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
