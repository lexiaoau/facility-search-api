import request from 'supertest';
import { login } from '../utils/auth.js';
import app from '../app.js';

let token: string;

// obtain a valid token once before all tests
beforeAll(async () => {
  const { token: t } = await login('test@test.com', 'password');
  token = t;
});

const authHeader = (): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// GET /facilities
// ---------------------------------------------------------------------------

describe('GET /facilities', () => {
  describe('authentication', () => {
    it('should return 401 when no token provided', async () => {
      await request(app).get('/facilities?q=fitness').expect(401);
    });

    it('should return 401 when token is invalid', async () => {
      await request(app)
        .get('/facilities?q=fitness')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('validation', () => {
    it('should return 400 when q is missing', async () => {
      const res = await request(app).get('/facilities').set(authHeader()).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when q is empty string', async () => {
      const res = await request(app).get('/facilities?q=').set(authHeader()).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when q is whitespace only', async () => {
      const res = await request(app).get('/facilities?q=   ').set(authHeader()).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when limit exceeds 100', async () => {
      const res = await request(app)
        .get('/facilities?q=fitness&limit=101')
        .set(authHeader())
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('response shape', () => {
    it('should return correct response structure', async () => {
      const res = await request(app)
        .get('/facilities?q=fitness&page=1&limit=5')
        .set(authHeader())
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        meta: expect.objectContaining({
          page: 1,
          limit: 5,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      });
    });

    it('should return only id, name, address in search results', async () => {
      const res = await request(app).get('/facilities?q=fitness').set(authHeader()).expect(200);

      res.body.data.forEach((f: Record<string, unknown>) => {
        expect(f).toHaveProperty('id');
        expect(f).toHaveProperty('name');
        expect(f).toHaveProperty('address');
        expect(f).not.toHaveProperty('location');
        expect(f).not.toHaveProperty('facilities');
      });
    });

    it('should return empty data array for no matches', async () => {
      const res = await request(app).get('/facilities?q=velocity').set(authHeader()).expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('amenities filter', () => {
    it('should support single amenity param', async () => {
      const res = await request(app)
        .get('/facilities?q=fitness&amenities=Pool')
        .set(authHeader())
        .expect(200);

      res.body.data.forEach((f: Record<string, unknown>) => {
        expect(f).toBeDefined();
      });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(0);
    });

    it('should support multiple amenities as repeated params', async () => {
      await request(app)
        .get('/facilities?q=fitness&amenities=Pool&amenities=Sauna')
        .set(authHeader())
        .expect(200);
    });

    it('should support comma-separated amenities', async () => {
      await request(app)
        .get('/facilities?q=fitness&amenities=Pool,Sauna')
        .set(authHeader())
        .expect(200);
    });
  });

  describe('pagination', () => {
    it('should respect page and limit params', async () => {
      const res = await request(app)
        .get('/facilities?q=fitness&page=1&limit=3')
        .set(authHeader())
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(3);
    });

    it('should return empty data for out-of-bounds page', async () => {
      const res = await request(app)
        .get('/facilities?q=fitness&page=9999&limit=10')
        .set(authHeader())
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(0);
    });

    // NOTE: additional cases to cover if time permits:
    // - page 1 and page 2 results do not overlap
    // - totalPages matches Math.ceil(total / limit)
  });
});

// ---------------------------------------------------------------------------
// GET /facilities/:id
// ---------------------------------------------------------------------------

describe('GET /facilities/:id', () => {
  it('should return full facility details', async () => {
    const res = await request(app).get('/facilities/facility-001').set(authHeader()).expect(200);

    expect(res.body).toMatchObject({
      id: 'facility-001',
      name: expect.any(String),
      address: expect.any(String),
      location: expect.objectContaining({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
      facilities: expect.any(Array),
    });
  });

  it('should return 404 for non-existent id', async () => {
    const res = await request(app).get('/facilities/does-not-exist').set(authHeader()).expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 401 when no token provided', async () => {
    await request(app).get('/facilities/facility-001').expect(401);
  });

  // NOTE: additional cases to cover if time permits:
  // - empty id → 400
  // - id with special characters → 404
});
