import json
import httpx
from app.config import get_settings


class CrawlerService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.crawl4ai_url.rstrip("/")

    async def crawl_url(self, url: str) -> str:
        """Call crawl4ai service to crawl URL and return markdown content."""
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{self.base_url}/crawl",
                json={
                    "urls": [url],
                    "crawler_config": {
                        "type": "CrawlerRunConfig",
                        "params": {
                            # 内容选择器
                            "css_selector": "article, main, .post, .content, .entry-content, [role='main'], .article-body, .story-body, #article-body",
                            # 等待策略
                            "wait_until": "load",
                            "delay_before_return_html": 3.0,
                            "page_timeout": 60000,
                            # 模拟真实浏览器
                            "simulate_user": True,
                            "magic": True,
                            "stream": True
                        }
                    }
                }
            )

            if response.status_code != 200:
                raise Exception(f"Crawl4AI service error: {response.text}")

            # 响应是多行 JSON，第一行是数据，第二行是状态
            lines = response.text.strip().split('\n')

            # 解析第一行（包含实际数据）
            data = json.loads(lines[0])

            # 检查是否成功
            if not data.get("success"):
                error_msg = data.get("error_message", "Unknown crawl error")
                raise Exception(f"Crawl failed: {error_msg}")

            # 获取 markdown.raw_markdown（最干净的内容）
            markdown_data = data.get("markdown", {})
            markdown = markdown_data.get("raw_markdown", "")

            if not markdown or len(markdown.strip()) < 100:
                raise Exception("Crawled content is too short or empty")

            return markdown


crawler_service = CrawlerService()
