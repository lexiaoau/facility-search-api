import type { Request, Response, NextFunction } from 'express';
import { facilitiesService } from '../services/facilities.service.js';
import { ValidationError } from '../utils/errors.js';
import {
  SEARCH_MAX_LIMIT,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_PAGE,
} from '../config/constants.js';

export class FacilitiesController {
  search(req: Request, res: Response, next: NextFunction): void {
    try {
      const { q, amenities, page, limit } = req.query;

      if (typeof q !== 'string') {
        return next(new ValidationError('Query keyword is required'));
      }

      const amenitiesList: string[] = Array.isArray(amenities)
        ? amenities
            .map(String)
            .map((a) => a.trim())
            .filter(Boolean)
        : amenities
          ? String(amenities)
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [];

      const pageNum = parseInt(String(page ?? String(SEARCH_DEFAULT_PAGE)), 10) || 1;
      if (pageNum < 1) {
        return next(new ValidationError('page must be >= 1'));
      }

      const limitNum =
        parseInt(String(limit ?? String(SEARCH_DEFAULT_LIMIT)), 10) || SEARCH_DEFAULT_LIMIT;
      if (limitNum < 1 || limitNum > SEARCH_MAX_LIMIT) {
        return next(new ValidationError(`limit must be between 1 and ${SEARCH_MAX_LIMIT}`));
      }

      const { data, pagination } = facilitiesService.searchWithPagination(
        q.trim(),
        amenitiesList,
        pageNum,
        limitNum,
      );

      res.json({ data, meta: pagination });
    } catch (err) {
      next(err);
    }
  }

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = String(req.params['id'] ?? '');

      const facility = facilitiesService.getById(id);
      res.json(facility);
    } catch (err) {
      next(err);
    }
  }
}

export const facilitiesController = new FacilitiesController();
