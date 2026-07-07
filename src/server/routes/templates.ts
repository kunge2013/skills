import { Router } from 'express';
import { TemplateManager, Template } from '../services/template/manager';

export function registerTemplateRoutes(router: Router, templateManager: TemplateManager) {
  // GET /templates - get all templates
  router.get('/templates', async (_req, res) => {
    try {
      const templates = await templateManager.getAllTemplates();
      res.json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /templates/:id
  router.get('/templates/:id', async (req, res) => {
    try {
      const template = await templateManager.getTemplate(req.params.id);
      if (!template) {
        res.status(404).json({ success: false, error: { message: 'Template not found' } });
        return;
      }
      res.json({ success: true, data: template });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /templates - create template
  router.post('/templates', async (req, res) => {
    try {
      const template = req.body as Template;
      if (!template.id || !template.name || !template.type) {
        res.status(400).json({
          success: false,
          error: { message: 'id, name, and type are required' },
        });
        return;
      }
      await templateManager.createTemplate(template);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /templates/:id - update template
  router.put('/templates/:id', async (req, res) => {
    try {
      await templateManager.updateTemplate(req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /templates/:id - delete template
  router.delete('/templates/:id', async (req, res) => {
    try {
      await templateManager.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /templates/by-type/:type
  router.get('/templates/by-type/:type', async (req, res) => {
    try {
      const templates = await templateManager.getTemplatesByType(req.params.type as any);
      res.json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /templates/import
  router.post('/templates/import', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        res.status(400).json({ success: false, error: { message: 'data is required' } });
        return;
      }
      await templateManager.importTemplates(data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
