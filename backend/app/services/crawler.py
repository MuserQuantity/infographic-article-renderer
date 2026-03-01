import asyncio
import logging
import json
import re
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

# HTML tags to exclude from crawling (navigation, ads, sidebars, etc.)
EXCLUDED_TAGS = [
    "nav", "footer", "header", "aside",
    "noscript", "iframe", "svg",
    "style", "script",
]

# Regex patterns for content cleaning
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^\)]+\)")  # markdown links [text](url)
_NAV_PATTERN_RE = re.compile(
    r"^\s*(\*|\-|\d+\.)\s*\[",  # list items that start with a link
    re.MULTILINE,
)
_SEPARATOR_RE = re.compile(r"^[\s\-_=\*]{3,}$")  # separator lines like ---, ***, ===
_EMPTY_HEADING_RE = re.compile(r"^#{1,6}\s*$", re.MULTILINE)  # empty headings


def clean_markdown(text: str, max_length: int = 0) -> str:
    """
    清洗 markdown 内容，去除导航、广告、重复链接块等无用内容。

    策略：
    1. 按段落（双换行）分割
    2. 过滤链接密度过高的段落（导航菜单、侧边栏等）
    3. 过滤过短且无实质内容的段落
    4. 合并连续空行
    5. 如果超过 max_length，在段落边界智能截断
    """
    if not text:
        return text

    paragraphs = re.split(r"\n\s*\n", text)
    cleaned = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Skip empty headings
        if _EMPTY_HEADING_RE.fullmatch(para):
            continue

        # Skip separator-only paragraphs
        lines = para.split("\n")
        non_sep_lines = [l for l in lines if not _SEPARATOR_RE.fullmatch(l.strip())]
        if not non_sep_lines:
            continue

        # Calculate link density
        plain_text = _LINK_RE.sub(r"\1", para)
        link_matches = _LINK_RE.findall(para)
        total_len = len(plain_text.strip())
        link_text_len = sum(len(m) for m in link_matches)
        link_density = link_text_len / total_len if total_len > 0 else 0

        # Count nav-like list items
        nav_lines = len(_NAV_PATTERN_RE.findall(para))
        total_lines = len(lines)

        # Filter: high link density + mostly nav-like list items
        if total_lines >= 3 and nav_lines / total_lines > 0.7 and link_density > 0.5:
            logger.debug("Filtered nav block (%d lines, link_density=%.2f)", total_lines, link_density)
            continue

        # Filter: very short paragraphs that are just links
        if total_len < 30 and link_density > 0.8:
            continue

        # Filter: paragraphs that are entirely links with no other content
        stripped_of_links = _LINK_RE.sub("", para).strip()
        stripped_of_links = re.sub(r"[\s\*\-\|\[\]]+", "", stripped_of_links)
        if total_len > 50 and len(stripped_of_links) < 10 and link_density > 0.6:
            logger.debug("Filtered link-only block (len=%d)", total_len)
            continue

        cleaned.append(para)

    result = "\n\n".join(cleaned)
    result = re.sub(r"\n{3,}", "\n\n", result)  # collapse excessive newlines

    # Smart truncation at paragraph boundary
    if max_length > 0 and len(result) > max_length:
        original_len = len(result)
        truncated = result[:max_length]
        last_break = truncated.rfind("\n\n")
        if last_break > max_length * 0.7:
            result = truncated[:last_break]
        else:
            last_line = truncated.rfind("\n")
            if last_line > max_length * 0.8:
                result = truncated[:last_line]
            else:
                result = truncated
        logger.info(
            "Content truncated: %d → %d chars (max_length=%d)",
            original_len, len(result), max_length
        )

    return result.strip()


class CrawlerService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.crawl4ai_url.rstrip("/")
        self.http_timeout = max(30.0, settings.crawl_timeout_seconds)
        self.page_timeout_ms = max(5000, settings.crawl_page_timeout_ms)
        self.content_max_length = max(0, settings.crawl_content_max_length)

    async def _do_crawl(self, url: str) -> str:
        """实际执行爬虫请求（内部方法，由 crawl_url 包裹超时）。"""
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            response = await client.post(
                f"{self.base_url}/crawl",
                json={
                    "urls": [url],
                    "crawler_config": {
                        "type": "CrawlerRunConfig",
                        "params": {
                            # 内容选择器
                            "css_selector": "article, main, .post, .content, .entry-content, [role='main'], .article-body, .story-body, #article-body",
                            # 排除无关标签
                            "excluded_tags": EXCLUDED_TAGS,
                            # 等待策略
                            "wait_until": "load",
                            "delay_before_return_html": 3.0,
                            "page_timeout": self.page_timeout_ms,
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

            # 响应可能是多行 JSON，第一行是数据
            lines = response.text.strip().split('\n')

            # 解析第一行（包含实际数据）
            data = json.loads(lines[0])

            # 检查是否成功
            if not data.get("success"):
                error_msg = data.get("error_message", "Unknown crawl error")
                raise Exception(f"Crawl failed: {error_msg}")

            # 优先使用 fit_markdown（经过内容提取的精简版），回退到 raw_markdown
            markdown_data = data.get("markdown", {})
            fit_markdown = markdown_data.get("fit_markdown", "")
            raw_markdown = markdown_data.get("raw_markdown", "")

            if fit_markdown and len(fit_markdown.strip()) >= 100:
                markdown = fit_markdown
                source = "fit_markdown"
            elif raw_markdown and len(raw_markdown.strip()) >= 100:
                markdown = raw_markdown
                source = "raw_markdown"
            else:
                raise Exception("Crawled content is too short or empty")

            raw_len = len(markdown)
            logger.info("Crawl completed, source=%s, raw_length=%d", source, raw_len)

            # 内容清洗
            markdown = clean_markdown(markdown, max_length=self.content_max_length)

            if raw_len != len(markdown):
                logger.info(
                    "Content cleaned: %d → %d chars (removed %.0f%%)",
                    raw_len, len(markdown),
                    (1 - len(markdown) / raw_len) * 100 if raw_len > 0 else 0
                )

            if not markdown or len(markdown.strip()) < 100:
                raise Exception("Crawled content is too short or empty after cleaning")

            return markdown

    async def crawl_url(self, url: str) -> str:
        """Call crawl4ai service to crawl URL and return markdown content.

        使用 asyncio.wait_for 做硬超时，防止流式响应导致 httpx 超时失效。
        """
        logger.info(
            "Crawling URL: %s (hard_timeout=%.0fs, page_timeout=%dms, max_length=%d)",
            url, self.http_timeout, self.page_timeout_ms, self.content_max_length
        )
        try:
            return await asyncio.wait_for(
                self._do_crawl(url),
                timeout=self.http_timeout
            )
        except asyncio.TimeoutError:
            logger.error("Crawler hard timeout after %.0fs for URL: %s", self.http_timeout, url)
            raise Exception(
                f"Crawl timed out after {self.http_timeout:.0f}s. "
                "The page may be too slow to load or unavailable."
            )
        except httpx.TimeoutException:
            logger.error("Crawler HTTP timeout after %.0fs for URL: %s", self.http_timeout, url)
            raise Exception(
                f"Crawl timed out after {self.http_timeout:.0f}s. "
                "The page may be too slow to load or unavailable."
            )
        except httpx.ConnectError:
            logger.error("Cannot connect to Crawl4AI service at %s", self.base_url)
            raise Exception(
                f"Cannot connect to crawl service at {self.base_url}. "
                "Please ensure the Crawl4AI service is running."
            )


crawler_service = CrawlerService()
