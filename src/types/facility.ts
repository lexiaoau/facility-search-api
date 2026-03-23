import type { PaginationMeta } from './pagination.js';

export interface FacilitySearchResult {
  id: string;
  name: string;
  address: string;
}

export interface SearchWithPaginationResult {
  data: FacilitySearchResult[];
  pagination: PaginationMeta;
}
