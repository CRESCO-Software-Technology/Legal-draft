"""
Eval harness (D.0.9) — scaffold.

The goal: every prompt / model / retrieval change can be scored against a
golden case set BEFORE merge, so we know whether it's a regression.

Shape (landing incrementally):
  evals/
    cases/<agent>/<case>.yaml       # Golden I/O expectations
    graders/                        # Pluggable scorers
    runner.py                       # Loads cases, invokes agent, scores,
                                    # emits a JSON report comparable to
                                    # earlier runs for diff
    baselines/<agent>.json          # Last-known-good report per agent

Why not LangSmith/Braintrust/Evals from day one:
  - We want evals to run locally without any external service so PR CI can
    gate on them. Third-party UIs are valuable; tight-loop feedback is
    more valuable right now.
  - We need to parameterise over our OWN router (BYOK, cost-cap-aware)
    which third-party harnesses don't know about.

D0 scaffold delivers:
  - YAML case schema (name, agent, input, expected, metadata)
  - Two grader primitives: exact_match, contains
  - A runner that returns a structured Report for one agent
  - A CLI wrapper: `python scripts/eval.py <agent-name>`
  - A single demo case that exercises a string-in-string-out agent so the
    harness wiring is live and smokeable — D1 fills in the real cases.

Anything beyond that (model-graded rubrics, matrix across providers,
baseline diff, HTML report) is intentionally NOT in D0. Add as needed.
"""
