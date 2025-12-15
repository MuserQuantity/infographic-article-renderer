import json
import httpx
from app.config import get_settings


class CrawlerService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.crawl4ai_url.rstrip("/")

    async def crawl_url(self, url: str) -> str:
        """Call crawl4ai service to crawl URL and return markdown content."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/crawl",
                json={
                    "urls": [url],
                    "crawler_config": {
                        "type": "CrawlerRunConfig",
                        "params": {
                            "css_selector": "article, main, .post, .content, .entry-content, [role='main']",
                            "wait_until": "domcontentloaded",
                            "delay_before_return_html": 2.0,
                            "scraping_strategy": {
                                "type": "LXMLWebScrapingStrategy",
                                "params": {}
                            },
                            "exclude_social_media_domains": [
                                "facebook.com",
                                "twitter.com",
                                "x.com",
                                "linkedin.com",
                                "instagram.com",
                                "pinterest.com",
                                "tiktok.com",
                                "snapchat.com",
                                "reddit.com"
                            ],
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
