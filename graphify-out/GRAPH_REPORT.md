# Graph Report - plugin-fastify  (2026-07-30)

## Corpus Check
- 9 files · ~3,781 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 100 nodes · 126 edges · 9 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `346c176c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- compilerOptions
- package.json
- devDependencies
- keywords
- prehandler.ts
- integration.test.ts
- @krynox/captcha-fastify
- Changelog

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 12 edges
2. `verifyKrynox()` - 9 edges
3. `keywords` - 8 edges
4. `krynoxCaptcha()` - 6 edges
5. `@krynox/captcha-fastify` - 6 edges
6. `KrynoxResult` - 5 edges
7. `KrynoxPreHandlerConfig` - 4 edges
8. `krynoxWidgetScript()` - 4 edges
9. `krynoxWidget()` - 4 edges
10. `fastify` - 3 edges

## Surprising Connections (you probably didn't know these)
- `FastifyRequest` --references--> `KrynoxResult`  [EXTRACTED]
  src/prehandler.ts → src/verify.ts
- `krynoxCaptcha()` --calls--> `verifyKrynox()`  [EXTRACTED]
  src/prehandler.ts → src/verify.ts
- `KrynoxPreHandlerConfig` --references--> `KrynoxResult`  [EXTRACTED]
  src/prehandler.ts → src/verify.ts

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.24
Nodes (14): backoff(), delay(), isAbort(), KrynoxAgent, KrynoxHuman, parse(), randomKey(), RiskLevel (+6 more)

### Community 1 - "compilerOptions"
Cohesion: 0.12
Nodes (15): ES2021, src, compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+7 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (22): description, exports, files, homepage, license, main, name, overrides (+14 more)

### Community 3 - "devDependencies"
Cohesion: 0.22
Nodes (9): fastify, devDependencies, fastify, @types/node, typescript, peerDependencies, fastify, @types/node (+1 more)

### Community 4 - "keywords"
Cohesion: 0.25
Nodes (8): keywords, bot, captcha, fastify, krynox, prehandler, privacy, proof-of-work

### Community 5 - "prehandler.ts"
Cohesion: 0.48
Nodes (6): clientIp(), fastify, FastifyRequest, krynoxCaptcha(), KrynoxPreHandlerConfig, KrynoxResult

### Community 6 - "integration.test.ts"
Cohesion: 0.29
Nodes (4): hits, PlaneHit, retryCounts, SUCCESS_PAYLOAD

### Community 7 - "@krynox/captcha-fastify"
Cohesion: 0.25
Nodes (7): Configuration — `krynoxCaptcha(config)`, Honeypot, @krynox/captcha-fastify, Reliability, The result — `request.krynox`, Verify preHandler, Widget embed

### Community 8 - "Changelog"
Cohesion: 0.40
Nodes (4): [0.1.0] - 2026-07-22, Added, Changelog, [Unreleased]

## Knowledge Gaps
- **49 isolated node(s):** `name`, `version`, `description`, `captcha`, `krynox` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `keywords` connect `keywords` to `package.json`?**
  _High betweenness centrality (0.293) - this node is a cross-community bridge._
- **Why does `fastify` connect `keywords` to `prehandler.ts`, `integration.test.ts`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._