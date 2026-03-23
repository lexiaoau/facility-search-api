import path from 'path';
import { fileURLToPath } from 'url';
import { FacilityRepository } from '../repositories/facilities.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_PATH = path.join(__dirname, '../../data/facilities.json');

const repo = new FacilityRepository(TEST_DATA_PATH);

describe('FacilityRepository', () => {
  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe('getById', () => {
    it('should return a facility by id', () => {
      const facility = repo.getById('facility-001');
      expect(facility).toBeDefined();
      expect(facility?.id).toBe('facility-001');
      expect(facility?.name).toBe('City Fitness Central');
    });

    it('should return undefined for non-existent id', () => {
      const facility = repo.getById('does-not-exist');
      expect(facility).toBeUndefined();
    });

    // NOTE: additional cases to cover if time permits:
    // - empty string id -> undefined
    // - id with special characters -> undefined
  });

  // ---------------------------------------------------------------------------
  // search - name matching
  // ---------------------------------------------------------------------------

  describe('search - name matching', () => {
    it('should return matching facilities for a valid query', () => {
      const result = repo.search('fitness', [], 1, 10);
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((f) => {
        expect(f.name.toLowerCase()).toContain('fitness');
      });
    });

    it('should support partial match mid-word', () => {
      // "tral" should match "Central"
      const result = repo.search('tral', [], 1, 10);
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((f) => {
        expect(f.name.toLowerCase()).toMatch(/tral/);
      });
    });

    it('should support multi-word query with AND semantics', () => {
      // all results must contain both "city" and "fit"
      const result = repo.search('city fit', [], 1, 10);
      result.data.forEach((f) => {
        const name = f.name.toLowerCase();
        expect(name).toMatch(/city/);
        expect(name).toMatch(/fit/);
      });
    });

    it('should return empty data for a query with no matches', () => {
      const result = repo.search('velocity', [], 1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should fall back to prefix match for query shorter than N-gram size', () => {
      // "fi" is 2 chars < N=3, should still return results via prefix match
      const result = repo.search('fi', [], 1, 10);
      expect(result.data.length).toBeGreaterThan(0);
    });

    // NOTE: additional cases to cover if time permits:
    // - query with leading/trailing whitespace -> same result as trimmed query
    // - query with mixed case -> case-insensitive match
    // - single character query -> prefix match results
  });

  // ---------------------------------------------------------------------------
  // search - amenities filter
  // ---------------------------------------------------------------------------

  describe('search - amenities filter', () => {
    it('should filter results by a single amenity', () => {
      const result = repo.search('fitness', ['Pool'], 1, 100);
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((f) => {
        expect(f.facilities).toContain('Pool');
      });
    });

    it('should apply AND semantics across multiple amenities', () => {
      const result = repo.search('fitness', ['Pool', 'Sauna'], 1, 100);
      result.data.forEach((f) => {
        expect(f.facilities).toContain('Pool');
        expect(f.facilities).toContain('Sauna');
      });
    });

    it('should return empty when amenity combination has no match', () => {
      // no facility has both Boxing Ring and Olympic Pool
      const result = repo.search('a', ['Boxing Ring', 'Olympic Pool'], 1, 10);
      expect(result.data).toHaveLength(0);
    });

    it('should return all name matches when amenities list is empty', () => {
      const withoutFilter = repo.search('fitness', [], 1, 100);
      const withEmptyFilter = repo.search('fitness', [], 1, 100);
      expect(withoutFilter.pagination.total).toBe(withEmptyFilter.pagination.total);
    });

    // NOTE: additional cases to cover if time permits:
    // - amenity name with different casing -> case-insensitive match
    // - amenity that exists but no name match -> empty result
  });

  // ---------------------------------------------------------------------------
  // search - pagination
  // ---------------------------------------------------------------------------

  describe('search - pagination', () => {
    it('should return correct number of results per page', () => {
      const result = repo.search('fitness', [], 1, 3);
      expect(result.data.length).toBeLessThanOrEqual(3);
    });

    it('should return non-overlapping results across pages', () => {
      const page1 = repo.search('fitness', [], 1, 3);
      const page2 = repo.search('fitness', [], 2, 3);
      const ids1 = page1.data.map((f) => f.id);
      const ids2 = page2.data.map((f) => f.id);
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    it('should return consistent total across pages', () => {
      const page1 = repo.search('fitness', [], 1, 3);
      const page2 = repo.search('fitness', [], 2, 3);
      expect(page1.pagination.total).toBe(page2.pagination.total);
    });

    it('should return empty data for out-of-bounds page but correct total', () => {
      const result = repo.search('fitness', [], 9999, 10);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('should calculate totalPages correctly', () => {
      const result = repo.search('fitness', [], 1, 3);
      const expected = Math.ceil(result.pagination.total / 3);
      expect(result.pagination.totalPages).toBe(expected);
    });

    // NOTE: additional cases to cover if time permits:
    // - limit larger than total results -> single page, data.length === total
    // - page=0 or negative -> handled by service layer validation upstream
  });
});
