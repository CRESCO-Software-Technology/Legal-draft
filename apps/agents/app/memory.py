import json
import redis.asyncio as aioredis
from app.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


SESSION_TTL = 60 * 60 * 24  # 24 hours


async def get_session_history(session_id: str) -> list[dict]:
    r = await get_redis()
    raw = await r.get(f"session:{session_id}")
    if raw:
        return json.loads(raw)
    return []


async def append_to_session(session_id: str, role: str, content: str, *, tool_calls: list | None = None, tool_results: list | None = None) -> None:
    """Persist a turn to the session log.

    P64 audit (2026-05-02). The agent's tool calls + their results
    used to be discarded between turns — only the prose `content`
    survived. That meant T1 might fetch contract X (id=cm…), and T2
    "tell me about it" had no way to know X's id, so the LLM either
    re-searched (often picking a different contract) or hallucinated
    a placeholder cuid like 'cm7hjd…'.

    Now we also preserve:
      tool_calls   — list of {id, name, args} the assistant requested
      tool_results — list of {id, name, result_json_truncated}

    The next turn's restore loop in orchestrator rebuilds these as
    AIMessage(tool_calls=…) + ToolMessage(...) so the LLM sees the
    real tool history (and the real ids) just like within a turn.
    """
    r = await get_redis()
    history = await get_session_history(session_id)
    entry: dict = {"role": role, "content": content}
    if tool_calls:
        entry["tool_calls"] = tool_calls
    if tool_results:
        entry["tool_results"] = tool_results
    history.append(entry)
    # Keep last 50 messages
    if len(history) > 50:
        history = history[-50:]
    await r.setex(f"session:{session_id}", SESSION_TTL, json.dumps(history))
