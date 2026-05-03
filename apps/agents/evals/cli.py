"""
P7.5.5 — Production eval harness CLI.

Usage:
  python -m apps.agents.evals.cli <agent>            # run cases for one agent
  python -m apps.agents.evals.cli --all              # run every cases dir
  python -m apps.agents.evals.cli --baseline         # write baseline.json
  python -m apps.agents.evals.cli --check-baseline   # diff against baseline

Default runner is `echo` (no LLM call) which lets us exercise the
harness in CI without API tokens. Real runners wire in via
HTTP_RUNNERS — flip env AGENTS_URL to point at a live agents service
+ EVAL_USE_HTTP=1 to actually call /extract_obligations etc.

Exit codes:
  0  all cases passed
  1  ≥1 case failed
  2  no cases found for the requested agent
  3  baseline diff has regressions
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Callable

from .runner import (
    AgentRunner,
    BUILTIN_RUNNERS,
    Report,
    load_cases,
    run_eval,
    echo_runner,
)

log = logging.getLogger("evals.cli")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

CASES_ROOT = Path(__file__).parent / "cases"
BASELINE_PATH = Path(__file__).parent / "baseline.json"


# ─── Optional HTTP runners (real LLM calls) ────────────────────────────────


def _http_obligations_runner(inp: dict) -> tuple[dict, float, float]:
    """Hit POST /extract_obligations on the running agents service."""
    import time
    import urllib.request
    import urllib.error

    body = json.dumps({
        "plainText":    inp.get("text", ""),
        "contractType": inp.get("contractType", "MSA"),
    }).encode()
    req = urllib.request.Request(
        url=os.environ.get("AGENTS_URL", "http://localhost:8000") + "/extract_obligations",
        method="POST",
        headers={
            "content-type": "application/json",
            "x-internal-secret": os.environ.get("INTERNAL_SERVICE_SECRET", ""),
        },
        data=body,
    )
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        # Caller treats raised exceptions as case failures.
        raise RuntimeError(f"agents service unreachable: {e}") from e
    return payload, 0.0, (time.monotonic() - t0) * 1000


HTTP_RUNNERS: dict[str, AgentRunner] = {
    "obligations": _http_obligations_runner,
}


def _runner_for(agent: str) -> AgentRunner | None:
    """Pick a runner: real HTTP runner only when EVAL_USE_HTTP=1."""
    if os.environ.get("EVAL_USE_HTTP") == "1":
        return HTTP_RUNNERS.get(agent) or BUILTIN_RUNNERS.get(agent) or echo_runner
    return BUILTIN_RUNNERS.get(agent) or echo_runner


# ─── Commands ──────────────────────────────────────────────────────────────


def _run_one(agent: str) -> Report:
    runner = _runner_for(agent)
    return run_eval(agent, runner=runner)


def _all_agents() -> list[str]:
    if not CASES_ROOT.exists():
        return []
    return sorted([p.name for p in CASES_ROOT.iterdir() if p.is_dir()])


def cmd_run(agent: str | None) -> int:
    agents = [agent] if agent else _all_agents()
    if not agents:
        log.error("no agents found under %s", CASES_ROOT)
        return 2

    overall_pass = True
    overall_summary: list[dict] = []
    for a in agents:
        r = _run_one(a)
        overall_summary.append(r.as_dict())
        if r.cases == 0:
            log.warning("[%s] no cases on disk", a)
            continue
        log.info(
            "[%s] %d/%d passed (avg latency %.1fms, $%.4f)",
            a, r.passed, r.cases, r.avg_latency_ms, r.total_cost_usd,
        )
        if r.failed > 0:
            overall_pass = False
            for cr in r.results:
                if not cr.passed:
                    log.error("  ✗ %s — %s", cr.name, cr.message)

    print(json.dumps({"reports": overall_summary}, indent=2))
    return 0 if overall_pass else 1


def cmd_baseline() -> int:
    """Write the current run as the baseline so future runs can diff."""
    agents = _all_agents()
    reports = [_run_one(a).as_dict() for a in agents]
    BASELINE_PATH.write_text(json.dumps({"reports": reports}, indent=2))
    log.info("wrote baseline to %s (%d agents)", BASELINE_PATH, len(reports))
    return 0


def cmd_check_baseline() -> int:
    """Run all agents + report any regressions vs the baseline.

    A regression is: a case that PASSED in the baseline but FAILED now,
    OR a baseline pass-rate that dropped by ≥5%.
    """
    if not BASELINE_PATH.exists():
        log.error("no baseline at %s — run --baseline first", BASELINE_PATH)
        return 3
    baseline = json.loads(BASELINE_PATH.read_text()).get("reports", [])
    by_agent = {r["agent"]: r for r in baseline}

    regressions: list[str] = []
    for a in _all_agents():
        r = _run_one(a).as_dict()
        prev = by_agent.get(a)
        if not prev:
            log.info("[%s] new agent — no baseline to compare", a)
            continue
        prev_passed = {res["name"] for res in prev["results"] if res["passed"]}
        now_failed = {res["name"] for res in r["results"] if not res["passed"]}
        for name in (prev_passed & now_failed):
            regressions.append(f"{a}/{name}: PASS → FAIL")
        prev_rate = prev["passed"] / max(1, prev["cases"])
        now_rate = r["passed"] / max(1, r["cases"])
        if now_rate + 0.05 < prev_rate:
            regressions.append(f"{a}: pass-rate {prev_rate:.0%} → {now_rate:.0%}")

    if regressions:
        for reg in regressions:
            log.error("REGRESSION: %s", reg)
        return 3
    log.info("no regressions (checked %d agents)", len(by_agent))
    return 0


# ─── Entrypoint ────────────────────────────────────────────────────────────


def main() -> int:
    p = argparse.ArgumentParser(prog="evals")
    p.add_argument("agent", nargs="?", help="agent name (omit with --all)")
    p.add_argument("--all", action="store_true", help="run all agents under evals/cases/")
    p.add_argument("--baseline", action="store_true", help="write current run as baseline.json")
    p.add_argument("--check-baseline", action="store_true", help="diff current run against baseline.json")
    args = p.parse_args()

    if args.baseline:
        return cmd_baseline()
    if args.check_baseline:
        return cmd_check_baseline()
    if args.all:
        return cmd_run(None)
    if not args.agent:
        p.error("specify <agent>, --all, --baseline, or --check-baseline")
    return cmd_run(args.agent)


if __name__ == "__main__":
    sys.exit(main())
