import { Router } from 'express';
import { HistoryManager } from '../services/history/manager';

export function registerHistoryRoutes(router: Router, historyManager: HistoryManager) {
  // GET /history
  router.get('/history', async (_req, res) => {
    try {
      const records = await historyManager.getRecords();
      res.json({ success: true, data: records });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /history/chain - create new chain (add record)
  router.post('/history/chain', async (req, res) => {
    try {
      await historyManager.addRecord(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /history/iteration - add iteration
  router.post('/history/iteration', async (req, res) => {
    try {
      const { recordId, ...updates } = req.body;
      await historyManager.updateRecord(recordId, updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /history/chain/:id
  router.get('/history/chain/:id', async (req, res) => {
    try {
      const chain = await historyManager.getIterationChain(req.params.id);
      res.json({ success: true, data: chain });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /history/:id
  router.delete('/history/:id', async (req, res) => {
    try {
      await historyManager.deleteRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
