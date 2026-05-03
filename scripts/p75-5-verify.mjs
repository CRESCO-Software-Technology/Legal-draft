#!/usr/bin/env node
/**
 * P7.5.5 verify — Production eval harness CLI.
 *
 * The harness scaffolding (runner.py, graders/) was already in place from
 * D.0.9 but had no real cases or wrap-around CLI. P7.5 adds:
 *   - 2 obligation eval cases (payment_basic, sla_uptime)
 *   - Synthetic obligations runner (no LLM needed; mocks output shape)
 *   - HTTP runner that hits POST /extract_obligations when EVAL_USE_HTTP=1
 *   - CLI: `python -m evals.cli <agent>`
 *   - --baseline / --check-baseline workflow for regression detection
 *
 * Checks:
 *   (1) `obligations` cases dir has ≥2 yaml files
 *   (2) Eval CLI runs without LLM and produces a JSON report
 *   (3) Both obligation cases pass with the synthetic runner
 *   (4) --baseline writes baseline.json
 *   (5) --check-baseline finds no regressions
 */
import { REPO_ROOT } from './lib/repo-root.mjs'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

let fail = 0
const check = (cond, msg) => { console.log(cond ? `  ✓ ${msg}` : `  ✗ ${msg}`); if (!cond) fail++ }

const AGENTS = path.join(REPO_ROOT, 'apps/agents')
const PY = `${AGENTS}/.venv/bin/python`

console.log('\n=== (1) Eval cases on disk ===')
const casesDir = `${AGENTS}/evals/cases/obligations`
const yamls = fs.readdirSync(casesDir).filter(f => f.endsWith('.yaml'))
check(yamls.length >= 2, `≥2 obligation cases (got ${yamls.length}: ${yamls.join(', ')})`)

console.log('\n=== (2) CLI runs + emits JSON report ===')
const r = spawnSync(PY, ['-m', 'evals.cli', 'obligations'], {
  cwd: AGENTS,
  encoding: 'utf8',
})
const out = (r.stdout ?? '') + (r.stderr ?? '')
check(r.status === 0, `cli exits 0 (got ${r.status})`)
let report = null
// stdout has the JSON; INFO logs go to stderr, so use stdout only
try {
  const stdout = r.stdout ?? ''
  const m = stdout.match(/\{[\s\S]*"reports"[\s\S]*\}/)
  if (m) report = JSON.parse(m[0])
} catch (e) {
  console.log(`  parse error: ${e.message}`)
}
check(!!report?.reports, `report parsable as JSON with .reports`)

console.log('\n=== (3) Both obligation cases pass ===')
const oblReport = (report?.reports ?? []).find(r => r.agent === 'obligations')
check(oblReport?.cases === 2, `obligations report has 2 cases (got ${oblReport?.cases})`)
check(oblReport?.passed === 2, `both cases passed (got ${oblReport?.passed})`)

console.log('\n=== (4) --baseline writes baseline.json ===')
const baseline = spawnSync(PY, ['-m', 'evals.cli', '--baseline'], {
  cwd: AGENTS,
  encoding: 'utf8',
})
check(baseline.status === 0, `baseline write exits 0`)
check(fs.existsSync(`${AGENTS}/evals/baseline.json`), `baseline.json exists`)

console.log('\n=== (5) --check-baseline reports no regressions ===')
const checkBase = spawnSync(PY, ['-m', 'evals.cli', '--check-baseline'], {
  cwd: AGENTS,
  encoding: 'utf8',
})
const checkOut = (checkBase.stdout ?? '') + (checkBase.stderr ?? '')
check(checkBase.status === 0, `check-baseline exits 0 (no regressions)`)
check(/no regressions/i.test(checkOut), `output mentions "no regressions"`)

if (fail) { console.error(`\n✗ ${fail} check(s) failed`); process.exit(1) }
console.log('\n✓ All P7.5.5 eval-harness checks pass')
