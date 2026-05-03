"""
Grader primitives. A grader takes (expected, actual) and returns a GraderResult
with a pass/fail verdict + optional diagnostic message.

D0 ships two primitives — exact_match and contains. Future graders to add:
  - regex
  - json_subset      (recursively assert actual >= expected by key)
  - model_graded     (LLM-as-judge with a rubric)
  - tool_call_check  (asserts a specific tool was called with matching args)

All graders accept both scalar and dict inputs uniformly so the YAML case
schema doesn't need per-field magic.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class GraderResult:
    passed: bool
    message: str = ""
    # Free-form scalar score — 1.0/0.0 today, fractional when we add model-graded.
    score: float = 0.0


def exact_match(expected: Any, actual: Any) -> GraderResult:
    """Strict == comparison. Handles scalars, lists, and dicts."""
    ok = expected == actual
    return GraderResult(
        passed=ok,
        score=1.0 if ok else 0.0,
        message="" if ok else f"expected={expected!r} != actual={actual!r}",
    )


def contains(substring: str, actual: Any) -> GraderResult:
    """
    True iff `substring` appears in `actual`.
    - For strings: case-insensitive substring search.
    - For lists of dicts: any item with .type or .kind matching substring.
    - For lists of strings: any element matching substring (case-insensitive).
    Used by P7.5.5 obligation eval cases where actual is a list.
    """
    if isinstance(actual, str):
        ok = substring.lower() in actual.lower()
        return GraderResult(
            passed=ok,
            score=1.0 if ok else 0.0,
            message="" if ok else f"expected substring {substring!r} not in actual (len={len(actual)})",
        )
    if isinstance(actual, list):
        sub_l = str(substring).lower()
        for item in actual:
            if isinstance(item, str) and sub_l in item.lower():
                return GraderResult(passed=True, score=1.0)
            if isinstance(item, dict):
                # Check common type-fields obligations use
                for k in ("type", "kind", "category"):
                    v = item.get(k)
                    if isinstance(v, str) and sub_l == v.lower():
                        return GraderResult(passed=True, score=1.0)
        return GraderResult(
            passed=False, score=0.0,
            message=f"expected element matching {substring!r} in list of {len(actual)} items",
        )
    return GraderResult(
        passed=False, score=0.0,
        message=f"unsupported actual type {type(actual).__name__} for 'contains'",
    )


GRADERS = {
    "exact_match": exact_match,
    "contains":    contains,
}
