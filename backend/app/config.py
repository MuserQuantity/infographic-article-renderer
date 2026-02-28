from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = MODULE_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent
ENV_CANDIDATES = [
    PROJECT_DIR / ".env",
    BACKEND_DIR / ".env",
]
ENV_FILE = next((path for path in ENV_CANDIDATES if path.exists()), ENV_CANDIDATES[0])


class Settings(BaseSettings):
    # LLM Configuration
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model_name: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 0.0
    llm_max_retries: int = 9
    llm_retry_base_delay: float = 1.0
    llm_retry_max_delay: float = 8.0
    llm_use_response_format: bool = True
    llm_max_continuations: int = 5
    llm_chunk_size: int = 30000  # 超过此字符数的输入内容将分块处理

    # Crawl4AI Configuration
    crawl4ai_url: str = "http://localhost:11235"

    # PocketBase Configuration
    pocketbase_url: str = "http://localhost:8090"
    pocketbase_admin_email: str = ""
    pocketbase_admin_password: str = ""

    # Dify Configuration
    dify_base_url: str = "https://api.dify.ai"
    dify_api_key: str = ""
    dify_user: str = "infographic"

    # App Configuration
    debug: bool = False

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
