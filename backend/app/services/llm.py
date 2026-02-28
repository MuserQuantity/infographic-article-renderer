import asyncio
import json
import logging
import random
import re
from typing import Optional
from openai import (
    APIConnectionError,
    APITimeoutError,
    APIStatusError,
    AsyncOpenAI
)
from app.config import get_settings
from app.models import ArticleData

logger = logging.getLogger(__name__)


def extract_json_from_response(content: str) -> str:
    """
    从 LLM 响应中提取 JSON 部分。
    某些模型（如 Gemini）可能在 JSON 前输出思考过程文本，需要提取纯 JSON。
    """
    if not content:
        return content

    # 如果内容已经是以 { 开头，直接返回
    content_stripped = content.strip()
    if content_stripped.startswith('{'):
        return content_stripped

    # 尝试找到 JSON 对象的开始位置（第一个 {）
    json_start = content.find('{')
    if json_start == -1:
        logger.warning("No JSON object found in response")
        return content

    # 从 { 开始，找到匹配的 }
    # 使用简单的括号计数来找到完整的 JSON 对象
    brace_count = 0
    json_end = -1
    in_string = False
    escape_next = False

    for i in range(json_start, len(content)):
        char = content[i]

        if escape_next:
            escape_next = False
            continue

        if char == '\\' and in_string:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_end = i + 1
                    break

    if json_end > json_start:
        extracted = content[json_start:json_end]
        if json_start > 0:
            logger.info(f"Extracted JSON from response (skipped {json_start} chars of prefix text)")
        return extracted

    # 如果无法找到完整的 JSON，返回从 { 开始的内容
    logger.warning("Could not find complete JSON object, returning from first '{'")
    return content[json_start:]


def _is_json_truncated(content: str) -> bool:
    """
    检查 JSON 内容是否看起来是被截断的（花括号/方括号不匹配）。
    返回 True 表示内容很可能不完整。
    """
    if not content or not content.strip():
        return False

    brace_count = 0
    bracket_count = 0
    in_string = False
    escape_next = False

    for char in content:
        if escape_next:
            escape_next = False
            continue
        if char == '\\' and in_string:
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1

    is_truncated = brace_count > 0 or bracket_count > 0 or in_string
    if is_truncated:
        logger.info(
            "JSON appears truncated: unmatched_braces=%d, unmatched_brackets=%d, in_string=%s",
            brace_count,
            bracket_count,
            in_string
        )
    return is_truncated


def repair_json(content: str) -> str:
    """
    尝试修复常见的 JSON 格式问题：
    1. 移除控制字符（保留正常的 \n \r \t）
    2. 修复 JSON 字符串内部的裸换行符
    3. 移除尾部逗号
    4. 补全缺失的闭合括号
    """
    if not content or not content.strip():
        return content

    original_length = len(content)

    # Step 1: 移除 JSON 字符串值中的控制字符（U+0000-U+001F 中除了 \t \n \r 以外的）
    # 这些字符在 JSON 规范中不允许出现在字符串内部
    def clean_control_chars(s: str) -> str:
        result = []
        in_str = False
        esc = False
        for ch in s:
            if esc:
                result.append(ch)
                esc = False
                continue
            if ch == '\\' and in_str:
                result.append(ch)
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                result.append(ch)
                continue
            if in_str and ord(ch) < 32 and ch not in ('\t', '\n', '\r'):
                # 跳过非法控制字符
                continue
            result.append(ch)
        return ''.join(result)

    content = clean_control_chars(content)

    # Step 2: 修复 JSON 字符串中的裸换行符（在 JSON 字符串内部 \n 必须被转义为 \\n）
    def fix_newlines_in_strings(s: str) -> str:
        result = []
        in_str = False
        esc = False
        for ch in s:
            if esc:
                result.append(ch)
                esc = False
                continue
            if ch == '\\' and in_str:
                result.append(ch)
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                result.append(ch)
                continue
            if in_str and ch == '\n':
                result.append('\\n')
                continue
            if in_str and ch == '\r':
                result.append('\\r')
                continue
            if in_str and ch == '\t':
                result.append('\\t')
                continue
            result.append(ch)
        return ''.join(result)

    content = fix_newlines_in_strings(content)

    # Step 3: 移除尾部逗号 (trailing commas before } or ])
    content = re.sub(r',\s*([}\]])', r'\1', content)

    # Step 4: 使用栈追踪嵌套结构，精确补全缺失的闭合括号
    stack: list[str] = []  # '{' or '['
    in_string = False
    escape_next = False

    for char in content:
        if escape_next:
            escape_next = False
            continue
        if char == '\\' and in_string:
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if not in_string:
            if char in ('{', '['):
                stack.append(char)
            elif char == '}' and stack and stack[-1] == '{':
                stack.pop()
            elif char == ']' and stack and stack[-1] == '[':
                stack.pop()

    # 如果在字符串内部被截断，先关闭字符串
    if in_string:
        content += '"'
        logger.info("JSON repair: closed unterminated string")

    # 按照栈的反序补全缺失的闭合括号
    if stack:
        # 移除末尾可能的不完整值
        content = content.rstrip()
        # 移除尾部可能残留的逗号或冒号
        content = content.rstrip(',:')
        content = content.rstrip()

        # 再次移除尾部逗号（rstrip 后可能新暴露出来的）
        content = re.sub(r',\s*$', '', content)

        # 按照栈的反序闭合：栈底是最外层，栈顶是最内层
        closers = ''.join('}' if opener == '{' else ']' for opener in reversed(stack))
        content += closers
        bracket_count = sum(1 for c in stack if c == '[')
        brace_count = sum(1 for c in stack if c == '{')
        logger.info(
            "JSON repair: appended %d ']' and %d '}' to close JSON (stack depth=%d)",
            bracket_count,
            brace_count,
            len(stack)
        )

    if len(content) != original_length:
        logger.info("JSON repair: content modified (original=%d, repaired=%d)", original_length, len(content))

    return content


SYSTEM_PROMPT = """你是一个专业的内容结构化与排版设计助手。你的任务是将输入文章转换为结构化 JSON，并确保输出具有优秀的视觉排版节奏。只输出 JSON，不要输出思维链、解释或任何多余文字。输出必须以 { 开始，以 } 结束。

排版美学核心原则：
1. 节奏感：避免连续超过 2 个 paragraph，中间应穿插至少一个视觉型 block（如 callout、highlight、list、grid、stat、quote 等）
2. 多样性：每个 section 应包含至少 2 种不同类型的 content block，避免单一类型堆叠
3. 视觉锚点：每个 section 建议有 1 个"视觉焦点"block（如 stat、grid、comparison、timeline、steps、image 等），让读者眼睛有休息和聚焦的地方
4. 适度留白：在话题转换处使用 divider（decorated 或 text 样式）
5. 强调得当：关键结论或核心观点用 highlight 或 callout 突出，不要全用 paragraph 平铺

内容块选择策略：
- 数据/指标/百分比 → stat（优先）或 progress
- 对比两个以上事物 → comparison 或 proscons
- 流程/步骤/阶段 → steps 或 timeline
- 核心要点/清单 → list（check 或 number 样式）
- 关键概念解释 → definition
- 常见问题 → accordion
- 名言/观点引用 → quote
- 重要提醒/警告 → callout（选择合适的 variant）
- 关键结论/金句 → highlight
- 特征/功能展示 → grid（2-3 列）
- 评分/评价 → rating
- 纯叙述内容 → paragraph（搭配 **粗体** 标注重点词）"""

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
  | {{ type: "paragraph"; text: string }}  // 段落，文本中允许 **粗体** 和 [文本](url)
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
  | {{ type: "infographic"; syntax: string; template?: string; theme?: string; height?: number }}  // 信息图（使用 @antv/infographic DSL 语法）

// ⚠️ 【极其重要】ComparisonRow 必须是对象，不是数组！
interface ComparisonRow {{
  label: string;      // 行标签
  values: string[];   // 对应每列的值
}}
```

⚠️⚠️⚠️ 【最重要的格式要求 - comparison 类型】⚠️⚠️⚠️
comparison 的 rows 必须是对象数组，每个对象包含 label 和 values 字段！
并且必须满足：
- values 的长度必须与 columns 的长度完全一致
- 每个 values 项都必须是完整短句，不要把一句话拆到相邻列
- 不允许空字符串；缺失信息请使用 "—" 占位

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
- 段落: {{"type": "paragraph", "text": "这是一段 **重点** 内容"}}
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
- 信息图: {{"type": "infographic", "syntax": "infographic list-row-simple-horizontal-arrow\\ndata\\n  lists\\n    - label 步骤1\\n      desc 描述", "height": 400}}

⚠️ 【infographic 类型使用指南】
infographic 类型使用专业的信息图 DSL 语法，适用于需要高质量数据可视化的场景。
语法格式：
```
infographic <模板名称>
data
  lists/sequences/compares
    - label <标签>
      desc <描述>
      value <数值>
```

常用模板：
- list-row-simple-horizontal-arrow: 横向箭头流程
- sequence-steps-simple: 步骤流程
- sequence-timeline-simple: 时间线
- list-grid-circular-progress: 环形进度
- compare-binary-horizontal-simple-fold: 优缺点对比
- compare-hierarchy-row-letter-card-compact-card: 层级对比

**重要：只在需要特殊可视化效果时使用 infographic 类型。大多数情况下，使用 steps、timeline、progress、proscons、stat、comparison 等原生类型即可，它们会自动使用专业信息图渲染。**

内容结构与排版规则：
1. 提取文章标题作为 title，副标题作为 subtitle
2. 尽量提取作者、日期信息到 meta；不要编造，缺失则省略
3. 根据内容逻辑划分为多个 sections，每个大的主题或章节应该是一个独立的 section
4. 为了尽可能完整还原内容：每个 section 建议 3-8 个内容块；段落 2-6 句；列表/时间线 5-12 项；统计/评分 3-6 项。内容很长时允许更多 sections 与内容块，宁可拆分也不要过度压缩
5. 根据内容特点选择合适的 ContentBlock 类型；不确定时使用 paragraph
6. 允许少量行内 Markdown（仅限文本字段）：**粗体**、[文本](https://example.com)
7. 禁止任何其他 Markdown 语法或代码块：
   - 不要出现 "#"、"##"、"###" 等标题语法
   - 不要出现以 "-"、"*"、">" 开头的列表或引用语法
   - 不要出现 "```" 代码块标记
8. 过滤掉广告、订阅提示、社交媒体引导等非正文内容
9. 子标题处理：如果文章中有类似 "3.1 xxx"、"第一部分：xxx" 这样的子标题，应该作为新 section 的 title，或者用 highlight block 突出显示
10. section 的 title 禁止包含序号前缀：渲染器会自动添加章节编号，因此 title 不要带 "1."、"2."、"一、"、"二、"、"（一）"、"第一章"、"Part 1" 等任何形式的编号。例如原文标题 "一、为什么需要两个 OpenClaw 协作?" 应写为 "为什么需要两个 OpenClaw 协作?"
11. 如果内容包含 URL，优先使用 linkcard，或在文本中使用 [文本](url)
12. 面向长篇采访/逐字稿，尽量覆盖全部话题与关键观点，保留关键细节、例子、数字、结论；如有提问者/回答者，优先用 quote/paragraph 标注说话人以保持问答脉络

排版节奏规则（非常重要）：
13. 禁止连续超过 2 个 paragraph：如果有 3 段以上连续叙述，必须在中间插入 list、callout、highlight、quote 等视觉型 block 来打破单调
14. 每个 section 至少包含 2 种不同类型的 content block，避免类型单一化
15. 每个 section 推荐包含 1 个"视觉焦点"block（stat、grid、comparison、timeline、steps、image、proscons、rating 等），让页面有节奏感
16. 在重要数据出现时优先使用 stat 而非写在 paragraph 中；在有步骤/流程时优先使用 steps 而非 list；在有明确对比时优先使用 comparison 而非 table
17. 文章开头的第一个 section 建议以非 paragraph 的视觉型 block 开场（如 tags、stat、highlight、callout），快速吸引读者注意力

{language_instruction}

请直接输出 JSON，不要包含 Markdown 代码块标记，不要输出任何解释或多余文本。

---
文章内容：

{content}"""

TRANSLATE_INSTRUCTION = """

【重要】请将所有文章内容翻译为中文输出，包括标题、副标题、段落、列表项等所有文本内容。但有些不适合直译的特定单词比如OpenAI等，则保持原文即可。"""

KEEP_ORIGINAL_INSTRUCTION = """

【重要】请保持文章的原始语言，不要翻译任何内容。"""

# 分块处理时，后续 chunk 只输出 sections 数组的 prompt
CHUNK_USER_PROMPT_TEMPLATE = """你正在处理一篇长文章的**第 {chunk_index} 部分（共 {total_chunks} 部分）**。

请将以下文章片段转换为结构化 JSON sections 数组。注意：
- 只输出 sections 数组部分，不需要 title、subtitle、meta
- 输出格式为：{{"sections": [...]}}
- 保持与之前部分相同的排版风格和 ContentBlock 类型选择标准
- 完整还原本部分所有内容，不要遗漏或压缩

{language_instruction}

请直接输出 JSON，不要包含 Markdown 代码块标记，不要输出任何解释或多余文本。

---
文章片段（第 {chunk_index}/{total_chunks} 部分）：

{content}"""


def split_markdown_into_chunks(content: str, chunk_size: int) -> list[str]:
    """
    将 markdown 内容按照标题层级分割成合理大小的块。
    优先在 # 或 ## 标题处分割，保证每块不超过 chunk_size。
    """
    if len(content) <= chunk_size:
        return [content]

    # 按照标题行分割：匹配 # 或 ## 或 ### 开头的行
    heading_pattern = re.compile(r'^(#{1,3})\s+', re.MULTILINE)
    headings = list(heading_pattern.finditer(content))

    if not headings:
        # 没有标题，按段落分割（双换行）
        return _split_by_size(content, chunk_size)

    # 在每个标题位置处分割出"节"
    sections: list[str] = []
    for i, match in enumerate(headings):
        start = match.start()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(content)
        section_text = content[start:end]
        sections.append(section_text)

    # 如果第一个标题前有内容（如前言），加入
    if headings[0].start() > 0:
        preamble = content[:headings[0].start()].strip()
        if preamble:
            sections.insert(0, preamble)

    # 将节合并成合理大小的块
    chunks: list[str] = []
    current_chunk = ""

    for section in sections:
        # 如果单个 section 就超过 chunk_size，需要进一步分割
        if len(section) > chunk_size:
            # 先把当前积累的块保存
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""
            # 对超大 section 进行二次分割
            sub_chunks = _split_by_size(section, chunk_size)
            chunks.extend(sub_chunks)
            continue

        # 如果加上这个 section 会超过 chunk_size，先保存当前块
        if current_chunk and len(current_chunk) + len(section) > chunk_size:
            chunks.append(current_chunk.strip())
            current_chunk = ""

        current_chunk += section

    # 保存最后一个块
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    logger.info(
        "Split markdown into %d chunks (input_length=%d, chunk_size=%d)",
        len(chunks),
        len(content),
        chunk_size
    )
    for i, chunk in enumerate(chunks):
        logger.info("  Chunk %d/%d: %d chars", i + 1, len(chunks), len(chunk))

    return chunks


def _split_by_size(content: str, chunk_size: int) -> list[str]:
    """按照段落边界分割内容到指定大小。"""
    paragraphs = content.split('\n\n')
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if current and len(current) + len(para) + 2 > chunk_size:
            chunks.append(current.strip())
            current = ""
        current += para + '\n\n'

    if current.strip():
        chunks.append(current.strip())

    return chunks if chunks else [content]


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
                        logger.debug("  Table block has headers, keeping as table")
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


def normalize_blocks(data: dict) -> dict:
    if "sections" not in data:
        return data

    normalized_sections = []
    for section in data["sections"]:
        title = str(section.get("title", "")).strip() or "未命名章节"
        content = section.get("content") or []
        if not isinstance(content, list):
            content = [content]

        normalized_content = []
        for block in content:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if not block_type or not isinstance(block_type, str):
                continue

            normalized_block = dict(block)
            normalized_block["type"] = block_type

            if block_type == "paragraph":
                text = str(normalized_block.get("text", "")).strip()
                if not text:
                    continue
                normalized_block["text"] = text
            elif block_type == "list":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = [str(item).strip() for item in items if str(item).strip()]
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "quote":
                text = str(normalized_block.get("text", "")).strip()
                if not text:
                    continue
                normalized_block["text"] = text
                author = normalized_block.get("author")
                if author is not None:
                    normalized_block["author"] = str(author).strip()
            elif block_type == "callout":
                text = str(normalized_block.get("text", "")).strip()
                if not text:
                    continue
                normalized_block["text"] = text
                title_value = normalized_block.get("title")
                if title_value is not None:
                    normalized_block["title"] = str(title_value).strip()
            elif block_type == "grid":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        title_value = str(item.get("title", "")).strip()
                        description_value = str(item.get("description", "")).strip()
                        if title_value and description_value:
                            normalized_items.append({"title": title_value, "description": description_value})
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
                columns = normalized_block.get("columns")
                if columns not in (1, 2, 3):
                    normalized_block["columns"] = 2
            elif block_type == "image":
                src = str(normalized_block.get("src", "")).strip()
                alt = str(normalized_block.get("alt", "")).strip()
                if not src or not alt:
                    continue
                normalized_block["src"] = src
                normalized_block["alt"] = alt
                caption = normalized_block.get("caption")
                if caption is not None:
                    normalized_block["caption"] = str(caption).strip()
            elif block_type == "stat":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        label = str(item.get("label", "")).strip()
                        value = str(item.get("value", "")).strip()
                        if label and value:
                            normalized_items.append({
                                "label": label,
                                "value": value,
                                "trend": item.get("trend"),
                                "note": str(item.get("note", "")).strip() if item.get("note") is not None else None
                            })
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
                columns = normalized_block.get("columns")
                if columns not in (1, 2, 3):
                    normalized_block["columns"] = 3
            elif block_type == "tags":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = [str(item).strip() for item in items if str(item).strip()]
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "timeline":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        title_value = str(item.get("title", "")).strip()
                        if title_value:
                            normalized_items.append({
                                "title": title_value,
                                "time": str(item.get("time", "")).strip() if item.get("time") is not None else None,
                                "desc": str(item.get("desc", "")).strip() if item.get("desc") is not None else None
                            })
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "comparison":
                columns = normalized_block.get("columns") or []
                if not isinstance(columns, list):
                    columns = [columns]
                normalized_columns = [str(col).strip() for col in columns if str(col).strip()]
                expected_values_count = len(normalized_columns)
                rows = normalized_block.get("rows") or []
                if not isinstance(rows, list):
                    rows = [rows]
                normalized_rows = []
                for row in rows:
                    if isinstance(row, dict):
                        label = str(row.get("label", "")).strip()
                        values = row.get("values") or []
                        if not isinstance(values, list):
                            values = [values]
                        normalized_values = []
                        for value in values:
                            text = str(value).strip() if value is not None else ""
                            normalized_values.append(text if text else "—")

                        if expected_values_count > 0:
                            normalized_values = normalized_values[:expected_values_count]
                            while len(normalized_values) < expected_values_count:
                                normalized_values.append("—")
                        elif not normalized_values:
                            normalized_values = ["—"]

                        if label:
                            normalized_rows.append({"label": label, "values": normalized_values})
                if not normalized_rows:
                    continue
                normalized_block["columns"] = normalized_columns
                normalized_block["rows"] = normalized_rows
            elif block_type == "table":
                headers = normalized_block.get("headers") or []
                if not isinstance(headers, list):
                    headers = [headers]
                normalized_headers = [str(header).strip() for header in headers if str(header).strip()]
                rows = normalized_block.get("rows") or []
                if not isinstance(rows, list):
                    rows = [rows]
                normalized_rows = []
                for row in rows:
                    if isinstance(row, list):
                        normalized_row = [str(cell).strip() for cell in row]
                        normalized_rows.append(normalized_row)
                if not normalized_rows:
                    continue
                normalized_block["headers"] = normalized_headers
                normalized_block["rows"] = normalized_rows
            elif block_type == "code":
                code = str(normalized_block.get("code", "")).strip()
                if not code:
                    continue
                normalized_block["code"] = code
                language = normalized_block.get("language")
                if language is not None:
                    normalized_block["language"] = str(language).strip()
                title_value = normalized_block.get("title")
                if title_value is not None:
                    normalized_block["title"] = str(title_value).strip()
            elif block_type == "accordion":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        question = str(item.get("question", "")).strip()
                        answer = str(item.get("answer", "")).strip()
                        if question and answer:
                            normalized_items.append({"question": question, "answer": answer})
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "steps":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for index, item in enumerate(items, start=1):
                    if isinstance(item, dict):
                        title_value = str(item.get("title", "")).strip()
                        description_value = str(item.get("description", "")).strip()
                        if title_value and description_value:
                            step_value = item.get("step")
                            if not isinstance(step_value, int):
                                step_value = index
                            normalized_items.append({
                                "step": step_value,
                                "title": title_value,
                                "description": description_value
                            })
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "progress":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        label = str(item.get("label", "")).strip()
                        value = item.get("value")
                        max_value = item.get("max") if item.get("max") is not None else 100
                        if label and isinstance(value, (int, float)):
                            normalized_items.append({
                                "label": label,
                                "value": int(value),
                                "max": int(max_value) if isinstance(max_value, (int, float)) else 100
                            })
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "highlight":
                text = str(normalized_block.get("text", "")).strip()
                if not text:
                    continue
                normalized_block["text"] = text
            elif block_type == "definition":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        term = str(item.get("term", "")).strip()
                        definition = str(item.get("definition", "")).strip()
                        if term and definition:
                            normalized_items.append({"term": term, "definition": definition})
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "proscons":
                pros = normalized_block.get("pros") or []
                cons = normalized_block.get("cons") or []
                if not isinstance(pros, list):
                    pros = [pros]
                if not isinstance(cons, list):
                    cons = [cons]
                normalized_pros = [str(item).strip() for item in pros if str(item).strip()]
                normalized_cons = [str(item).strip() for item in cons if str(item).strip()]
                if not normalized_pros and not normalized_cons:
                    continue
                normalized_block["pros"] = normalized_pros
                normalized_block["cons"] = normalized_cons
            elif block_type == "video":
                src = str(normalized_block.get("src", "")).strip()
                if not src:
                    continue
                normalized_block["src"] = src
                platform = normalized_block.get("platform")
                if platform is not None:
                    normalized_block["platform"] = str(platform).strip()
                title_value = normalized_block.get("title")
                if title_value is not None:
                    normalized_block["title"] = str(title_value).strip()
            elif block_type == "divider":
                normalized_block["dividerStyle"] = normalized_block.get("dividerStyle")
            elif block_type == "linkcard":
                url = str(normalized_block.get("url", "")).strip()
                title_value = str(normalized_block.get("title", "")).strip()
                if not url or not title_value:
                    continue
                normalized_block["url"] = url
                normalized_block["title"] = title_value
                description_value = normalized_block.get("description")
                if description_value is not None:
                    normalized_block["description"] = str(description_value).strip()
                image_value = normalized_block.get("image")
                if image_value is not None:
                    normalized_block["image"] = str(image_value).strip()
            elif block_type == "rating":
                items = normalized_block.get("items") or []
                if not isinstance(items, list):
                    items = [items]
                normalized_items = []
                for item in items:
                    if isinstance(item, dict):
                        label = str(item.get("label", "")).strip()
                        score = item.get("score")
                        max_score = item.get("maxScore") if item.get("maxScore") is not None else 5
                        if label and isinstance(score, (int, float)):
                            normalized_items.append({
                                "label": label,
                                "score": float(score),
                                "maxScore": float(max_score) if isinstance(max_score, (int, float)) else 5
                            })
                if not normalized_items:
                    continue
                normalized_block["items"] = normalized_items
            elif block_type == "infographic":
                syntax = str(normalized_block.get("syntax", "")).strip()
                if not syntax:
                    continue
                normalized_block["syntax"] = syntax
                template = normalized_block.get("template")
                if template is not None:
                    normalized_block["template"] = str(template).strip()
                theme = normalized_block.get("theme")
                if theme is not None:
                    normalized_block["theme"] = str(theme).strip()
                height = normalized_block.get("height")
                if height is not None and isinstance(height, (int, float)):
                    normalized_block["height"] = int(height)
            else:
                continue

            normalized_content.append(normalized_block)

        if normalized_content:
            normalized_sections.append({"title": title, "content": normalized_content})

    data["sections"] = normalized_sections
    return data


class LLMService:
    def __init__(self):
        settings = get_settings()
        configured_timeout = settings.llm_timeout_seconds
        self.request_timeout_seconds: Optional[float] = configured_timeout if configured_timeout > 0 else None
        self.client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            timeout=self.request_timeout_seconds,
            max_retries=0
        )
        self.model = settings.llm_model_name
        self.max_retries = max(0, settings.llm_max_retries)
        self.retry_base_delay = max(0.1, settings.llm_retry_base_delay)
        self.retry_max_delay = max(self.retry_base_delay, settings.llm_retry_max_delay)
        self.use_response_format = settings.llm_use_response_format
        self.max_continuations = max(0, settings.llm_max_continuations)
        self.chunk_size = max(5000, settings.llm_chunk_size)
        self.max_parallel_chunks = max(1, settings.llm_max_parallel_chunks)
        self.total_timeout_seconds = self._calculate_total_timeout()

    def _calculate_total_timeout(self) -> Optional[float]:
        if self.request_timeout_seconds is None:
            return None
        attempts = max(1, self.max_retries + 1)
        retry_delay_total = self.retry_max_delay * max(0, attempts - 1)
        return self.request_timeout_seconds * attempts + retry_delay_total + 5.0

    async def _create_chat_completion(self, **kwargs):
        attempts = max(1, self.max_retries + 1)
        for attempt in range(1, attempts + 1):
            try:
                return await self.client.chat.completions.create(**kwargs)
            except APIStatusError as e:
                status_code = getattr(e, "status_code", None)
                retryable = status_code in {429, 500, 502, 503, 504}
                if not retryable or attempt == attempts:
                    logger.error(f"LLM request failed with status={status_code}, attempt={attempt}/{attempts}")
                    raise
                delay = min(self.retry_max_delay, self.retry_base_delay * (2 ** (attempt - 1)))
                delay += random.uniform(0, delay * 0.25)
                logger.warning(
                    "LLM request retrying after status=%s, attempt=%s/%s, sleep=%.2fs",
                    status_code,
                    attempt,
                    attempts,
                    delay
                )
                await asyncio.sleep(delay)
            except (APIConnectionError, APITimeoutError) as e:
                if attempt == attempts:
                    logger.error(f"LLM request failed due to connection/timeout, attempt={attempt}/{attempts}: {e}")
                    raise
                delay = min(self.retry_max_delay, self.retry_base_delay * (2 ** (attempt - 1)))
                delay += random.uniform(0, delay * 0.25)
                logger.warning(
                    "LLM request retrying after connection/timeout error, attempt=%s/%s, sleep=%.2fs",
                    attempt,
                    attempts,
                    delay
                )
                await asyncio.sleep(delay)

    async def _call_with_optional_timeout(self, request_kwargs: dict, content_length: int):
        """Call LLM with optional total timeout wrapper."""
        if self.total_timeout_seconds is None:
            return await self._create_chat_completion(**request_kwargs)
        try:
            return await asyncio.wait_for(
                self._create_chat_completion(**request_kwargs),
                timeout=self.total_timeout_seconds
            )
        except asyncio.TimeoutError:
            logger.error(
                "LLM request timed out after %.1fs (content_length=%s)",
                self.total_timeout_seconds,
                content_length
            )
            raise Exception(f"LLM request timed out after {self.total_timeout_seconds:.1f}s")

    async def _continue_completion(
        self,
        messages: list[dict],
        accumulated_content: str,
        content_length: int
    ) -> str:
        """
        当 LLM 输出因 max_tokens 被截断时（finish_reason='length'），
        自动发送续写请求，将所有部分拼接为完整内容。
        """
        full_content = accumulated_content

        for continuation in range(1, self.max_continuations + 1):
            logger.info(
                "Continue mode: round %d/%d, accumulated_length=%d",
                continuation,
                self.max_continuations,
                len(full_content)
            )

            # 构建续写消息：在原始对话的基础上追加已有的 assistant 回复和续写请求
            continue_messages = messages + [
                {"role": "assistant", "content": full_content},
                {"role": "user", "content": "你的 JSON 输出不完整，被截断了。请从断点处继续输出剩余的 JSON 内容，不要重复已有部分，不要添加任何解释文字。"}
            ]

            continue_kwargs: dict = {
                "model": self.model,
                "messages": continue_messages,
                "temperature": 0.3
            }
            # 续写请求不使用 response_format，因为部分 JSON 片段不是合法 JSON
            # 某些 API 提供商会在 response_format=json_object 时拒绝不完整的输出

            response = await self._call_with_optional_timeout(continue_kwargs, content_length)

            chunk = response.choices[0].message.content
            if not chunk:
                logger.warning("Continue mode: received empty response at round %d", continuation)
                break

            logger.info(
                "Continue mode: received chunk length=%d at round %d",
                len(chunk),
                continuation
            )
            full_content += chunk

            finish_reason = response.choices[0].finish_reason
            if finish_reason != "length":
                logger.info(
                    "Continue mode: completed at round %d, finish_reason=%s, total_length=%d",
                    continuation,
                    finish_reason,
                    len(full_content)
                )
                return full_content

        logger.warning(
            "Continue mode: reached max continuations (%d), total_length=%d",
            self.max_continuations,
            len(full_content)
        )
        return full_content

    async def _call_llm_and_parse_json(
        self,
        messages: list[dict],
        content_length: int,
        label: str = "LLM"
    ) -> dict:
        """
        调用 LLM 并解析返回的 JSON，包含 continue 模式和 JSON 修复逻辑。
        返回解析后的 dict。
        """
        logger.debug(f"[{label}] Calling LLM model: {self.model}")
        request_kwargs: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3
        }
        if self.use_response_format:
            request_kwargs["response_format"] = {"type": "json_object"}

        response = await self._call_with_optional_timeout(request_kwargs, content_length)

        content = response.choices[0].message.content
        if not content:
            logger.error(f"[{label}] LLM returned empty response")
            raise Exception(f"[{label}] LLM returned empty response")

        finish_reason = response.choices[0].finish_reason
        logger.info(f"[{label}] LLM response received, length={len(content)}, finish_reason={finish_reason}")
        logger.debug(f"[{label}] LLM raw response: {content[:500]}...")

        # 如果输出因 max_tokens 截断（finish_reason='length'），进入 continue 模式
        if finish_reason == "length" and self.max_continuations > 0:
            logger.warning(
                "[%s] LLM output truncated (finish_reason=length), entering continue mode (max_continuations=%d)",
                label,
                self.max_continuations
            )
            content = await self._continue_completion(messages, content, content_length)
            logger.info(f"[{label}] Continue mode finished, total content length={len(content)}")

        # 提取 JSON 部分
        content = extract_json_from_response(content)

        # 智能截断检测
        if self.max_continuations > 0 and finish_reason != "length" and _is_json_truncated(content):
            logger.warning(
                "[%s] JSON content appears truncated despite finish_reason=%s, "
                "attempting continue mode (max_continuations=%d)",
                label,
                finish_reason,
                self.max_continuations
            )
            content = await self._continue_completion(messages, content, content_length)
            content = extract_json_from_response(content)
            logger.info(f"[{label}] Smart continue mode finished, total content length={len(content)}")

        # 尝试解析 JSON
        try:
            data = json.loads(content)
        except json.JSONDecodeError as first_error:
            logger.warning(f"[{label}] Initial JSON parse failed: {first_error}")
            logger.info(f"[{label}] Attempting JSON repair...")
            repaired_content = repair_json(content)
            try:
                data = json.loads(repaired_content)
                logger.info(f"[{label}] JSON repair successful!")
            except json.JSONDecodeError:
                logger.error(f"[{label}] JSON repair also failed")
                logger.error(f"[{label}] Raw content (first 1500 chars): {content[:1500]}")
                logger.error(f"[{label}] Raw content (last 500 chars): {content[-500:]}")
                raise Exception(f"[{label}] Failed to parse LLM response as JSON: {first_error}")

        return data

    async def _process_single_chunk(
        self,
        chunk: str,
        chunk_num: int,
        total_chunks: int,
        language_instruction: str
    ) -> dict:
        """处理单个 chunk 并返回解析后的 JSON dict。"""
        label = f"Chunk {chunk_num}/{total_chunks}"
        logger.info(f"[{label}] Processing chunk, length={len(chunk)}")

        if chunk_num == 1:
            user_prompt = USER_PROMPT_TEMPLATE.format(
                language_instruction=language_instruction,
                content=chunk
            )
        else:
            user_prompt = CHUNK_USER_PROMPT_TEMPLATE.format(
                chunk_index=chunk_num,
                total_chunks=total_chunks,
                language_instruction=language_instruction,
                content=chunk
            )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        return await self._call_llm_and_parse_json(messages, len(chunk), label=label)

    async def _convert_chunked(
        self,
        markdown_content: str,
        translate_to_chinese: bool
    ) -> dict:
        """
        分块处理长文章：将 markdown 拆分成多个块，分别调用 LLM 转换，最后合并结果。
        第一块提取 title/subtitle/meta + sections，后续块只提取 sections。
        后续块使用 asyncio.Semaphore 进行并行处理以加快速度。
        """
        chunks = split_markdown_into_chunks(markdown_content, self.chunk_size)
        language_instruction = TRANSLATE_INSTRUCTION if translate_to_chinese else KEEP_ORIGINAL_INSTRUCTION
        total_chunks = len(chunks)

        logger.info(
            "Chunked processing: %d chunks, max_parallel=%d",
            total_chunks,
            self.max_parallel_chunks
        )

        # 第一块同步处理，获取 title/subtitle/meta
        first_data = await self._process_single_chunk(
            chunks[0], 1, total_chunks, language_instruction
        )
        title = first_data.get("title", "")
        subtitle = first_data.get("subtitle")
        meta = first_data.get("meta")
        all_sections: list[dict] = first_data.get("sections", [])
        logger.info(f"[Chunk 1/{total_chunks}] Got {len(all_sections)} sections")

        # 后续块并行处理（使用 semaphore 控制并发数）
        if total_chunks > 1:
            semaphore = asyncio.Semaphore(self.max_parallel_chunks)

            async def process_with_semaphore(chunk: str, chunk_num: int) -> dict:
                async with semaphore:
                    return await self._process_single_chunk(
                        chunk, chunk_num, total_chunks, language_instruction
                    )

            tasks = [
                process_with_semaphore(chunks[i], i + 1)
                for i in range(1, total_chunks)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 按顺序合并结果
            for i, result in enumerate(results):
                chunk_num = i + 2  # 从第2块开始
                label = f"Chunk {chunk_num}/{total_chunks}"
                if isinstance(result, Exception):
                    logger.error(f"[{label}] Failed: {result}")
                    raise result
                chunk_sections = result.get("sections", [])
                logger.info(f"[{label}] Got {len(chunk_sections)} sections")
                all_sections.extend(chunk_sections)

        logger.info(
            "Chunked processing complete: %d chunks -> %d total sections",
            total_chunks,
            len(all_sections)
        )

        # 合并结果
        merged_data: dict = {
            "title": title,
            "sections": all_sections
        }
        if subtitle:
            merged_data["subtitle"] = subtitle
        if meta:
            merged_data["meta"] = meta

        return merged_data

    async def convert_to_article_json(self, markdown_content: str, translate_to_chinese: bool = True) -> ArticleData:
        """Convert markdown content to structured ArticleData JSON."""
        logger.info(f"Starting LLM conversion, translate_to_chinese={translate_to_chinese}, content_length={len(markdown_content)}")

        # 判断是否需要分块处理
        if len(markdown_content) > self.chunk_size:
            logger.info(
                "Content length %d exceeds chunk_size %d, using chunked processing",
                len(markdown_content),
                self.chunk_size
            )
            data = await self._convert_chunked(markdown_content, translate_to_chinese)
        else:
            # 短内容：使用单次调用
            language_instruction = TRANSLATE_INSTRUCTION if translate_to_chinese else KEEP_ORIGINAL_INSTRUCTION
            user_prompt = USER_PROMPT_TEMPLATE.format(
                language_instruction=language_instruction,
                content=markdown_content
            )
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ]
            data = await self._call_llm_and_parse_json(messages, len(markdown_content))

        logger.info(f"JSON parsed successfully, sections count: {len(data.get('sections', []))}")

        try:
            # 修正 comparison rows 格式错误
            logger.info("Running fix_comparison_rows...")
            data = fix_comparison_rows(data)

            logger.info("Normalizing blocks...")
            data = normalize_blocks(data)

            logger.info("Validating with Pydantic ArticleData model...")
            result = ArticleData(**data)
            logger.info("Validation successful!")
            return result
        except Exception as e:
            logger.error(f"Validation error: {e}")
            raise Exception(f"Failed to validate article structure: {e}")

    async def translate_error(self, error_msg: str) -> str:
        """将技术错误信息翻译为用户友好的中文提示。"""
        # 常见错误的快速映射，避免调用 LLM
        error_mappings = {
            "Timeout": "页面加载超时，请稍后重试或检查网址是否正确",
            "timeout": "页面加载超时，请稍后重试或检查网址是否正确",
            "LLM request timed out": "AI 处理超时，请稍后重试",
            "maximum context length": "内容过长，超出模型可处理范围，请缩短文本后重试",
            "context length": "内容过长，超出模型可处理范围，请缩短文本后重试",
            "Request too large": "内容过长，超出模型可处理范围，请缩短文本后重试",
            "networkidle": "页面加载超时，该网站可能加载较慢，请稍后重试",
            "Failed on navigating": "无法访问该网页，请检查网址是否正确或网站是否可访问",
            "Crawl failed": "网页抓取失败，请检查网址是否有效",
            "too short or empty": "网页内容为空或过短，无法生成文章",
            "LLM returned empty": "AI 处理失败，请稍后重试",
            "Failed to parse": "内容解析失败，请稍后重试",
            "Failed to validate": "文章格式验证失败，请稍后重试",
            "Connection refused": "服务连接失败，请稍后重试",
            "Connection error": "网络连接错误，请检查网络后重试",
            "Internal Server Error": "LLM 服务内部错误，请稍后重试",
            "Continue mode: reached max continuations": "AI 输出内容过长，已达到最大续写次数，结果可能不完整",
            "Task timeout: processing took too long": "任务处理超时，请稍后重试",
            "Crawl timed out": "网页抓取超时，页面加载过慢或不可用，请稍后重试",
            "Cannot connect to crawl service": "爬虫服务未运行，请检查 Crawl4AI 服务状态",
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
