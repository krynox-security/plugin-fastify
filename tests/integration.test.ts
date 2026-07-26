// Real-server integration suite: a real Fastify instance (ephemeral port) is driven over HTTP
// against a real mock data plane (Bun.serve). Mirrors plugin-spring-boot's
// KrynoxIntegrationTest coverage: pass/reject, full contract surfaced on request.krynox,
// header fallback, method passthrough, 503→200 retry with a stable idempotency key,
// honeypot forwarding semantics, onFailure override, and per-attempt timeout.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { krynoxCaptcha } from '../src/index';

interface PlaneHit {
  body: Record<string, unknown>;
}

const SUCCESS_PAYLOAD = {
  success: true,
  score: 0.95,
  risk: 'low',
  hostname: 'example.com',
  challenge_ts: '2026-01-01T00:00:00Z',
  'error-codes': [],
  reasons: ['tor-exit', 'elevated-request-rate'],
  agent: { verified: true, name: 'agent.openai.com', allowlisted: true },
  human: { attested: true, method: 'private-access-token', issuer: 'demo-pat.issuer.cloudflare.com' },
};

const hits: PlaneHit[] = [];
const retryCounts = new Map<string, number>();
let plane: ReturnType<typeof Bun.serve>;
let apiHost: string;
let app: FastifyInstance;
let baseUrl: string;

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  // (a) The mock data plane — a real HTTP server implementing POST /siteverify.
  plane = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      if (url.pathname !== '/siteverify' || req.method !== 'POST') {
        return new Response('not found', { status: 404 });
      }
      const body = (await req.json()) as Record<string, unknown>;
      hits.push({ body });

      const token = typeof body.response === 'string' ? body.response : '';
      const key = typeof body.idempotency_key === 'string' ? body.idempotency_key : 'nokey';

      if (token === 'RETRY') {
        const n = (retryCounts.get(key) ?? 0) + 1;
        retryCounts.set(key, n);
        if (n === 1) return new Response('upstream', { status: 503 });
        return Response.json(SUCCESS_PAYLOAD);
      }
      if (token === 'SLOW') {
        await delay(400);
        return Response.json(SUCCESS_PAYLOAD);
      }
      if (token === '' || token === 'BAD') {
        return Response.json({ success: false, 'error-codes': ['invalid-input-response'], reasons: [] });
      }
      if (typeof body.honeypot === 'string' && body.honeypot !== '') {
        return Response.json({
          success: false,
          'error-codes': ['honeypot-tripped'],
          reasons: ['honeypot-tripped'],
        });
      }
      return Response.json(SUCCESS_PAYLOAD);
    },
  });
  apiHost = `http://127.0.0.1:${plane.port}`;

  // (b) The real Fastify instance under test.
  app = Fastify();

  const preHandler = krynoxCaptcha({ secret: 'kcps_test', apiHost });

  app.post('/submit', { preHandler }, async (request) => {
    return { ok: true, krynox: request.krynox };
  });
  // Same preHandler on a GET route: not in the enforced-methods set, must pass straight through.
  app.get('/open', { preHandler }, async () => 'open');
  app.post(
    '/custom',
    {
      preHandler: krynoxCaptcha({
        secret: 'kcps_test',
        apiHost,
        onFailure: (_request, reply, result) => reply.code(418).send({ teapot: true, codes: result.errorCodes }),
      }),
    },
    async () => 'never',
  );
  app.post(
    '/tight',
    { preHandler: krynoxCaptcha({ secret: 'kcps_test', apiHost, timeoutMs: 50 }) },
    async () => 'never',
  );

  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await plane.stop(true);
});

beforeEach(() => {
  hits.length = 0;
  retryCounts.clear();
});

function postJson(path: string, fields: Record<string, string>): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

describe('krynoxCaptcha() preHandler against a real data plane', () => {
  test('valid token in the body field passes and surfaces the full contract on request.krynox', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'goodtoken' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; krynox: Record<string, unknown> };
    expect(json.ok).toBe(true);
    expect(json.krynox).toEqual({
      success: true,
      score: 0.95,
      risk: 'low',
      hostname: 'example.com',
      challengeTs: '2026-01-01T00:00:00Z',
      errorCodes: [],
      reasons: ['tor-exit', 'elevated-request-rate'],
      agent: { verified: true, name: 'agent.openai.com', allowlisted: true },
      human: { attested: true, method: 'private-access-token', issuer: 'demo-pat.issuer.cloudflare.com' },
    });
    // The end-user IP reached /siteverify as remoteip.
    expect(hits).toHaveLength(1);
    expect(typeof hits[0]!.body.remoteip).toBe('string');
    expect((hits[0]!.body.remoteip as string).length).toBeGreaterThan(0);
    expect(hits[0]!.body.secret).toBe('kcps_test');
    expect(hits[0]!.body.response).toBe('goodtoken');
  });

  test('bad token is rejected 403 with the data-plane error codes passed through', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'BAD' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: 'captcha_failed',
      'error-codes': ['invalid-input-response'],
    });
  });

  test('missing token is rejected 403 locally without hitting the data plane', async () => {
    const res = await postJson('/submit', { other: 'field' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: 'captcha_failed',
      'error-codes': ['missing-input-response'],
    });
    expect(hits).toHaveLength(0);
  });

  test('token falls back to the x-krynox-captcha header for API clients', async () => {
    const res = await fetch(`${baseUrl}/submit`, {
      method: 'POST',
      headers: { 'x-krynox-captcha': 'goodtoken' },
    });
    expect(res.status).toBe(200);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.body.response).toBe('goodtoken');
  });

  test('non-enforced method (GET) passes straight through with no data-plane hit', async () => {
    const res = await fetch(`${baseUrl}/open`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('open');
    expect(hits).toHaveLength(0);
  });

  test('503 then 200: the request still succeeds after exactly 2 upstream hits sharing one idempotency_key', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'RETRY' });
    expect(res.status).toBe(200);
    expect(hits).toHaveLength(2);
    const [first, second] = hits;
    expect(typeof first!.body.idempotency_key).toBe('string');
    expect((first!.body.idempotency_key as string).length).toBeGreaterThan(0);
    expect(second!.body.idempotency_key).toBe(first!.body.idempotency_key);
  });

  test('clean submit without a honeypot field omits `honeypot` from the upstream body', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'goodtoken' });
    expect(res.status).toBe(200);
    expect(hits).toHaveLength(1);
    // config.honeypot stays undefined, so JSON.stringify drops the key entirely.
    expect('honeypot' in hits[0]!.body).toBe(false);
  });

  test('empty honeypot field is forwarded as "" and is never penalised', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'goodtoken', 'krynox-hp': '' });
    expect(res.status).toBe(200);
    expect(hits).toHaveLength(1);
    // An empty string is still a string, so the preHandler forwards it verbatim.
    expect(hits[0]!.body.honeypot).toBe('');
  });

  test('filled honeypot is forwarded and the enforce-mode rejection becomes a 403', async () => {
    const res = await postJson('/submit', { 'krynox-captcha': 'goodtoken', 'krynox-hp': 'bot@spam.com' });
    expect(res.status).toBe(403);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.body.honeypot).toBe('bot@spam.com');
    expect(await res.json()).toEqual({
      success: false,
      error: 'captcha_failed',
      'error-codes': ['honeypot-tripped'],
    });
  });

  test('onFailure overrides the default 403 reply', async () => {
    const res = await postJson('/custom', { 'krynox-captcha': 'BAD' });
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ teapot: true, codes: ['invalid-input-response'] });
  });

  test('slow data plane with a tiny timeoutMs fails closed as 403 timeout', async () => {
    const res = await postJson('/tight', { 'krynox-captcha': 'SLOW' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: 'captcha_failed',
      'error-codes': ['timeout'],
    });
  });
});
