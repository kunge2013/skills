import { Router } from 'express';
import { getApiPassword } from '../config/environment';

export function registerAuthRoutes(router: Router) {
  // POST /verify-token - verify the API password
  router.post('/auth', (req, res) => {
    const { token } = req.body || {};
    const apiPassword = getApiPassword();

    if (!apiPassword) {
      // No password set = open access
      res.json({ success: true });
      return;
    }

    if (token === apiPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid token' },
      });
    }
  });
}
