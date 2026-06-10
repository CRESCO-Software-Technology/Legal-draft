"""
POST /classify — called by agent.worker.ts after detect-binder determines no split is needed.
Identifies the contract type from the first 5K chars (fast, cheap, Haiku).

Returns: { contractType, confidence, reason }
"""
from __future__ import annotations

import json
import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import active_model, active_provider, settings
from ..jsonish import loads_lenient

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_CHARS = 5_000

VALID_TYPES = {
    "NDA", "MSA", "SOW", "SLA", "VENDOR_AGREEMENT", "EMPLOYMENT",
    "PARTNERSHIP", "LICENSE", "DATA_PROCESSING", "ORDER_FORM", "OTHER",
}

_PROMPT = """\
You are a legal contract classifier. Read the beginning of the following legal document and identify its primary contract type.

Return ONLY valid JSON in this exact structure:
{
  "contractType": "one of the types listed below",
  "confidence": 0.0 to 1.0,
  "reason": "one sentence explaining the key signal that determined the type"
}

Valid contract types:
- NDA: Non-Disclosure / Confidentiality Agreement
- MSA: Master Services Agreement / Master Subscription Agreement
- SOW: Statement of Work / Independent Contractor Agreement
- SLA: Service Level Agreement
- VENDOR_AGREEMENT: Vendor / Supplier Agreement (generic procurement)
- EMPLOYMENT: Employment Agreement / Offer Letter
- PARTNERSHIP: Partnership Agreement / Joint Venture Agreement
- LICENSE: Software or IP License Agreement
- DATA_PROCESSING: Data Processing Addendum / Data Protection Agreement
- ORDER_FORM: Order Form / Purchase Order
- OTHER: Does not match any of the above

Rules:
- Use the most specific matching type. If it could be MSA or VENDOR_AGREEMENT, prefer MSA if it governs ongoing services.
- confidence > 0.8 means the title or opening paragraph makes the type unambiguous.
- confidence 0.5–0.8 means you inferred from content, not explicit title.
- Do NOT include any explanation outside the JSON object.

Document text:
"""


class ClassifyRequest(BaseModel):
    plainText: str


class ClassifyResponse(BaseModel):
    contractType: str
    confidence:   float
    reason:       str


@router.post("/classify", response_model=ClassifyResponse)
async def classify_document(req: ClassifyRequest) -> ClassifyResponse:
    text_sample = req.plainText[:MAX_CHARS]
    logger.info("[classify] chars_sampled=%d", len(text_sample))

    provider = active_provider()
    model    = active_model()

    try:
        raw    = await _call_llm(provider, model, text_sample)
        parsed = loads_lenient(raw)
        ctype  = parsed.get("contractType", "OTHER")
        if ctype not in VALID_TYPES:
            ctype = "OTHER"
        result = ClassifyResponse(
            contractType=ctype,
            confidence=float(parsed.get("confidence", 0.5)),
            reason=str(parsed.get("reason", "")),
        )
        logger.info("[classify] contractType=%s confidence=%.2f", result.contractType, result.confidence)
        return result
    except Exception as exc:
        logger.error("[classify] LLM call or parse failed: %s", exc)
        return ClassifyResponse(contractType="OTHER", confidence=0.0, reason="classification failed")


async def _call_llm(provider: str, model: str, text: str) -> str:
    prompt = _PROMPT + text

    if provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        msg = await client.messages.create(
            model=model,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text

    elif provider == "openai":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=model,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or "{}"

    elif provider == "google":
        # langchain_google_genai is the Gemini client the orchestrator
        # already depends on — the legacy google.generativeai SDK was
        # never in the venv, so this branch crashed with ImportError
        # whenever resolve_provider fell back to google (found in the
        # 2026-06-10 full-app review: intake/classify/detect-binder all
        # silently returned their fallback payloads).
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.google_api_key,
            max_output_tokens=4096,  # bounded, but generous: Gemini 2.5 counts
            # internal "thinking" tokens against this limit — a tight cap
            # (256-1024, parity with the other branches) starves the
            # actual answer and truncates the JSON mid-object.
        )
        resp = await llm.ainvoke(prompt)
        content = resp.content
        if isinstance(content, list):
            # LangChain can return content as a list of blocks — extract
            # text parts instead of str()-ing the Python repr.
            content = "".join(
                p.get("text", "") if isinstance(p, dict) else str(p)
                for p in content
            )
        return content

    raise ValueError(f"Unknown provider: {provider}")
