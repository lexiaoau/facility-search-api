import { facilitiesRepository } from '../repositories/facilities.repository.js';
import type { Facility } from '../models/facility.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { SearchWithPaginationResult } from '../types/facility.js';

const MAX_LIMIT = 100;

class FacilitiesService {
  constructor(private readonly repo = facilitiesRepository) {}

  searchWithPagination(
    q: string,
    amenities: string[],
    page: number,
    limit: number,
  ): SearchWithPaginationResult {
    if (!q?.trim()) throw new ValidationError('Query keyword is required');

    if (page < 1 || limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`page must be >= 1 and limit must be between 1 and ${MAX_LIMIT}`);
    }

    const { data, pagination } = this.repo.search(q, amenities, page, limit);

    return {
      data: data.map((f) => ({
        id: f.id,
        name: f.name,
        address: f.address,
      })),
      pagination,
    };
  }

  getById(id: string): Facility {
    if (!id?.trim()) throw new ValidationError('Facility id is required');
    const facility = this.repo.getById(id);
    if (!facility) throw new NotFoundError('Facility not found');
    return facility;
  }
}

export { FacilitiesService };
export const facilitiesService = new FacilitiesService();
