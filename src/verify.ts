// Self-contained Krynox verify — zero runtime dependencies (uses global fetch, Node 18+).
// Mirrors the official @krynox/captcha SDK contract so the middleware exposes the full result.

export type RiskLevel = 'low' | 'medium' | 'high';

/** A cryptographically verified AI agent (Web Bot Auth), when forwarded. */
export interface KrynoxAgent {
  verified: boolean;
  name?: string;
  allowlisted?: boolean;
}

/** A device-attested real human (Private Access Token), when forwarded. */
export interface KrynoxHuman {
  attested: boolean;
  method?: string;
  issuer?: string;
}

export interface KrynoxResult {
  success: boolean;
  score?: number;
  risk?: RiskLevel;
  hostname?: string;
  challengeTs?: string;
  errorCodes?: string[];
  /** Stable reason codes explaining the score — empty on a clean verification. */
  reasons?: string[];
  agent?: KrynoxAgent;
  human?: KrynoxHuman;
}

export interface VerifyOptions {
  /** Secret key. Defaults to process.env.KRYNOX_SECRET_KEY. */
  secret?: string;
  /** Data-plane host. Defaults to process.env.KRYNOX_API_HOST or https://api.krynox.net. */
  apiHost?: string;
  /** End-user IP (recommended — powers the cross-tenant reputation moat). */
  remoteip?: string;
  /** Honeypot decoy value (the submitted `krynox-hp` field). Forwarded so the data plane can
   *  flag/block a filled-in decoy per the site's Honeypot policy. Omit/empty when not tripped. */
  honeypot?: string;
  /** Per-attempt request timeout in ms (default 5000). */
  timeoutMs?: number;
  /** Transient-failure (network / 429 / 5xx) retries (default 2). */
  retries?: number;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number): number => Math.min(1000, 100 * 2 ** attempt);
const isAbort = (e: unknown): boolean => e instanceof Error && e.name === 'AbortError';
const randomKey = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `k_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function parse(data: Record<string, unknown>): KrynoxResult {
  const agent = data.agent as Record<string, unknown> | undefined;
  const human = data.human as Record<string, unknown> | undefined;
  return {
    success: data.success === true,
    score: typeof data.score === 'number' ? data.score : undefined,
    risk: data.risk as RiskLevel | undefined,
    hostname: typeof data.hostname === 'string' ? data.hostname : undefined,
    challengeTs: typeof data.challenge_ts === 'string' ? data.challenge_ts : undefined,
    errorCodes: Array.isArray(data['error-codes']) ? (data['error-codes'] as string[]) : undefined,
    reasons: Array.isArray(data.reasons) ? (data.reasons as string[]) : undefined,
    agent:
      agent && typeof agent === 'object'
        ? { verified: agent.verified === true, name: typeof agent.name === 'string' ? agent.name : undefined, allowlisted: agent.allowlisted === true }
        : undefined,
    human:
      human && typeof human === 'object'
        ? { attested: human.attested === true, method: typeof human.method === 'string' ? human.method : undefined, issuer: typeof human.issuer === 'string' ? human.issuer : undefined }
        : undefined,
  };
}

/**
 * Verify a solved Krynox token against `POST /siteverify`. Retries transient failures
 * (network / 429 / 5xx) with a per-verify idempotency key so a retried single-use token
 * replays the first outcome instead of failing.
 */
export async function verifyKrynox(
  token: string | null | undefined,
  options: VerifyOptions = {},
): Promise<KrynoxResult> {
  if (!token) return { success: false, errorCodes: ['missing-input-response'], reasons: [] };

  const secret = options.secret ?? process.env.KRYNOX_SECRET_KEY ?? '';
  const apiHost = (options.apiHost ?? process.env.KRYNOX_API_HOST ?? 'https://api.krynox.net').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 5000;
  const retries = options.retries ?? 2;
  const idempotency_key = retries > 0 ? randomKey() : undefined;
  const body = JSON.stringify({ secret, response: token, remoteip: options.remoteip, honeypot: options.honeypot, idempotency_key });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${apiHost}/siteverify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: controller.signal,
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        lastErr = new Error(`http ${res.status}`);
        await delay(backoff(attempt));
        continue;
      }
      return parse((await res.json()) as Record<string, unknown>);
    } catch (e) {
      lastErr = e;
      if (isAbort(e)) return { success: false, errorCodes: ['timeout'], reasons: [] };
      if (attempt >= retries) break;
      await delay(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  void lastErr;
  return { success: false, errorCodes: ['request-failed'], reasons: [] };
}
