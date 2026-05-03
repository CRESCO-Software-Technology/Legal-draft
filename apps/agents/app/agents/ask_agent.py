"""
Ask Agent — Phase 2.1 (Contract Q&A RAG) + P7.7.2 native citations.

Takes a question + pre-retrieved clause matches (from pgvector) and
generates a grounded answer with inline citations.

P7.7.2 — when the active provider is Anthropic we now use the native
Citations API (`cite_documents=True`) which auto-emits structured
citation blocks pointing at the exact span used. We fall back to the
prompt-based [Clause N] format for non-Anthropic providers so the
caller's UX doesn't degrade when the platform key is OpenAI or Gemini.

Used by:
  POST /agent/ask          (portfolio-wide Q&A)
  POST /contracts/:id/ask  (single-contract Q&A, contractId scoped)
"""
from __future__ import annotations

import os
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from ..config import active_provider, active_model
from ..providers import build_llm

# ─── Prompt ───────────────────────────────────────────────────────────────────

_ASK_SYSTEM = """\
You are a precise legal contract analyst. Answer the user's question using ONLY
the contract clause excerpts provided. Do not invent information.

Rules:
- Answer directly and concisely
- For each statement, cite the clause using [Clause N] notation
- If multiple contracts are involved, specify which contract
- If the answer is not in the provided clauses, say "The provided clauses do not address this question."
- Never speculate beyond what the clauses say
- If a clause is ambiguous, say so

Format:
1. Direct answer (1-2 sentences)
2. Supporting detail with citations
3. Caveats or flags if relevant (e.g., "Note: this is subject to Section X which was not provided")
"""

# Anthropic-native variant — let the model rely on document blocks +
# the Citations API instead of in-prompt clause numbering.
_ASK_SYSTEM_ANTHROPIC = """\
You are a precise legal contract analyst. Answer the user's question using ONLY
the attached contract clause documents. Cite the exact span you relied on
using the citation tools. Do not invent information.

Format:
1. Direct answer (1-2 sentences) — cite at least one clause
2. Supporting detail with cited spans
3. Caveats if any clause is ambiguous or missing
"""


def _format_clauses(clause_matches: list[dict]) -> str:
    lines = []
    seen_contracts: dict[str, str] = {}

    for i, m in enumerate(clause_matches, 1):
        cid = m.get("contractId", "")
        if cid not in seen_contracts:
            seen_contracts[cid] = f"Contract {len(seen_contracts) + 1}"
        label = seen_contracts[cid]

        lines.append(
            f"[Clause {i}] ({label} — {m.get('clauseType', 'general')})\n"
            f"{m.get('content', '')}\n"
            f"Similarity: {m.get('similarity', 0):.2f}"
        )

    return "\n\n".join(lines)


# ─── Public interface ─────────────────────────────────────────────────────────

async def run_ask(
    question: str,
    clause_matches: list[dict],
    contract_id: str | None = None,
) -> dict[str, Any]:
    if not clause_matches:
        return {
            "answer": "No relevant clauses were found to answer this question.",
            "citations": [],
        }

    provider = active_provider()
    use_anthropic_citations = (
        provider == "anthropic"
        and os.getenv("ANTHROPIC_CITATIONS_ENABLED", "1") != "0"
    )

    if use_anthropic_citations:
        # P7.7.2 — native Citations API path. We talk to the SDK
        # directly because LangChain's wrapper doesn't yet expose the
        # citation-block deltas from Claude's response.
        return await _ask_anthropic_with_citations(question, clause_matches, contract_id)

    # Fallback: prompt-based [Clause N] citations via LangChain.
    llm = build_llm(provider=provider, model_id=active_model())

    context = _format_clauses(clause_matches)
    scope = f"Contract ID: {contract_id}" if contract_id else "Portfolio-wide query"

    try:
        resp = await llm.ainvoke([
            SystemMessage(content=_ASK_SYSTEM),
            HumanMessage(content=f"Scope: {scope}\n\nClauses:\n{context}\n\nQuestion: {question}"),
        ])
        answer = resp.content
    except Exception as e:
        answer = f"Could not generate answer: {e}"

    citations = [
        {
            "index":      i + 1,
            "contractId": m.get("contractId"),
            "clauseId":   m.get("clauseId"),
            "clauseType": m.get("clauseType"),
            "similarity": m.get("similarity"),
            # Pass through bbox + section_ref when present so the front-
            # end can scroll-to-clause / highlight the PDF.
            "sectionRef": m.get("sectionRef"),
            "bbox":       m.get("bbox"),
            "page":       m.get("page"),
            "verbatim":   None,  # prompt mode: we don't isolate the cited span
        }
        for i, m in enumerate(clause_matches)
    ]

    return {"answer": answer, "citations": citations, "mode": "prompt"}


async def _ask_anthropic_with_citations(
    question: str,
    clause_matches: list[dict],
    contract_id: str | None,
) -> dict[str, Any]:
    """
    Native Citations API path. Each clause is wrapped as a `document`
    content block with `citations: { enabled: true }`. Claude returns
    structured citation deltas tagging the exact span it relied on.
    We map those spans back to clauseIds for the frontend.

    Reference: https://docs.anthropic.com/en/docs/build-with-claude/citations
    """
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        # SDK unavailable — fall back to the prompt path so callers
        # still get an answer.
        return {
            "answer": "(Citations API requires the anthropic SDK; falling back to prompt mode.)",
            "citations": [],
            "mode": "fallback",
        }

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"answer": "ANTHROPIC_API_KEY not set", "citations": [], "mode": "error"}

    client = AsyncAnthropic(api_key=api_key)
    model = active_model() or "claude-sonnet-4-5-20250929"

    # Build document blocks. We use plain-text type since clauses are
    # already extracted plain English — no PDF round-trip needed.
    document_blocks: list[dict] = []
    for i, m in enumerate(clause_matches):
        cid = m.get("contractId") or "?"
        ctype = m.get("clauseType") or "general"
        document_blocks.append({
            "type": "document",
            "source": {
                "type": "text",
                "media_type": "text/plain",
                "data": m.get("content", ""),
            },
            "title": f"{ctype.replace('_', ' ').title()} (contract {cid[-8:]})",
            "context": f"Clause type: {ctype}; section ref: {m.get('sectionRef') or '—'}",
            "citations": {"enabled": True},
        })

    user_blocks: list[dict] = [
        *document_blocks,
        {"type": "text", "text": f"Question: {question}"},
    ]

    try:
        resp = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=_ASK_SYSTEM_ANTHROPIC,
            messages=[{"role": "user", "content": user_blocks}],
        )
    except Exception as e:
        return {"answer": f"Citations API call failed: {e}", "citations": [], "mode": "error"}

    # Walk the response — every text block can carry a `citations` array.
    answer_parts: list[str] = []
    citations_out: list[dict] = []

    for block in resp.content:
        if getattr(block, "type", None) != "text":
            continue
        text = getattr(block, "text", "") or ""
        answer_parts.append(text)
        for cit in (getattr(block, "citations", None) or []):
            # cit is a dict with type + document_index + cited_text
            ci = cit if isinstance(cit, dict) else cit.model_dump()
            doc_idx = ci.get("document_index")
            if doc_idx is None or doc_idx >= len(clause_matches):
                continue
            m = clause_matches[doc_idx]
            citations_out.append({
                "index":      len(citations_out) + 1,
                "contractId": m.get("contractId"),
                "clauseId":   m.get("clauseId"),
                "clauseType": m.get("clauseType"),
                "similarity": m.get("similarity"),
                "sectionRef": m.get("sectionRef"),
                "bbox":       m.get("bbox"),
                "page":       m.get("page"),
                "verbatim":   ci.get("cited_text"),
                "spanStart":  ci.get("start_char_index"),
                "spanEnd":    ci.get("end_char_index"),
            })

    return {
        "answer": "".join(answer_parts).strip() or "(no answer)",
        "citations": citations_out,
        "mode": "anthropic_native",
    }
