import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.models import ArticleData

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个专业的内容结构化助手。你的任务是将文章内容转换为结构化的 JSON 格式。"""

USER_PROMPT_TEMPLATE = """请将以下文章内容转换为结构化 JSON 格式，用于信息图文章渲染器。

输出格式必须严格遵循以下 TypeScript 类型定义：

```typescript
interface ArticleData {{
  title: string;           // 文章标题
  subtitle?: string;       // 副标题（可选）
  meta?: {{
    author?: string;       // 作者
    date?: string;         // 日期
    readTime?: string;     // 阅读时间，如 "5 分钟"
  }};
  sections: ArticleSection[];  // 文章章节
}}

interface ArticleSection {{
  title: string;           // 章节标题
  content: ContentBlock[]; // 内容块数组
}}

// 【重要】每个 ContentBlock 必须包含 "type" 字段！
type ContentBlock =
  | {{ type: "paragraph"; text: string }}  // 段落，支持 **粗体** 语法
  | {{ type: "quote"; text: string; author?: string }}  // 引用
  | {{ type: "callout"; text: string; title?: string; variant?: "info" | "warning" | "success" }}  // 提示框
  | {{ type: "list"; items: string[]; title?: string; style?: "bullet" | "check" | "number" }}  // 列表
  | {{ type: "grid"; items: {{ title: string; description: string }}[]; columns: 1 | 2 | 3 }}  // 网格卡片
  | {{ type: "image"; src: string; alt: string; caption?: string }}  // 图片
  | {{ type: "stat"; items: {{ label: string; value: string; trend?: "up" | "down" | "flat"; note?: string }}[]; columns?: 1 | 2 | 3 }}  // 统计数据
  | {{ type: "tags"; items: string[] }}  // 标签
  | {{ type: "timeline"; items: {{ title: string; time?: string; desc?: string }}[] }}  // 时间线
  | {{ type: "comparison"; columns: string[]; rows: ComparisonRow[] }}  // 对比表
  | {{ type: "table"; headers: string[]; rows: string[][] }}  // 表格
  | {{ type: "code"; code: string; language?: string; title?: string }}  // 代码块
  | {{ type: "accordion"; items: {{ question: string; answer: string }}[] }}  // 折叠面板/FAQ
  | {{ type: "steps"; items: {{ step: number; title: string; description: string }}[] }}  // 步骤流程
  | {{ type: "progress"; items: {{ label: string; value: number; max?: number }}[] }}  // 进度/评分条
  | {{ type: "highlight"; text: string; color?: "yellow" | "blue" | "green" | "pink" }}  // 高亮文本框
  | {{ type: "definition"; items: {{ term: string; definition: string }}[] }}  // 术语定义
  | {{ type: "proscons"; pros: string[]; cons: string[] }}  // 优缺点对比
  | {{ type: "video"; src: string; platform?: "youtube" | "bilibili" | "custom"; title?: string }}  // 视频嵌入
  | {{ type: "divider"; dividerStyle?: "simple" | "decorated" | "text"; text?: string }}  // 分隔线
  | {{ type: "linkcard"; url: string; title: string; description?: string; image?: string }}  // 链接卡片
  | {{ type: "rating"; items: {{ label: string; score: number; maxScore?: number }}[] }}  // 评分展示

// ⚠️ 【极其重要】ComparisonRow 必须是对象，不是数组！
interface ComparisonRow {{
  label: string;      // 行标签
  values: string[];   // 对应每列的值
}}
```

⚠️⚠️⚠️ 【最重要的格式要求 - comparison 类型】⚠️⚠️⚠️
comparison 的 rows 必须是对象数组，每个对象包含 label 和 values 字段！

✅ 正确格式：
{{"type": "comparison", "columns": ["GPT-5", "GPT-4"], "rows": [
  {{"label": "准确率", "values": ["95%", "90%"]}},
  {{"label": "速度", "values": ["快", "中"]}}
]}}

❌ 错误格式（不要这样写！）：
{{"type": "comparison", "columns": ["GPT-5", "GPT-4"], "rows": [
  ["准确率", "95%", "90%"],
  ["速度", "快", "中"]
]}}

ContentBlock 示例：
- 段落: {{"type": "paragraph", "text": "这是一段文字"}}
- 列表: {{"type": "list", "items": ["项目1", "项目2"], "style": "bullet"}}
- 对比表: {{"type": "comparison", "columns": ["方案A", "方案B"], "rows": [{{"label": "价格", "values": ["免费", "付费"]}}]}}
- 表格: {{"type": "table", "headers": ["列1", "列2"], "rows": [["数据1", "数据2"]]}}
- 折叠: {{"type": "accordion", "items": [{{"question": "问题1", "answer": "回答1"}}]}}
- 步骤: {{"type": "steps", "items": [{{"step": 1, "title": "第一步", "description": "描述"}}]}}
- 进度: {{"type": "progress", "items": [{{"label": "完成度", "value": 75, "max": 100}}]}}
- 高亮: {{"type": "highlight", "text": "重点内容", "color": "yellow"}}
- 定义: {{"type": "definition", "items": [{{"term": "术语", "definition": "解释"}}]}}
- 优缺点: {{"type": "proscons", "pros": ["优点1"], "cons": ["缺点1"]}}
- 分隔: {{"type": "divider", "dividerStyle": "decorated"}}
- 链接卡片: {{"type": "linkcard", "url": "https://example.com", "title": "链接标题", "description": "描述"}}
- 评分: {{"type": "rating", "items": [{{"label": "评分项", "score": 4.5, "maxScore": 5}}]}}

转换规则：
1. 提取文章标题作为 title，副标题作为 subtitle
2. 尽量提取作者、日期信息到 meta
3. 根据内容逻辑划分为多个 sections，每个大的主题或章节应该是一个独立的 section
4. 根据内容特点选择合适的 ContentBlock 类型
5. 【极其重要】JSON 文本中绝对不要包含 markdown 语法：
   - 不要出现 "#"、"##"、"###"、"####" 等标题语法
   - 不要出现 ">"、"-"、"*" 等列表或引用语法
   - 如果原文有子标题（如 "3.2 深圳：xxx"），应该创建新的 section 或使用 highlight block，而不是放在 paragraph 中
   - 如果有编号列表内容，使用 list block 的 "number" style
6. 过滤掉广告、订阅提示、社交媒体引导等非正文内容
7. 子标题处理：如果文章中有类似 "3.1 xxx"、"第一部分：xxx" 这样的子标题，应该作为新 section 的 title，或者用 highlight block 突出显示

{language_instruction}

请直接输出 JSON，不要包含 markdown 代码块标记。

---
文章内容：

{content}"""

TRANSLATE_INSTRUCTION = """

【重要】请将所有文章内容翻译为中文输出，包括标题、副标题、段落、列表项等所有文本内容。但有些不适合直译的特定单词比如OpenAI等，则保持原文即可。"""

KEEP_ORIGINAL_INSTRUCTION = """

【重要】请保持文章的原始语言，不要翻译任何内容。"""


def fix_comparison_rows(data: dict) -> dict:
    """
    修正 LLM 输出中 comparison 类型的 rows 格式错误。
    LLM 有时会把 rows 输出为 [["label", "val1", "val2"]] 格式（table 格式），
    但 comparison 需要 [{"label": "...", "values": [...]}] 格式。
    """
    if "sections" not in data:
        logger.debug("No sections found in data, skipping fix_comparison_rows")
        return data

    fixed_count = 0
    for section_idx, section in enumerate(data["sections"]):
        if "content" not in section:
            continue
        for block_idx, block in enumerate(section["content"]):
            block_type = block.get("type", "unknown")
            has_rows = "rows" in block

            logger.info(f"Checking section[{section_idx}].content[{block_idx}]: type={block_type}, has_rows={has_rows}")

            # 处理所有带 rows 字段的 comparison 类型块
            if block_type == "comparison" and has_rows and block["rows"]:
                fixed_rows = []
                rows_fixed_in_block = 0
                for row_idx, row in enumerate(block["rows"]):
                    logger.info(f"  Row {row_idx}: type={type(row).__name__}, value={str(row)[:100]}")
                    # 如果 row 是列表而不是字典，需要转换
                    if isinstance(row, list) and len(row) >= 1:
                        # 第一个元素作为 label，其余作为 values
                        fixed_rows.append({
                            "label": str(row[0]),
                            "values": [str(v) for v in row[1:]]
                        })
                        rows_fixed_in_block += 1
                    elif isinstance(row, dict):
                        # 已经是正确格式，保持不变
                        fixed_rows.append(row)
                    else:
                        # 其他情况，尝试转换为字符串
                        fixed_rows.append({"label": str(row), "values": []})
                        rows_fixed_in_block += 1
                block["rows"] = fixed_rows
                if rows_fixed_in_block > 0:
                    fixed_count += rows_fixed_in_block
                    logger.info(f"Fixed {rows_fixed_in_block} comparison rows in section[{section_idx}].content[{block_idx}]")

            # 如果是 table 类型但 rows 里面是对象数组（LLM 搞混了），转换为 comparison
            elif block_type == "table" and has_rows and block["rows"]:
                first_row = block["rows"][0] if block["rows"] else None
                # 检查是否是错误格式：rows 是列表的列表，第一个元素看起来像 label
                if isinstance(first_row, list) and len(first_row) >= 2:
                    # 如果有 headers，说明这确实是 table，rows 格式是对的（string[][]）
                    if "headers" in block and block["headers"]:
                        logger.debug(f"  Table block has headers, keeping as table")
                    else:
                        # 没有 headers，可能是 LLM 把 comparison 错误地标记为 table
                        logger.info(f"  Converting table to comparison in section[{section_idx}].content[{block_idx}]")
                        block["type"] = "comparison"
                        # 使用第一行作为 columns
                        if "columns" not in block or not block["columns"]:
                            # 从第一个数据行推断列数
                            num_cols = len(first_row) - 1  # 减去 label 列
                            block["columns"] = [f"列{i+1}" for i in range(num_cols)]
                        # 转换 rows
                        fixed_rows = []
                        for row in block["rows"]:
                            if isinstance(row, list) and len(row) >= 1:
                                fixed_rows.append({
                                    "label": str(row[0]),
                                    "values": [str(v) for v in row[1:]]
                                })
                                fixed_count += 1
                        block["rows"] = fixed_rows

    if fixed_count > 0:
        logger.info(f"Total fixed comparison rows: {fixed_count}")
    else:
        logger.debug("No comparison rows needed fixing")

    return data


class LLMService:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key
        )
        self.model = settings.llm_model_name

    async def convert_to_article_json(self, markdown_content: str, translate_to_chinese: bool = True) -> ArticleData:
        """Convert markdown content to structured ArticleData JSON."""
        logger.info(f"Starting LLM conversion, translate_to_chinese={translate_to_chinese}, content_length={len(markdown_content)}")

        # 根据翻译选项添加相应指令
        language_instruction = TRANSLATE_INSTRUCTION if translate_to_chinese else KEEP_ORIGINAL_INSTRUCTION

        # 构建 user prompt，把所有指令放在 user message 中
        user_prompt = USER_PROMPT_TEMPLATE.format(
            language_instruction=language_instruction,
            content=markdown_content
        )

        logger.debug(f"Calling LLM model: {self.model}")
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        if not content:
            logger.error("LLM returned empty response")
            raise Exception("LLM returned empty response")

        logger.info(f"LLM response received, length={len(content)}")
        logger.debug(f"LLM raw response: {content[:500]}...")

        try:
            data = json.loads(content)
            logger.info(f"JSON parsed successfully, sections count: {len(data.get('sections', []))}")

            # 修正 comparison rows 格式错误
            logger.info("Running fix_comparison_rows...")
            data = fix_comparison_rows(data)

            logger.info("Validating with Pydantic ArticleData model...")
            result = ArticleData(**data)
            logger.info("Validation successful!")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Raw content causing error: {content[:1000]}")
            raise Exception(f"Failed to parse LLM response as JSON: {e}")
        except Exception as e:
            logger.error(f"Validation error: {e}")
            raise Exception(f"Failed to validate article structure: {e}")

    async def translate_error(self, error_msg: str) -> str:
        """将技术错误信息翻译为用户友好的中文提示。"""
        # 常见错误的快速映射，避免调用 LLM
        error_mappings = {
            "Timeout": "页面加载超时，请稍后重试或检查网址是否正确",
            "timeout": "页面加载超时，请稍后重试或检查网址是否正确",
            "networkidle": "页面加载超时，该网站可能加载较慢，请稍后重试",
            "Failed on navigating": "无法访问该网页，请检查网址是否正确或网站是否可访问",
            "Crawl failed": "网页抓取失败，请检查网址是否有效",
            "too short or empty": "网页内容为空或过短，无法生成文章",
            "LLM returned empty": "AI 处理失败，请稍后重试",
            "Failed to parse": "内容解析失败，请稍后重试",
            "Failed to validate": "文章格式验证失败，请稍后重试",
            "Connection refused": "服务连接失败，请稍后重试",
            "Connection error": "网络连接错误，请检查网络后重试",
        }

        # 检查是否匹配已知错误
        for key, friendly_msg in error_mappings.items():
            if key.lower() in error_msg.lower():
                return friendly_msg

        # 如果没有匹配，尝试用 LLM 翻译
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个错误信息翻译助手。将技术错误信息翻译为简洁友好的中文提示，不超过50字。"},
                    {"role": "user", "content": f"请将以下错误信息翻译为用户友好的中文提示：\n{error_msg[:500]}"}
                ],
                temperature=0.3,
                max_tokens=100
            )
            translated = response.choices[0].message.content
            return translated.strip() if translated else "处理过程中发生错误，请稍后重试"
        except Exception:
            # LLM 调用失败时的 fallback
            return "处理过程中发生错误，请稍后重试"


llm_service = LLMService()
