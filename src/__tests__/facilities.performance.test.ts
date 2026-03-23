import request from 'supertest';
import { jest } from '@jest/globals';

import { login } from '../utils/auth.js';
import app from '../app.js';

let token: string;

beforeAll(async () => {
  const { token: t } = await login('test@test.com', 'password');
  token = t;
});

const authHeader = (): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

// increase timeout for performance tests
jest.setTimeout(10_000);

describe('Performance', () => {
  describe('response time', () => {
    it('should respond within 400ms for a standard search', async () => {
      const start = Date.now();
      await request(app).get('/facilities?q=fitness&page=1&limit=10').set(authHeader());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(400);
    });

    it('should respond within 500ms with amenities filter', async () => {
      const start = Date.now();
      await request(app)
        .get('/facilities?q=fitness&amenities=Pool&amenities=Sauna&page=1&limit=10')
        .set(authHeader());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should respond within 300ms for getById', async () => {
      const start = Date.now();
      await request(app).get('/facilities/facility-001').set(authHeader());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300);
    });
  });

  describe('concurrent requests', () => {
    it('should handle 20 concurrent search requests within 500ms', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app).get('/facilities?q=fitness&page=1&limit=10').set(authHeader()),
      );

      const start = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - start;

      results.forEach((res) => expect(res.status).toBe(200));
      expect(duration).toBeLessThan(500);
    });

    it('should return consistent results under concurrent load', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/facilities?q=fitness&page=1&limit=5').set(authHeader()),
      );

      const results = await Promise.all(requests);
      const totals = results.map((r) => r.body.meta.total);

      // all concurrent requests should return the same total
      expect(new Set(totals).size).toBe(1);
    });

    // NOTE: additional cases to cover if time permits:
    // - 50 concurrent requests → all return 200
    // - mixed search + getById concurrent requests
  });
});
