const request = require('supertest');

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../src/logger');
const app = require('../app');

beforeEach(() => {
  jest.clearAllMocks();
});

test('pino logger.info is called on a request', async () => {
  await request(app).get('/healthz');
  expect(logger.info).toHaveBeenCalled();
});
