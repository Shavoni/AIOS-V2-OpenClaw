const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

afterAll(async () => {
  await mongoose.disconnect();
});

describe('AIOS V2 API', () => {
  describe('GET /health', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toBe('AIOS V2 is running');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return system metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('cpu');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
    });
  });
});
