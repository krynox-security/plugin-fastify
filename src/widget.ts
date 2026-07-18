// Server-rendered widget embed helpers — return HTML strings you can drop into any template
// engine (EJS, Pug, Handlebars, plain string templating, …).

export interface KrynoxWidgetOptions {
  /** Public site key (kcpt_…). Ignored when `challenge` is provided. */
  sitekey?: string;
  /** Full challenge URL override (advanced). */
  challenge?: string;
  /** Data-plane host (default https://api.krynox.net). */
  apiHost?: string;
  /** CDN host serving the widget script (default https://cdn.krynox.net). */
  cdnHost?: string;
  /** Extra attributes forwarded to the `<krynox-captcha>` element (e.g. `{ theme: 'dark' }`). */
  attrs?: Record<string, string>;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The `<script>` tag that loads the widget web component from the CDN (module, async, defer). */
export function krynoxWidgetScript(cdnHost = 'https://cdn.krynox.net'): string {
  const src = `${cdnHost.replace(/\/$/, '')}/widget/krynox-captcha.js`;
  return `<script src="${esc(src)}" type="module" async defer></script>`;
}

/**
 * Full embed: the loader `<script>` plus the `<krynox-captcha>` element. Place it inside your
 * `<form>` — the widget injects the solved token as a hidden `krynox-captcha` field, which the
 * verify middleware then reads.
 *
 *   res.send(`<form method="post" action="/submit">${krynoxWidget({ sitekey })}<button>Go</button></form>`);
 */
export function krynoxWidget(options: KrynoxWidgetOptions = {}): string {
  const apiHost = (options.apiHost ?? 'https://api.krynox.net').replace(/\/$/, '');
  const challenge = options.challenge ?? `${apiHost}/challenge?sitekey=${encodeURIComponent(options.sitekey ?? '')}`;
  const extra = Object.entries(options.attrs ?? {})
    .map(([k, v]) => ` ${esc(k)}="${esc(v)}"`)
    .join('');
  return `${krynoxWidgetScript(options.cdnHost)}<krynox-captcha challenge="${esc(challenge)}"${extra}></krynox-captcha>`;
}
