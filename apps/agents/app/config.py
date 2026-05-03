from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    database_url: str = ""
    node_env: str = "development"
    internal_service_secret: str = ""
    api_url: str = "http://localhost:3001"

    # D.0.7 — Langfuse LLM tracing. Enable by setting all three. Missing any
    # of them silently disables tracing (resolve_llm still works, just no spans
    # are sent). Self-hosted instances set langfuse_host to their URL.
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    class Config:
        env_file = "../../.env"
        extra = "ignore"


settings = Settings()


def active_provider() -> str:
    """Return the first provider that has an API key configured."""
    if settings.openai_api_key:
        return "openai"
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.google_api_key:
        return "google"
    raise RuntimeError("No LLM API key found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in .env")


# P7.0.2 (F-82) — Map provider names to whether their API key is configured.
# Used by resolve_provider() to silently fall back to a configured provider
# when the caller asks for one that has no key (e.g. ChatMessageSchema's
# default 'anthropic' but only OPENAI_API_KEY is in env).
def is_provider_configured(provider: str) -> bool:
    if provider == "openai":    return bool(settings.openai_api_key)
    if provider == "anthropic": return bool(settings.anthropic_api_key)
    if provider == "google":    return bool(settings.google_api_key)
    return False


def resolve_provider(requested: str | None) -> str:
    """
    Pick the LLM provider to actually use for this turn.

    Behaviour:
      • If `requested` is configured → use it (caller's choice respected).
      • If `requested` is set but unconfigured → fall back to active_provider()
        and log a warning so the operator notices.
      • If `requested` is None/empty → use active_provider().

    This is the F-82 fix: when Node sends `provider='anthropic'` (the
    ChatMessageSchema default) but only OPENAI_API_KEY is set, we no
    longer hand the request to a provider with no auth. We swap silently
    rather than 500 the user, who has no way to know to override.
    """
    if requested and is_provider_configured(requested):
        return requested
    fallback = active_provider()  # raises if NO provider is configured
    if requested and requested != fallback:
        import logging
        logging.getLogger("config").warning(
            "[resolve_provider] requested='%s' has no API key; falling back to '%s'",
            requested, fallback,
        )
    return fallback


def model_for(provider: str, tier: str = "smart") -> str:
    """Return the default model id for a provider + tier (fast | smart)."""
    fast = {
        "openai":    "gpt-4o-mini",
        "anthropic": "claude-haiku-4-5-20251001",
        "google":    "gemini-1.5-flash",
    }
    smart = {
        "openai":    "gpt-4o",
        "anthropic": "claude-sonnet-4-6",
        "google":    "gemini-1.5-pro",
    }
    table = smart if tier == "smart" else fast
    return table.get(provider, smart["openai"])


def active_model() -> str:
    """Fast/cheap model — used for initial extraction."""
    p = active_provider()
    defaults = {
        "openai":     "gpt-4o-mini",
        "anthropic":  "claude-haiku-4-5-20251001",
        "google":     "gemini-1.5-flash",
    }
    return defaults[p]


def smart_model() -> str:
    """Best available model — used for validation, scoring, and reasoning steps."""
    p = active_provider()
    best = {
        "openai":     "gpt-4o",
        "anthropic":  "claude-sonnet-4-6",
        "google":     "gemini-1.5-pro",
    }
    return best[p]
