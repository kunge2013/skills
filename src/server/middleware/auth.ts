import { Request, Response, NextFunction } from 'express';
import { getApiPassword } from '../config/environment';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiPassword = getApiPassword();

  // No password set = open access
  if (!apiPassword) {
    return next();
  }

  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  if (!token || token !== apiPassword) {
    res.status(401).json({
      success: false,
      error: { message: 'Unauthorized' },
    });
    return;
  }

  next();
}
