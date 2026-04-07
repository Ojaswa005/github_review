import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    groq_fallback_models_raw: str = os.getenv(
        "GROQ_FALLBACK_MODELS", "mixtral-8x7b-32768"
    )
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    data_dir: Path = Path(os.getenv("DATA_DIR", "./data")).resolve()
    github_api_base: str = "https://api.github.com"


settings = Settings()


def get_groq_model_candidates() -> list[str]:
    candidates: list[str] = []
    if settings.groq_model.strip():
        candidates.append(settings.groq_model.strip())
    for item in settings.groq_fallback_models_raw.split(","):
        model = item.strip()
        if model and model not in candidates:
            candidates.append(model)

    # Safety net for stale .env values (decommissioned models).
    safe_defaults = [
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    ]
    for model in safe_defaults:
        if model not in candidates:
            candidates.append(model)
    return candidates
