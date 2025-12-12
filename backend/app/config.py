from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# 项目根目录 (backend 的上级目录)
ROOT_DIR = Path(__file__).parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    # LLM Configuration
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model_name: str = "gpt-4o-mini"

    # Crawl4AI Configuration
    crawl4ai_url: str = "http://localhost:11235"

    # PocketBase Configuration
    pocketbase_url: str = "http://localhost:8090"
    pocketbase_admin_email: str = ""
    pocketbase_admin_password: str = ""

    # App Configuration
    debug: bool = False

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
