"""comment_add — stub (real impl not committed in this snapshot)."""
from __future__ import annotations

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class CommentAddArgs(BaseModel):
    contract_id: str = Field(..., description="Contract to comment on.")
    body:        str = Field(..., description="Comment body.")


def build_comment_add(_org_id: str, _user_id: str | None = None) -> StructuredTool:
    async def _arun(contract_id: str, body: str) -> str:  # noqa: ARG001
        return '{"error":"comment_add_unavailable_in_this_build"}'

    def _run(contract_id: str, body: str) -> str:  # noqa: ARG001
        return '{"error":"comment_add_unavailable_in_this_build"}'

    return StructuredTool.from_function(
        coroutine=_arun,
        func=_run,
        name="comment_add",
        description="Add a comment to a contract (stub).",
        args_schema=CommentAddArgs,
    )
