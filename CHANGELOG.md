# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-22

First release.

### Added

- Server-side verification against `POST /siteverify`, exposing `success`,
  `score`, `risk` and the stable `reasons` codes on the request.
- `agent` and `human` signals on the result — a verified AI agent (Web Bot Auth)
  and an attested human (Private Access Token or WebAuthn passkey).
- Honeypot support: the widget's invisible decoy field (`krynox-hp`) is
  forwarded to `/siteverify` as `honeypot`, so a bot that fills it is flagged
  or rejected server-side.
- Automatic retries on transient failures with a per-verify idempotency key, so
  a retried single-use token replays the first outcome.
- Configurable API host for self-hosted deployments.
- `krynoxCaptcha()` preHandler and a `krynoxWidget()` embed helper.
- Result is attached to `request.krynox`.
- Visitor IP comes from Fastify `request.ip`, so it honours your `trustProxy` setting.

[0.1.0]: https://github.com/krynox-security/plugin-fastify/releases/tag/v0.1.0
