import { facilitiesRepository } from '../repositories/facilities.repository.js';
import type { Facility } from '../models/facility.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { SearchWithPaginationResult } from '../types/facility.js';
import { SEARCH_MAX_LIMIT } from '../config/constants.js';
import { TTLCache } from '../utils/cache.js';

class FacilitiesService {
  private readonly searchCache = new TTLCache<SearchWithPaginationResult>(30_000); // 30s
  private readonly byIdCache = new TTLCache<Facility>(5 * 60_000);

  constructor(private readonly repo = facilitiesRepository) {
    // Prune stale entries every minute to avoid unbounded memory growth
    setInterval(() => {
      this.searchCache.prune();
      this.byIdCache.prune();
    }, 60_000).unref(); // .unref() so the timer doesn't block process exit
  }

  searchWithPagination(
    q: string,
    amenities: string[],
    page: number,
    limit: number,
  ): SearchWithPaginationResult {
    if (!q?.trim()) throw new ValidationError('Query keyword is required');

    if (page < 1 || limit < 1 || limit > SEARCH_MAX_LIMIT) {
      throw new ValidationError(
        `page must be >= 1 and limit must be between 1 and ${SEARCH_MAX_LIMIT}`,
      );
    }

    const cacheKey = `${q.trim().toLowerCase()}|${[...amenities].sort().join(',')}|${page}|${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const { data, pagination } = this.repo.search(q.trim(), amenities, page, limit);

    const result = {
      data: data.map((f) => ({
        id: f.id,
        name: f.name,
        address: f.address,
      })),
      pagination,
    };
    this.searchCache.set(cacheKey, result);

    return result;
  }

  getById(id: string): Facility {
    if (!id?.trim()) throw new ValidationError('Facility id is required');

    const cached = this.byIdCache.get(id);
    if (cached) return cached;

    const facility = this.repo.getById(id);
    if (!facility) throw new NotFoundError('Facility not found');
    this.byIdCache.set(id, facility);
    return facility;
  }
}

export { FacilitiesService };
export const facilitiesService = new FacilitiesService();
