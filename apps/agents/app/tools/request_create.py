"""request_create — stub (real impl not committed in this snapshot)."""
from __future__ import annotations

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class RequestCreateArgs(BaseModel):
    title:       str = Field(..., description="Request title.")
    description: str = Field("", description="Request description.")


def build_request_create(_org_id: str, _user_id: str | None = None) -> StructuredTool:
    async def _arun(title: str, description: str = "") -> str:  # noqa: ARG001
        return '{"error":"request_create_unavailable_in_this_build"}'

    def _run(title: str, description: str = "") -> str:  # noqa: ARG001
        return '{"error":"request_create_unavailable_in_this_build"}'

    return StructuredTool.from_function(
        coroutine=_arun,
        func=_run,
        name="request_create",
        description="Create an intake request (stub).",
        args_schema=RequestCreateArgs,
    )
