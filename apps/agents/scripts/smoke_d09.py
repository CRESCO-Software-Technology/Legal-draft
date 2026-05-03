"""
D.0.9 smoke — meta-test that the eval harness itself works.

Doesn't assert anything about a specific agent's quality (that's the job of
the cases we load). It asserts that:

  (A) The runner can discover YAML cases on disk
  (B) GRADERS dispatch correctly (exact_match passes, fails as expected;
      contains passes for substring hit, fails for miss)
  (C) run_eval() returns a Report with the documented shape
  (D) The CLI wrapper (scripts/eval.py) exits 0 on all-pass, 1 on failure,
      2 when the agent directory doesn't exist
  (E) A custom AgentRunner that injects a failure produces a failed case
      with a helpful message (runner-raised branch)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

# Make evals.* imports work when running from apps/agents/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from evals.runner import run_eval, load_cases, BUILTIN_RUNNERS, Report  # noqa: E402
from evals.graders import exact_match, contains  # noqa: E402

fail = 0


def check(cond: bool, msg: str) -> None:
    global fail
    print(f"  {'✓' if cond else '✗'} {msg}")
    if not cond:
        fail += 1


def main() -> None:
    # ── (A) Case discovery ────────────────────────────────────────────────
    cases = load_cases("echo")
    check(len(cases) >= 1, f"(A) load_cases('echo') found at least 1 case (got {len(cases)})")
    if cases:
        first = cases[0]
        check("name" in first, "(A) loaded case has a 'name' field")
        check("expected" in first and isinstance(first["expected"], list),
              "(A) loaded case has 'expected' as a list of checks")

    # ── (B) Graders dispatch ──────────────────────────────────────────────
    r = exact_match("hi", "hi")
    check(r.passed is True and r.score == 1.0, "(B) exact_match passes on equal scalars")
    r = exact_match("hi", "bye")
    check(r.passed is False and "!=" in r.message, "(B) exact_match fails on unequal scalars with diagnostic message")
    r = contains("world", "hello world")
    check(r.passed is True, "(B) contains passes on substring hit")
    r = contains("goodbye", "hello world")
    check(r.passed is False, "(B) contains fails on substring miss")
    r = contains("x", 42)  # wrong type — should fail gracefully, not raise
    check(r.passed is False and "not a string" in r.message, "(B) contains handles non-string actual without raising")

    # ── (C) run_eval returns a structured Report ─────────────────────────
    report = run_eval("echo")
    check(isinstance(report, Report), "(C) run_eval returns a Report")
    check(report.agent == "echo", f"(C) Report.agent is 'echo' (got {report.agent!r})")
    check(report.cases >= 1, f"(C) Report.cases >= 1 (got {report.cases})")
    check(report.passed == report.cases and report.failed == 0,
          f"(C) All built-in demo cases pass (passed={report.passed}, failed={report.failed})")
    d = report.as_dict()
    for k in ("agent", "cases", "passed", "failed", "total_cost_usd", "avg_latency_ms", "results"):
        check(k in d, f"(C) Report.as_dict() has '{k}' field")
    check(isinstance(d["results"], list) and "checks" in d["results"][0],
          "(C) Report.as_dict() results carry nested 'checks' arrays")

    # ── (D) CLI exit codes ───────────────────────────────────────────────
    # D.1 all-pass → exit 0
    p = subprocess.run([sys.executable, str(Path(__file__).parent / "eval.py"), "echo", "--json"],
                       capture_output=True, text=True)
    check(p.returncode == 0, f"(D) CLI exits 0 on all-pass (got {p.returncode}, stderr={p.stderr[:200]!r})")
    try:
        payload = json.loads(p.stdout)
        check("results" in payload, "(D) CLI --json output is parseable and has results[]")
    except json.JSONDecodeError:
        check(False, f"(D) CLI --json output is valid JSON (got {p.stdout[:200]!r})")

    # D.2 agent dir missing → exit 2
    p = subprocess.run([sys.executable, str(Path(__file__).parent / "eval.py"), "no_such_agent_0xDEAD"],
                       capture_output=True, text=True)
    check(p.returncode == 2, f"(D) CLI exits 2 when agent dir missing (got {p.returncode})")

    # D.3 failing case → exit 1. Build a throwaway cases dir with a case
    # whose grader will never pass against the echo runner.
    with tempfile.TemporaryDirectory() as tmp:
        cases_root = Path(tmp)
        agent_dir = cases_root / "echo"
        agent_dir.mkdir()
        (agent_dir / "will-fail.yaml").write_text(textwrap.dedent("""
            name: "will fail"
            input: { text: "abc" }
            expected:
              - grader: exact_match
                field: text
                value: "XYZ"
        """).strip())
        rep = run_eval("echo", runner=BUILTIN_RUNNERS["echo"], cases_dir=cases_root)
        check(rep.failed == 1 and rep.passed == 0,
              f"(D) expected failure on mismatched exact_match (passed={rep.passed}, failed={rep.failed})")
        failing = next((r for r in rep.results if not r.passed), None)
        check(failing is not None and "exact_match" in (failing.message or ""),
              "(D) failing case's message names the grader that fired")

    # ── (E) Runner-raised exception is captured, not fatal ───────────────
    def broken_runner(_inp):
        raise RuntimeError("boom")
    with tempfile.TemporaryDirectory() as tmp:
        cases_root = Path(tmp)
        agent_dir = cases_root / "brokenagent"
        agent_dir.mkdir()
        (agent_dir / "any.yaml").write_text('name: "any"\ninput: {}\nexpected: []')
        rep = run_eval("brokenagent", runner=broken_runner, cases_dir=cases_root)
        check(rep.failed == 1, "(E) runner raising an exception produces a failed case")
        check("boom" in (rep.results[0].message or ""), "(E) failed case carries the original exception message")

    print()
    if fail:
        print(f"✗ {fail} check(s) failed")
        sys.exit(1)
    print("✓ All D.0.9 eval-harness checks pass")


if __name__ == "__main__":
    main()
