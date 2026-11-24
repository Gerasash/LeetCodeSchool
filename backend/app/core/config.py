"""Конфигурация приложения из .env через pydantic-settings."""

import warnings
from pathlib import Path

from pydantic.warnings import UnsupportedFieldAttributeWarning
from pydantic_settings import BaseSettings

# Подавляем ложные предупреждения Pydantic при генерации схем для FastAPI (camelCase алиасы)
warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    piston_url: str = "http://localhost:2000"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    database_url: str = "sqlite+aiosqlite:///./school_leetcode.db"

    model_config = {
        "env_file": ENV_FILE,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
