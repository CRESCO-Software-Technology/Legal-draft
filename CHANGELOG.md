# Changelog

All notable changes to draftLegal are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses semantic
versioning once it reaches 1.0. Until then, minor bumps (0.x) may include
breaking changes — each is called out below with its migration note.

**Release process:** tag a release commit `vX.Y.Z`, update this file, and set
the matching version in the workspace `package.json` files. Self-hosters read
the entry for their target version before upgrading (see
`docs/operations/SELF-HOSTING.md`); upgrades apply forward Prisma migrations
automatically and never reset data.

## [Unreleased] — "Make it real" (Waves 0–5)

The program that took the app from demo-shaped to runnable, secure, honest,
deployable, and regression-guarded. CI is green on GitHub Actions for the first
time, and now gates merges.

### Added
- **Real features:** per-change redline accept/reject, playbook comparison,
  inline approval, PAdES/X.509 e-signature (tamper-evident), durable Yjs collab
  persistence.
- **Parallel approvals:** N-of-M with short-circuit + deadlock-safe clamping.
- **BYOK:** per-org API keys are actually used at inference time.
- **Prompt-injection defenses** on untrusted contract text.
- **Ops:** migrations run in the deploy pipeline; dedicated always-on worker
  service; private Gotenberg with OIDC; Linux OCR (tesseract); pgvector HNSW
  ANN index; secure self-host stack (`docker-compose.selfhost.yml`) + runbook;
  web bundle-size CI gate.
- **Regression net (Wave 5):** integration suite that boots the real app against
  Postgres+Redis and exercises routes (cross-org isolation, RBAC per role,
  approval state machine); index-on-create source tripwire; real ESLint
  (installed + green). CI runs typecheck + lint + unit + integration on every PR.

### Fixed
- **Security (fail-closed):** JWT/portal secrets at boot, API-key scope→perm
  map, cross-org matter leak, spoofable rate-limit key, webhook SSRF, null-value
  auto-approve, RBAC gaps, upload magic-byte validation, XSS sinks.
- **Backend/engine:** BM25 full-text indexing (+ every create-path indexes to
  ES), intake description drop, invoice amount matching, chat cost recording,
  sequential e-sign next-signer notification, status/enum bugs.
- **Runs/builds:** CI pnpm-version conflict, 39 API type errors, keyless boot,
  missing `check-bundle-size.mjs`, missing `prisma generate` in CI.

### Migration notes
- New env vars for prod/self-host: `WORKERS_ENABLED` (set `false` on the API
  when a dedicated worker service runs), `GOTENBERG_REQUIRE_AUTH` (`true` in
  prod). Deploy now runs `prisma migrate deploy` before services start.
- One new migration `20260707180000_pgvector_hnsw_index` (adds an HNSW index;
  applied automatically).
- After restoring from backup, rebuild the ES index:
  `pnpm --filter api backfill-es-index`.

### Operator action
- Make CI a **required** status check on `main` (branch protection) so red PRs
  can't merge — the checks are green and ready to gate. See
  `docs/operations/SELF-HOSTING.md` §Release process / the PR description.
