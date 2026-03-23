import { jest } from '@jest/globals';
import { FacilitiesService } from '../services/facilities.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

// manually create mock repository — no jest.mock needed
const mockRepo = {
  search: jest.fn(),
  getById: jest.fn(),
};

// inject mock repository into service
const service = new FacilitiesService(mockRepo as any);

const mockFacility = {
  id: 'facility-001',
  name: 'City Fitness Central',
  address: '123 Market St, Sydney, NSW 2000',
  location: { latitude: -33.8703, longitude: 151.208 },
  facilities: ['Pool', 'Sauna'],
};

const mockPagination = {
  page: 1,
  limit: 10,
  total: 1,
  totalPages: 1,
};

describe('FacilitiesService.searchWithPagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.search.mockReturnValue({
      data: [mockFacility],
      pagination: mockPagination,
    });
  });

  describe('validation', () => {
    it('should throw ValidationError when q is empty', () => {
      expect(() => service.searchWithPagination('', [], 1, 10)).toThrow(ValidationError);
    });

    it('should throw ValidationError when q is whitespace only', () => {
      expect(() => service.searchWithPagination('   ', [], 1, 10)).toThrow(ValidationError);
    });

    it('should throw ValidationError when page < 1', () => {
      expect(() => service.searchWithPagination('fitness', [], 0, 10)).toThrow(ValidationError);
    });

    it('should throw ValidationError when limit < 1', () => {
      expect(() => service.searchWithPagination('fitness', [], 1, 0)).toThrow(ValidationError);
    });

    it('should throw ValidationError when limit exceeds MAX_LIMIT', () => {
      expect(() => service.searchWithPagination('fitness', [], 1, 101)).toThrow(ValidationError);
    });

    // NOTE: additional cases to cover if time permits:
    // - limit exactly at MAX_LIMIT (100) → should NOT throw
    // - page exactly at 1 → should NOT throw
  });

  describe('response shape', () => {
    it('should return only id, name, address — not full facility details', () => {
      const result = service.searchWithPagination('fitness', [], 1, 10);
      result.data.forEach((f) => {
        expect(f).toHaveProperty('id');
        expect(f).toHaveProperty('name');
        expect(f).toHaveProperty('address');
        expect(f).not.toHaveProperty('location');
        expect(f).not.toHaveProperty('facilities');
      });
    });

    it('should return pagination meta from repository', () => {
      const result = service.searchWithPagination('fitness', [], 1, 10);
      expect(result.pagination).toEqual(mockPagination);
    });
  });

  describe('repository delegation', () => {
    it('should call repository.search with correct arguments', () => {
      service.searchWithPagination('fitness', ['Pool'], 2, 20);
      expect(mockRepo.search).toHaveBeenCalledWith('fitness', ['Pool'], 2, 20);
    });

    it('should call repository.search exactly once', () => {
      service.searchWithPagination('fitness', [], 1, 10);
      expect(mockRepo.search).toHaveBeenCalledTimes(1);
    });

    // NOTE: additional cases to cover if time permits:
    // - empty amenities array is passed through correctly
    // - q is trimmed before being passed to repository
  });
});

describe('FacilitiesService.getById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should throw ValidationError when id is empty string', () => {
      expect(() => service.getById('')).toThrow(ValidationError);
    });

    it('should throw ValidationError when id is whitespace only', () => {
      expect(() => service.getById('   ')).toThrow(ValidationError);
    });
  });

  describe('not found', () => {
    it('should throw NotFoundError when repository returns undefined', () => {
      mockRepo.getById.mockReturnValue(undefined);
      expect(() => service.getById('does-not-exist')).toThrow(NotFoundError);
    });

    it('should throw NotFoundError with correct message', () => {
      mockRepo.getById.mockReturnValue(undefined);
      expect(() => service.getById('does-not-exist')).toThrow('Facility not found');
    });
  });

  describe('success', () => {
    it('should return the full facility object', () => {
      mockRepo.getById.mockReturnValue(mockFacility);
      const result = service.getById('facility-001');
      expect(result).toEqual(mockFacility);
    });

    it('should call repository.getById with the correct id', () => {
      mockRepo.getById.mockReturnValue(mockFacility);
      service.getById('facility-001');
      expect(mockRepo.getById).toHaveBeenCalledWith('facility-001');
    });
  });
});
