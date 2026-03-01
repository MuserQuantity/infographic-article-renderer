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
    # 双模型架构：长文本使用 Model A (分析) + Model B (格式化) 两步处理
    llm_dual_model_threshold: int = 15000  # 超过此字符数启用双模型模式（0 表示始终使用双模型）
    llm_formatter_model_name: str = ""  # Model B 模型名称，为空则使用 llm_model_name
    llm_dual_model_enabled: bool = True  # 是否启用双模型架构（仅对长文本生效）

    # Crawl4AI Configuration
    crawl4ai_url: str = "http://localhost:11235"
    crawl_timeout_seconds: float = 180.0  # 爬虫 HTTP 请求超时（硬超时，asyncio.wait_for）
    crawl_page_timeout_ms: int = 30000  # 浏览器页面加载超时（毫秒）

    # PocketBase Configuration
    pocketbase_url: str = "http://localhost:8090"
    pocketbase_admin_email: str = ""
    pocketbase_admin_password: str = ""

    # Dify Configuration
    dify_base_url: str = "https://api.dify.ai"
    dify_api_key: str = ""
    dify_user: str = "infographic"

    # App Configuration
    task_timeout_seconds: float = 600.0  # 单个任务的总超时时间（秒），0 表示不限制
    debug: bool = False

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
