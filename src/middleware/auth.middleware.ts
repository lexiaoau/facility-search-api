import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';
import { UnauthorizedError } from '../utils/errors.js';

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers['authorization'];
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return next(new UnauthorizedError('No token provided'));
  }

  try {
    await verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid token'));
  }
}
