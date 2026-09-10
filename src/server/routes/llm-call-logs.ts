// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
import { Router } from 'express';
import { LLMCallLogQuery, LLMCallLogFilter } from '../services/llm-call/query';

// [AGC:START] tool=Cc author=fangkun
export function registerLLMCallLogRoutes(router: Router, query: LLMCallLogQuery): void {
  router.get('/llm-call-logs', async (req, res) => {
    try {
      const { from, to, modelKey, source, status } = req.query;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
      const filter: LLMCallLogFilter = {};
      if (from !== undefined) filter.from = Number(from);
      if (to !== undefined) filter.to = Number(to);
      if (modelKey) filter.modelKey = String(modelKey);
      if (source) filter.source = String(source);
      if (status !== undefined) filter.status = Number(status);
      const data = await query.list(filter, page, pageSize);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.get('/llm-call-logs/:id', async (req, res) => {
    try {
      const record = await query.getById(req.params.id);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Log not found' } });
        return;
      }
      res.json({ success: true, data: record });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.delete('/llm-call-logs', async (req, res) => {
    try {
      const { from, to } = req.query;
      const deleted = await query.deleteRange(Number(from ?? 0), Number(to ?? Date.now()));
      res.json({ success: true, data: { deleted } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });
}
// [AGC:END]
