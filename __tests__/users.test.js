'use strict';

const request = require('supertest');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { InMemorySpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { W3CTraceContextPropagator } = require('@opentelemetry/core');

const TRACEPARENT_RE = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

let app;
let resetUsers;
let memoryExporter;
let provider;

beforeAll(() => {
  memoryExporter = new InMemorySpanExporter();
  provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });

  // Require after provider.register() so the global tracer resolves to our provider.
  app = require('../app');
  ({ resetUsers } = require('../routes/users'));
});

afterAll(async () => {
  await provider.shutdown();
});

beforeEach(() => {
  memoryExporter.reset();
  resetUsers();
});

describe('Tracing smoke tests', () => {
  it('GET /users — span named "HTTP GET /users" and traceparent response header', async () => {
    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.headers['traceparent']).toMatch(TRACEPARENT_RE);

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.some((s) => s.name === 'HTTP GET /users')).toBe(true);
  });

  it('POST /users — span named "HTTP POST /users" and traceparent response header', async () => {
    const res = await request(app).post('/users').send({ name: 'Bob' });

    expect(res.status).toBe(201);
    expect(res.headers['traceparent']).toMatch(TRACEPARENT_RE);

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.some((s) => s.name === 'HTTP POST /users')).toBe(true);
  });

  it('GET /users/:id — span named "HTTP GET /users/:id" and traceparent response header', async () => {
    const res = await request(app).get('/users/1');

    expect(res.status).toBe(200);
    expect(res.headers['traceparent']).toMatch(TRACEPARENT_RE);

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.some((s) => s.name === 'HTTP GET /users/:id')).toBe(true);
  });
});
