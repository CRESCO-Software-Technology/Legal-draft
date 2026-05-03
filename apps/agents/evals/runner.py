"""
Eval runner (D.0.9 scaffold).

Loads golden cases for an agent, invokes the agent (via a pluggable Runner
protocol), grades the response, and emits a structured Report.

Report shape (stable — later waves diff against it):
  {
    "agent":     "demo-echo",
    "cases":     12,
    "passed":    11,
    "failed":    1,
    "total_cost_usd": 0.0042,
    "avg_latency_ms": 234,
    "results": [
      { "name": "...", "passed": true, "score": 1.0, "cost_usd": 0.0003,
        "latency_ms": 180, "message": "", "checks": [...] },
      ...
    ],
  }

Case YAML schema:
  name: "Simple echo"
  input:
    text: "Hello"
  expected:
    - grader: exact_match
      field: text
      value: "Hello"
  metadata:
    priority: low

A Runner is any callable that takes the `input` dict and returns a result
dict (shape matches what the agent produces — we grade over its keys).
The runner also returns optional cost_usd + latency_ms used for aggregation.

For D0 we ship ONE runner — `echo_runner` — which returns its input as-is.
It's trivial on purpose: the harness wiring is what matters here, not a
real agent call. D1 will plug in the agent-service HTTP endpoint.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Protocol

import yaml

from .graders import GRADERS, GraderResult


# ─── Types ─────────────────────────────────────────────────────────────────


class AgentRunner(Protocol):
    """An agent runner: input dict → (result dict, cost, latency_ms)."""
    def __call__(self, inp: dict) -> tuple[dict, float, float]: ...


@dataclass
class CheckResult:
    grader: str
    field: str | None
    passed: bool
    score: float
    message: str


@dataclass
class CaseResult:
    name: str
    passed: bool
    score: float
    cost_usd: float
    latency_ms: float
    message: str = ""
    checks: list[CheckResult] = field(default_factory=list)


@dataclass
class Report:
    agent: str
    cases: int
    passed: int
    failed: int
    total_cost_usd: float
    avg_latency_ms: float
    results: list[CaseResult]

    def as_dict(self) -> dict:
        return {
            "agent":           self.agent,
            "cases":           self.cases,
            "passed":          self.passed,
            "failed":          self.failed,
            "total_cost_usd":  round(self.total_cost_usd, 6),
            "avg_latency_ms":  round(self.avg_latency_ms, 1),
            "results":         [asdict(r) for r in self.results],
        }


# ─── Built-in runners ──────────────────────────────────────────────────────


def echo_runner(inp: dict) -> tuple[dict, float, float]:
    """Trivial runner: returns the input as the output. Zero cost, ~0 latency.

    Exists only so the D0 scaffold can exercise the harness end-to-end without
    making a real LLM call. Real agent runners land in D1+.
    """
    t0 = time.monotonic()
    result = dict(inp)
    return result, 0.0, (time.monotonic() - t0) * 1000


def synthetic_obligations_runner(inp: dict) -> tuple[dict, float, float]:
    """Heuristic runner used by the obligations cases when EVAL_USE_HTTP=0.

    Pattern-matches the input text for common obligation cues and emits a
    list shaped like the real extractor's output. Lets the harness +
    grader scaffolding be exercised in CI without burning API tokens.
    The real LLM-backed runner lives in evals/cli.py.
    """
    t0 = time.monotonic()
    text = (inp.get("text") or "").lower()
    obligations: list[dict] = []
    if "pay" in text or "fee" in text or "invoice" in text:
        obligations.append({"type": "payment", "description": "(synthetic)"})
    if "uptime" in text or "service level" in text or "sla" in text:
        obligations.append({"type": "sla", "description": "(synthetic)"})
    if "renewal" in text or "auto-renew" in text:
        obligations.append({"type": "renewal", "description": "(synthetic)"})
    if "report" in text:
        obligations.append({"type": "report", "description": "(synthetic)"})
    if "audit" in text:
        obligations.append({"type": "audit", "description": "(synthetic)"})
    if "termination" in text:
        obligations.append({"type": "termination", "description": "(synthetic)"})
    return {"obligations": obligations}, 0.0, (time.monotonic() - t0) * 1000


BUILTIN_RUNNERS: dict[str, AgentRunner] = {
    "echo": echo_runner,
    "obligations": synthetic_obligations_runner,
}


# ─── Case loading ──────────────────────────────────────────────────────────


def load_cases(agent: str, cases_dir: Path | None = None) -> list[dict]:
    """Load every *.yaml file under evals/cases/<agent>/ as a case dict.

    Returns an empty list when the directory is missing — callers can decide
    to fail loudly or skip silently.
    """
    base = cases_dir or (Path(__file__).parent / "cases")
    dir_ = base / agent
    if not dir_.exists():
        return []
    cases: list[dict] = []
    for yml in sorted(dir_.glob("*.yaml")):
        with yml.open() as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError(f"{yml}: top-level YAML must be a mapping")
        data.setdefault("name", yml.stem)
        cases.append(data)
    return cases


# ─── Grading ───────────────────────────────────────────────────────────────


def _extract_field(result: dict, field_path: str | None) -> Any:
    """Walk dotted path into the result dict. None = use whole dict."""
    if field_path is None:
        return result
    value: Any = result
    for part in field_path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _grade_case(case: dict, result: dict) -> tuple[bool, float, list[CheckResult], str]:
    """Apply every check in case['expected']. All must pass for the case to pass.

    Returns (passed, aggregate_score, checks, message).
    """
    checks: list[CheckResult] = []
    expectations = case.get("expected", []) or []
    if not isinstance(expectations, list):
        raise ValueError(f"case {case.get('name')!r}: 'expected' must be a list of checks")

    for spec in expectations:
        grader_name = spec.get("grader")
        if grader_name not in GRADERS:
            raise ValueError(f"case {case.get('name')!r}: unknown grader {grader_name!r}. Known: {list(GRADERS)}")
        field_path = spec.get("field")
        actual = _extract_field(result, field_path)

        # Dispatch on grader signature. exact_match takes (expected, actual);
        # contains takes (substring, actual).
        if grader_name == "exact_match":
            r: GraderResult = GRADERS[grader_name](spec.get("value"), actual)
        elif grader_name == "contains":
            r = GRADERS[grader_name](spec.get("value"), actual)
        else:
            raise AssertionError(f"unhandled grader {grader_name!r}")

        checks.append(CheckResult(
            grader=grader_name,
            field=field_path,
            passed=r.passed,
            score=r.score,
            message=r.message,
        ))

    if not checks:
        # A case with no expectations always passes; arguably always fails.
        # Treat as passing but add a warning — someone forgot to write
        # assertions and the harness shouldn't silently hide that.
        return True, 0.0, [], "WARNING: case has no expectations"

    all_passed = all(c.passed for c in checks)
    avg = sum(c.score for c in checks) / len(checks)
    failed_msgs = [f"{c.grader}({c.field})" for c in checks if not c.passed]
    msg = "" if all_passed else "failed: " + ", ".join(failed_msgs)
    return all_passed, avg, checks, msg


# ─── Public runner ─────────────────────────────────────────────────────────


def run_eval(
    agent: str,
    runner: AgentRunner | None = None,
    cases_dir: Path | None = None,
) -> Report:
    """Run every case for `agent`, grade, and return a structured Report.

    Returns an empty Report (cases=0) when no cases are on disk — callers can
    distinguish "nothing to run" (exit 2 in the CLI) from "ran and failed"
    (exit 1). We deliberately check cases BEFORE looking up a runner: a
    typo'd agent name that has neither a cases dir nor a built-in runner
    should surface as "no cases," not as a ValueError traceback.
    """
    cases = load_cases(agent, cases_dir=cases_dir)
    if not cases:
        return Report(agent=agent, cases=0, passed=0, failed=0, total_cost_usd=0.0, avg_latency_ms=0.0, results=[])

    if runner is None:
        runner = BUILTIN_RUNNERS.get(agent)
        if runner is None:
            raise ValueError(
                f"No runner supplied for agent={agent!r} and no built-in runner found. "
                f"Built-ins: {list(BUILTIN_RUNNERS)}. Pass `runner=callable` explicitly."
            )

    results: list[CaseResult] = []
    for case in cases:
        try:
            result, cost, latency = runner(case.get("input", {}) or {})
        except Exception as e:
            results.append(CaseResult(
                name=case.get("name", "(anonymous)"),
                passed=False, score=0.0, cost_usd=0.0, latency_ms=0.0,
                message=f"runner raised: {type(e).__name__}: {e}",
                checks=[],
            ))
            continue

        passed, score, checks, msg = _grade_case(case, result)
        results.append(CaseResult(
            name=case.get("name", "(anonymous)"),
            passed=passed, score=score,
            cost_usd=cost, latency_ms=latency,
            message=msg, checks=checks,
        ))

    n = len(results)
    passed = sum(1 for r in results if r.passed)
    total_cost = sum(r.cost_usd for r in results)
    avg_latency = sum(r.latency_ms for r in results) / n if n else 0.0
    return Report(
        agent=agent, cases=n, passed=passed, failed=n - passed,
        total_cost_usd=total_cost, avg_latency_ms=avg_latency,
        results=results,
    )
