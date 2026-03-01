import asyncio
import logging
import json
import re
import httpx
import html2text
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


# HTML content selectors for simple crawler fallback (priority order)
_ARTICLE_SELECTORS = [
    r'<article[^>]*>(.*?)</article>',
    r'<main[^>]*>(.*?)</main>',
    r'<div[^>]*class="[^"]*(?:post-content|entry-content|article-body|body markup|story-body|post-body)[^"]*"[^>]*>(.*?)</div>',
    r'<div[^>]*(?:role="main"|id="article-body")[^>]*>(.*?)</div>',
]

# Tags to strip from HTML before converting to markdown
_STRIP_TAGS_RE = re.compile(
    r'<(?:nav|footer|header|aside|script|style|noscript|iframe|svg)\b[^>]*>.*?</(?:nav|footer|header|aside|script|style|noscript|iframe|svg)>',
    re.DOTALL | re.IGNORECASE
)
_HTML_COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)


def _html_to_markdown(html_content: str) -> str:
    """Convert HTML to markdown using html2text."""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = False
    h.ignore_emphasis = False
    h.body_width = 0  # don't wrap lines
    h.unicode_snob = True
    h.skip_internal_links = True
    h.inline_links = True
    h.protect_links = True
    h.ignore_tables = False
    return h.handle(html_content)


def _extract_article_html(full_html: str) -> str:
    """
    从完整 HTML 中提取文章正文部分。
    按优先级尝试多个选择器，返回第一个匹配的内容。
    """
    # First strip nav/footer/script etc.
    cleaned = _STRIP_TAGS_RE.sub('', full_html)
    cleaned = _HTML_COMMENT_RE.sub('', cleaned)

    # Try each selector
    for selector in _ARTICLE_SELECTORS:
        match = re.search(selector, cleaned, re.DOTALL | re.IGNORECASE)
        if match:
            content = match.group(1)
            if len(content.strip()) > 200:  # meaningful content
                return content

    # Fallback: use <body> content
    body_match = re.search(r'<body[^>]*>(.*?)</body>', cleaned, re.DOTALL | re.IGNORECASE)
    if body_match:
        return body_match.group(1)

    return cleaned


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

    async def _do_simple_crawl(self, url: str) -> str:
        """
        轻量级 HTTP 回退爬虫：直接 HTTP GET 获取页面 HTML，提取文章正文，转换为 Markdown。
        适用于文章内容已在静态 HTML 中的网站（如 Substack、博客等）。
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        }
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers=headers
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

            html_content = response.text
            if not html_content or len(html_content) < 200:
                raise Exception("Simple crawl: page content is too short or empty")

            logger.info("Simple crawl: HTML fetched, size=%d", len(html_content))

            # Extract article content from HTML
            article_html = _extract_article_html(html_content)
            logger.info("Simple crawl: article HTML extracted, size=%d", len(article_html))

            # Convert HTML to markdown
            markdown = _html_to_markdown(article_html)

            if not markdown or len(markdown.strip()) < 100:
                raise Exception("Simple crawl: converted markdown is too short")

            raw_len = len(markdown)
            logger.info("Simple crawl: markdown converted, raw_length=%d", raw_len)

            # Apply same cleaning
            markdown = clean_markdown(markdown, max_length=self.content_max_length)

            if raw_len != len(markdown):
                logger.info(
                    "Simple crawl: content cleaned: %d → %d chars (removed %.0f%%)",
                    raw_len, len(markdown),
                    (1 - len(markdown) / raw_len) * 100 if raw_len > 0 else 0
                )

            if not markdown or len(markdown.strip()) < 100:
                raise Exception("Simple crawl: content is too short after cleaning")

            return markdown

    async def crawl_url(self, url: str) -> str:
        """Crawl URL: 先尝试 crawl4ai，超时/失败则回退到简单 HTTP 爬取。"""
        logger.info(
            "Crawling URL: %s (hard_timeout=%.0fs, page_timeout=%dms, max_length=%d)",
            url, self.http_timeout, self.page_timeout_ms, self.content_max_length
        )

        # Phase 1: Try crawl4ai
        crawl4ai_error = None
        try:
            result = await asyncio.wait_for(
                self._do_crawl(url),
                timeout=self.http_timeout
            )
            return result
        except asyncio.TimeoutError:
            crawl4ai_error = f"Crawl4AI hard timeout after {self.http_timeout:.0f}s"
            logger.warning("%s for URL: %s, trying simple HTTP fallback...", crawl4ai_error, url)
        except httpx.TimeoutException:
            crawl4ai_error = f"Crawl4AI HTTP timeout after {self.http_timeout:.0f}s"
            logger.warning("%s for URL: %s, trying simple HTTP fallback...", crawl4ai_error, url)
        except httpx.ConnectError:
            crawl4ai_error = f"Cannot connect to Crawl4AI service at {self.base_url}"
            logger.warning("%s, trying simple HTTP fallback...", crawl4ai_error)
        except Exception as e:
            crawl4ai_error = str(e)
            logger.warning("Crawl4AI failed: %s, trying simple HTTP fallback...", crawl4ai_error)

        # Phase 2: Fallback to simple HTTP crawl
        try:
            result = await asyncio.wait_for(
                self._do_simple_crawl(url),
                timeout=60.0  # simple crawl should be fast
            )
            logger.info(
                "Simple HTTP fallback succeeded (crawl4ai had failed: %s)",
                crawl4ai_error
            )
            return result
        except Exception as fallback_error:
            logger.error(
                "Simple HTTP fallback also failed: %s (original crawl4ai error: %s)",
                fallback_error, crawl4ai_error
            )
            # Raise the original crawl4ai error as it's usually more informative
            if "timeout" in (crawl4ai_error or "").lower():
                raise Exception(
                    f"Crawl timed out after {self.http_timeout:.0f}s. "
                    f"HTTP fallback also failed: {fallback_error}"
                )
            raise Exception(
                f"Crawl failed: {crawl4ai_error}. "
                f"HTTP fallback also failed: {fallback_error}"
            )


crawler_service = CrawlerService()
