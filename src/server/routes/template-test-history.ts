// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08

import { Router } from 'express'
import { TemplateTestHistoryManager } from '../services/template-test/manager'
import { v4 as uuidv4 } from 'uuid'

// [AGC:START] tool=Cc author=fangkun
export function registerTemplateTestHistoryRoutes(
  router: Router,
  manager: TemplateTestHistoryManager
) {
  // GET /template-test-history - 获取测试历史
  router.get('/template-test-history', async (req, res) => {
    try {
      const { templateId } = req.query
      const records = await manager.getRecords(templateId as string)
      res.json({ success: true, data: records })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      })
    }
  })

  // POST /template-test-history - 添加测试记录
  router.post('/template-test-history', async (req, res) => {
    try {
      const record = {
        id: uuidv4(),
        ...req.body,
        timestamp: Date.now()
      }
      await manager.addRecord(record)
      res.json({ success: true, data: record })
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message }
      })
    }
  })

  // DELETE /template-test-history/template/:templateId - 清空模板历史
  router.delete('/template-test-history/template/:templateId', async (req, res) => {
    try {
      await manager.clearHistory(req.params.templateId)
      res.json({ success: true })
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message }
      })
    }
  })
}
// [AGC:END]
