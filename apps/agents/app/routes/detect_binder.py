"""
POST /detect-binder — called by agent.worker.ts after parse-document completes.
Determines if a PDF contains multiple distinct agreements (a "binder").

Uses Haiku for speed/cost — only needs first 10K chars to identify agreement headers.
Returns: { isBinder, confidence, documents: [{title, docType, charStart, pageHint}] }
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import active_model, active_provider, settings
from ..jsonish import loads_lenient

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_CHARS = 10_000

_PROMPT = """\
You are a legal document classifier. Analyze the following text (beginning of a document) and determine whether it is:
  (A) A SINGLE legal agreement, or
  (B) A BINDER — a single PDF file containing MULTIPLE distinct legal agreements

Common binder types: closing packs (NDA + MSA + SOW + DPA), M&A diligence binders, template bundles.

Evidence of a binder: multiple "IN WITNESS WHEREOF" / signature blocks, multiple agreement title headers (e.g. "NON-DISCLOSURE AGREEMENT" followed later by "MASTER SERVICES AGREEMENT"), section numbering that resets to 1.

Return ONLY valid JSON in this exact structure:
{
  "isBinder": true | false,
  "confidence": 0.0 to 1.0,
  "documents": [
    {
      "title": "detected title of this agreement",
      "docType": "NDA | MSA | SOW | SLA | DPA | EMPLOYMENT | ORDER_FORM | LICENSE | PARTNERSHIP | OTHER",
      "charStart": approximate character offset where this agreement begins (integer),
      "pageHint": "~page N"
    }
  ]
}

Rules:
- If isBinder is false, documents should contain exactly ONE entry describing the single agreement.
- If isBinder is true, documents should list each detected agreement in order.
- confidence should reflect how certain you are. Use > 0.7 only when you have strong evidence.
- charStart for the first document should be 0 (or close to it).
- Do NOT include any explanation outside the JSON object.

Document text:
"""


class DetectBinderRequest(BaseModel):
    plainText: str


class DetectedDocument(BaseModel):
    title:     str
    docType:   str
    charStart: int
    pageHint:  str


class DetectBinderResponse(BaseModel):
    isBinder:   bool
    confidence: float
    documents:  List[DetectedDocument]


@router.post("/detect-binder", response_model=DetectBinderResponse)
async def detect_binder(req: DetectBinderRequest) -> DetectBinderResponse:
    text_sample = req.plainText[:MAX_CHARS]
    logger.info("[detect-binder] chars_sampled=%d", len(text_sample))

    provider = active_provider()
    model    = active_model()

    try:
        raw = await _call_llm(provider, model, text_sample)
        parsed = loads_lenient(raw)
        docs_raw = parsed.get("documents")
        if not isinstance(docs_raw, list):  # LLM drift: object/str instead of array
            docs_raw = []
        documents = [DetectedDocument(**d) for d in docs_raw if isinstance(d, dict)]
        result = DetectBinderResponse(
            isBinder=bool(parsed.get("isBinder", False)),
            confidence=float(parsed.get("confidence", 0.0)),
            documents=documents,
        )
        logger.info("[detect-binder] isBinder=%s confidence=%.2f docs=%d",
                    result.isBinder, result.confidence, len(result.documents))
        return result
    except Exception as exc:
        logger.error("[detect-binder] LLM call or parse failed: %s", exc)
        # Fallback: single doc, not a binder
        return DetectBinderResponse(isBinder=False, confidence=0.0, documents=[])


async def _call_llm(provider: str, model: str, text: str) -> str:
    prompt = _PROMPT + text

    if provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        msg = await client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text

    elif provider == "openai":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=model,
            max_tokens=1024,
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
