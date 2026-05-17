"""counterparty_list — stub (real impl not committed in this snapshot)."""
from __future__ import annotations

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class CounterpartyListArgs(BaseModel):
    query: str | None = Field(None, description="Optional name filter.")
    limit: int = Field(20, ge=1, le=100)


def build_counterparty_list(_org_id: str) -> StructuredTool:
    async def _arun(query: str | None = None, limit: int = 20) -> str:  # noqa: ARG001
        return '{"counterparties": [], "total": 0}'

    def _run(query: str | None = None, limit: int = 20) -> str:  # noqa: ARG001
        return '{"counterparties": [], "total": 0}'

    return StructuredTool.from_function(
        coroutine=_arun,
        func=_run,
        name="counterparty_list",
        description="List counterparties for the org (stub).",
        args_schema=CounterpartyListArgs,
    )
