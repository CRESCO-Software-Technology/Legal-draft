"""contract_update — stub (real impl not committed in this snapshot)."""
from __future__ import annotations

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class ContractUpdateArgs(BaseModel):
    contract_id: str = Field(..., description="Contract to update.")
    patch:       dict = Field(default_factory=dict, description="Field patch.")


def build_contract_update(_org_id: str) -> StructuredTool:
    async def _arun(contract_id: str, patch: dict | None = None) -> str:  # noqa: ARG001
        return '{"error":"contract_update_unavailable_in_this_build"}'

    def _run(contract_id: str, patch: dict | None = None) -> str:  # noqa: ARG001
        return '{"error":"contract_update_unavailable_in_this_build"}'

    return StructuredTool.from_function(
        coroutine=_arun,
        func=_run,
        name="contract_update",
        description="Update a contract's fields (stub).",
        args_schema=ContractUpdateArgs,
    )
