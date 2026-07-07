import { Router } from 'express';
import { PreferenceService } from '../services/preference/service';

export function registerPreferenceRoutes(router: Router, preferenceService: PreferenceService) {
  // GET /preferences/:key
  router.get('/preferences/:key', async (req, res) => {
    try {
      const value = await preferenceService.getPreference(req.params.key);
      res.json({ success: true, data: value });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /preferences/:key
  router.put('/preferences/:key', async (req, res) => {
    try {
      await preferenceService.setPreference(req.params.key, req.body.value);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /preferences/:key
  router.delete('/preferences/:key', async (req, res) => {
    try {
      await preferenceService.deletePreference(req.params.key);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /preferences
  router.get('/preferences', async (_req, res) => {
    try {
      const prefs = await preferenceService.getAllPreferences();
      res.json({ success: true, data: prefs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /preferences (batch update)
  router.put('/preferences', async (req, res) => {
    try {
      await preferenceService.batchUpdate(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
