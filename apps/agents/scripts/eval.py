"""
CLI wrapper for the eval harness (D.0.9).

Usage:
  python scripts/eval.py <agent-name>          # run all cases for an agent
  python scripts/eval.py <agent-name> --json   # machine-readable report

Exit codes:
  0 — all cases passed
  1 — one or more cases failed
  2 — no cases found (likely a mistyped agent name)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Make app.* + evals.* imports work when invoked from apps/agents/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from evals.runner import run_eval  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Run the eval harness for an agent.")
    ap.add_argument("agent", help="Agent name (must match evals/cases/<agent>/ directory)")
    ap.add_argument("--json", action="store_true", help="Emit JSON instead of human text")
    args = ap.parse_args()

    report = run_eval(args.agent)

    if args.json:
        json.dump(report.as_dict(), sys.stdout, indent=2)
        print()  # trailing newline
        return 0 if report.failed == 0 and report.cases > 0 else (2 if report.cases == 0 else 1)

    # Human report
    if report.cases == 0:
        print(f"(no cases found at {ROOT / 'evals' / 'cases' / args.agent})")
        print(f"Did you mean a different agent? Available: {sorted(os.listdir(ROOT / 'evals' / 'cases')) if (ROOT / 'evals' / 'cases').exists() else []}")
        return 2

    for r in report.results:
        mark = "✓" if r.passed else "✗"
        cost  = f"${r.cost_usd:.4f}"  if r.cost_usd else "$0"
        lat   = f"{r.latency_ms:.0f}ms"
        print(f"  {mark} {r.name:<40} score={r.score:.2f}  {cost:>8}  {lat:>7}")
        if not r.passed:
            print(f"      → {r.message}")

    print()
    print(f"Agent:   {report.agent}")
    print(f"Cases:   {report.cases} total  ·  {report.passed} passed  ·  {report.failed} failed")
    print(f"Cost:    ${report.total_cost_usd:.4f} total")
    print(f"Latency: {report.avg_latency_ms:.0f}ms average")
    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
