"""portfolio_compare — stub (real impl not committed in this snapshot)."""
from __future__ import annotations

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class PortfolioCompareArgs(BaseModel):
    query: str = Field(..., description="Comparison query across the portfolio.")


def build_portfolio_compare(_org_id: str) -> StructuredTool:
    async def _arun(query: str) -> str:  # noqa: ARG001
        return '{"error":"portfolio_compare_unavailable_in_this_build"}'

    def _run(query: str) -> str:  # noqa: ARG001
        return '{"error":"portfolio_compare_unavailable_in_this_build"}'

    return StructuredTool.from_function(
        coroutine=_arun,
        func=_run,
        name="portfolio_compare",
        description="Compare clauses across multiple contracts in the portfolio (stub).",
        args_schema=PortfolioCompareArgs,
    )
