# @krynox/captcha-fastify

Official [**Krynox Captcha**](https://krynox.net) integration for **Fastify** — a verify
preHandler plus a server-rendered widget embed helper. Privacy-first, proof-of-work CAPTCHA.

```bash
npm install @krynox/captcha-fastify
```

Set `KRYNOX_SECRET_KEY` (your `kcps_…` secret) in the environment.

## Verify preHandler

Attach `krynoxCaptcha()` as a route `preHandler`. It reads the solved token from the request body
field `krynox-captcha` and falls back to the `x-krynox-captcha` header for fetch/API clients. On
failure it replies `403`; on success it sets the full result on `request.krynox` and the route runs.

```js
import Fastify from 'fastify';
import { krynoxCaptcha } from '@krynox/captcha-fastify';

const app = Fastify();

app.post('/signup', { preHandler: krynoxCaptcha() }, async (req) => {
  // reached only when the captcha passed
  if (req.krynox?.risk === 'high' || req.krynox?.reasons?.includes('tor-exit')) {
    // add friction: email verification, manual review, …
  }
  return { ok: true };
});
```

Attaching it per-route is the idiomatic Fastify way to protect only the endpoints that need it.
Only `POST`/`PUT`/`PATCH`/`DELETE` are enforced by default.

### The result — `request.krynox`

`{ success, score?, risk?, hostname?, challengeTs?, errorCodes?, reasons?, agent?, human? }`

- `reasons` — stable codes explaining the score (`tor-exit`, `elevated-request-rate`, …).
- `agent` — a **verified AI agent** (Web Bot Auth) when forwarded: `{ verified, name, allowlisted }`.
- `human` — a **device-attested human** (Private Access Token) when forwarded: `{ attested, method, issuer }`.

```js
app.post('/api', { preHandler: krynoxCaptcha() }, async (req) => {
  if (req.krynox?.agent?.verified && req.krynox.agent.allowlisted) return { bot: 'allowed' };
  return { ok: true };
});
```

## Widget embed

`krynoxWidget()` returns the loader `<script>` + `<krynox-captcha>` element as an HTML string.
Place it inside your `<form>` (works with any templating — `@fastify/view`, plain strings, …).

```js
import { krynoxWidget } from '@krynox/captcha-fastify';

app.get('/signup', async (_req, reply) => {
  reply.type('text/html').send(`
    <form method="post" action="/signup">
      ${krynoxWidget({ sitekey: process.env.KRYNOX_SITE_KEY })}
      <button type="submit">Sign up</button>
    </form>
  `);
});
```

## Configuration — `krynoxCaptcha(config)`

| Option | Default | Notes |
| --- | --- | --- |
| `secret` | `process.env.KRYNOX_SECRET_KEY` | Your `kcps_…` secret key. |
| `apiHost` | `process.env.KRYNOX_API_HOST` or `https://api.krynox.net` | Data-plane host (self-hosting). |
| `field` | `krynox-captcha` | Body field carrying the token. |
| `header` | `x-krynox-captcha` | Header checked when the field is absent. |
| `methods` | `['POST','PUT','PATCH','DELETE']` | Methods to enforce on. |
| `timeoutMs` | `5000` | Per-attempt request timeout. |
| `retries` | `2` | Transient-failure (network/429/5xx) retries; a retried single-use token replays the first outcome via an idempotency key. |
| `onFailure` | 403 JSON | `(request, reply, result) => unknown` to customise the rejection. |

`verifyKrynox(token, options)` is also exported for manual verification.

## Reliability

Transient failures (network, `429`, `5xx`) are retried automatically with exponential backoff.
Because a captcha token is single-use, a retried verify carries an **idempotency key** so the retry
replays the first outcome instead of failing the now-consumed token.

MIT licensed. Docs: <https://docs.krynox.net>
