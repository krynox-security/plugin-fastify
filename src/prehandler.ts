import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { verifyKrynox, type KrynoxResult } from './verify';

declare module 'fastify' {
  interface FastifyRequest {
    /** The Krynox verification result, set by the `krynoxCaptcha()` preHandler. */
    krynox?: KrynoxResult;
  }
}

export interface KrynoxPreHandlerConfig {
  /** Secret key. Defaults to `process.env.KRYNOX_SECRET_KEY`. */
  secret?: string;
  /** Data-plane host override. Defaults to `process.env.KRYNOX_API_HOST` or `https://api.krynox.net`. */
  apiHost?: string;
  /** Body field carrying the solved token (default `krynox-captcha`). */
  field?: string;
  /** Header checked when the field is absent (default `x-krynox-captcha`) — for fetch/API clients. */
  header?: string;
  /**
   * HTTP methods to enforce on (default POST, PUT, PATCH, DELETE). A non-enforced method attached to
   * this preHandler still passes straight through.
   */
  methods?: string[];
  /** Per-attempt timeout in ms (default 5000). */
  timeoutMs?: number;
  /** Transient-failure retries (default 2). */
  retries?: number;
  /**
   * Custom failure handler. Default replies `403` with
   * `{ success: false, error: 'captcha_failed', 'error-codes': [...] }`.
   */
  onFailure?: (request: FastifyRequest, reply: FastifyReply, result: KrynoxResult) => unknown;
}

function clientIp(request: FastifyRequest): string | undefined {
  const fwd = request.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return first?.trim() || request.ip || undefined;
}

/**
 * A Fastify **preHandler** that verifies a Krynox Captcha token before the route runs. Attach it
 * per-route (idiomatic for selective protection):
 *
 *   import { krynoxCaptcha } from '@krynox/captcha-fastify';
 *   fastify.post('/signup', { preHandler: krynoxCaptcha() }, async (req) => {
 *     if (req.krynox?.risk === 'high') { ... }   // add friction
 *     return { ok: true };
 *   });
 *
 * The token is read from the request body field (`krynox-captcha` by default) and falls back to the
 * `x-krynox-captcha` header. On success the full result is set on `request.krynox` and the lifecycle
 * continues; on failure it replies `403` (override with `onFailure`).
 */
export function krynoxCaptcha(config: KrynoxPreHandlerConfig = {}): preHandlerAsyncHookHandler {
  const field = config.field ?? 'krynox-captcha';
  const header = (config.header ?? 'x-krynox-captcha').toLowerCase();
  const methods = config.methods ?? ['POST', 'PUT', 'PATCH', 'DELETE'];

  return async function krynoxPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!methods.includes(request.method)) return;

    const body = request.body as Record<string, unknown> | undefined;
    const fromBody = typeof body?.[field] === 'string' ? (body[field] as string) : undefined;
    const token = fromBody ?? (request.headers[header] as string | undefined);

    const result = await verifyKrynox(token, {
      secret: config.secret,
      apiHost: config.apiHost,
      remoteip: clientIp(request),
      timeoutMs: config.timeoutMs,
      retries: config.retries,
    });
    request.krynox = result;

    if (!result.success) {
      if (config.onFailure) {
        await config.onFailure(request, reply, result);
        return;
      }
      await reply
        .code(403)
        .send({ success: false, error: 'captcha_failed', 'error-codes': result.errorCodes ?? [] });
    }
  };
}
