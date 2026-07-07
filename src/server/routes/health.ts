import { Router } from 'express';

export function registerHealthRoute(router: Router) {
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Alias for compatibility
  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
}
