import { Router, type Request, type Response, type NextFunction } from 'express';
import { facilitiesController } from '../controllers/facilities.controller.js';

const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> =>
    Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/',
  asyncHandler((req, res, next) => facilitiesController.search(req, res, next)),
);
router.get(
  '/:id',
  asyncHandler((req, res, next) => facilitiesController.getById(req, res, next)),
);

export default router;
