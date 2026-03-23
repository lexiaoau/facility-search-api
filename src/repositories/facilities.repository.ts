import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Facility } from '../models/facility.js';
import type { PaginatedResult } from '../types/pagination.js';

type IDString = string;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '../../data/facilities.json');

class FacilityRepository {
  private facilities: Map<IDString, Facility> = new Map(); // id -> Facility
  private ngramIndex: Map<string, Set<IDString>> = new Map(); // ngram -> Set<id>
  private amenitiesIndex: Map<string, Set<IDString>> = new Map(); // amenity -> Set<id>

  private readonly N = 3;

  constructor(dataPath: string = DEFAULT_DATA_PATH) {
    const start = Date.now();
    this.loadData(dataPath);
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(`Loaded ${this.facilities.size} facilities in ${Date.now() - start}ms`);
    }
  }

  private loadData(dataPath: string): void {
    try {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const data: Facility[] = JSON.parse(raw);

      for (const facility of data) {
        this.facilities.set(facility.id, facility);

        for (const ngram of this.getNgrams(facility.name)) {
          if (!this.ngramIndex.has(ngram)) {
            this.ngramIndex.set(ngram, new Set());
          }
          this.ngramIndex.get(ngram)!.add(facility.id);
        }

        for (const amenity of facility.facilities ?? []) {
          const key = amenity.toLowerCase().trim();
          if (!key) continue; // skip empty amenities

          if (!this.amenitiesIndex.has(key)) {
            this.amenitiesIndex.set(key, new Set());
          }
          this.amenitiesIndex.get(key)!.add(facility.id);
        }
      }
    } catch (err) {
      throw new Error(`Failed to load facilities data: ${(err as Error).message}`, { cause: err });
    }
  }

  getById(id: string): Facility | undefined {
    return this.facilities.get(id);
  }

  search(q: string, amenities: string[], page: number, limit: number): PaginatedResult<Facility> {
    const words = this.tokenize(q);
    if (words.length === 0) {
      return this.emptyResult(page, limit);
    }

    // search by name using n‑gram index
    const nameResults = this.intersect(words.map((word) => this.searchWord(word)));

    // filter by amenities
    const amenityIds = amenities.length > 0 ? this.filterByAmenities(amenities) : null;

    const filteredIds = amenityIds ? nameResults.filter((id) => amenityIds.has(id)) : nameResults;

    // pagination
    const total = filteredIds.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const pageIds = filteredIds.slice(offset, offset + limit);

    return {
      data: pageIds.map((id) => this.facilities.get(id)!),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private filterByAmenities(amenities: string[]): Set<IDString> {
    const sets = amenities.map((amenity) => {
      const key = amenity.toLowerCase().trim();
      return this.amenitiesIndex.get(key) ?? new Set<string>();
    });
    return new Set(this.intersect(sets));
  }

  private emptyResult(page: number, limit: number): PaginatedResult<Facility> {
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  private searchWord(word: string): Set<IDString> {
    const ngrams = this.getNgrams(word);

    if (ngrams.length === 0) {
      // word.length < N, fall back to prefix matching
      return this.prefixSearch(word);
    }

    // take the intersection of all n‑gram results
    const [first, ...rest] = ngrams;
    let result = new Set(this.ngramIndex.get(first!) ?? []);

    for (const ngram of rest) {
      const ids = this.ngramIndex.get(ngram) ?? new Set();
      result = result.intersection(ids);
    }

    return result;
  }

  private prefixSearch(prefix: string): Set<IDString> {
    const matched = new Set<IDString>();
    for (const [token, ids] of this.ngramIndex) {
      if (token.startsWith(prefix)) {
        ids.forEach((id) => matched.add(id));
      }
    }
    return matched;
  }

  private intersect(sets: Set<IDString>[]): IDString[] {
    if (sets.length === 0) return [];
    const [first, ...rest] = sets;
    let result = new Set(first);
    for (const set of rest) {
      result = result.intersection(set);
    }
    return [...result];
  }

  private getNgrams(text: string): string[] {
    const words = this.tokenize(text);
    const ngrams = new Set<string>();

    for (const word of words) {
      for (let i = 0; i <= word.length - this.N; i++) {
        ngrams.add(word.slice(i, i + this.N));
      }
    }

    return [...ngrams];
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(Boolean);
  }
}

export { FacilityRepository };
export const facilitiesRepository = new FacilityRepository();
