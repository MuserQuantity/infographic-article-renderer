import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.models import ArticleData

SYSTEM_PROMPT = """你是一个专业的内容结构化助手。你的任务是将文章内容转换为结构化的 JSON 格式，用于信息图文章渲染器。

输出格式必须严格遵循以下 TypeScript 类型定义：

```typescript
interface ArticleData {
  title: string;           // 文章标题
  subtitle?: string;       // 副标题（可选）
  meta?: {
    author?: string;       // 作者
    date?: string;         // 日期
    readTime?: string;     // 阅读时间，如 "5 分钟"
  };
  sections: ArticleSection[];  // 文章章节
}

interface ArticleSection {
  title: string;           // 章节标题
  content: ContentBlock[]; // 内容块数组
}

// 【重要】每个 ContentBlock 必须包含 "type" 字段！
// 正确格式: { "type": "paragraph", "text": "内容" }
// 错误格式: { "paragraph": "内容" }  ← 这是错误的！
type ContentBlock =
  | { type: "paragraph"; text: string }  // 段落，支持 **粗体** 语法
  | { type: "quote"; text: string; author?: string }  // 引用
  | { type: "callout"; text: string; title?: string; variant?: "info" | "warning" | "success" }  // 提示框
  | { type: "list"; items: string[]; title?: string; style?: "bullet" | "check" | "number" }  // 列表
  | { type: "grid"; items: { title: string; description: string }[]; columns: 1 | 2 | 3 }  // 网格卡片
  | { type: "image"; src: string; alt: string; caption?: string }  // 图片
  | { type: "stat"; items: { label: string; value: string; trend?: "up" | "down" | "flat"; note?: string }[]; columns?: 1 | 2 | 3 }  // 统计数据
  | { type: "tags"; items: string[] }  // 标签
  | { type: "timeline"; items: { title: string; time?: string; desc?: string }[] }  // 时间线
  | { type: "comparison"; columns: string[]; rows: { label: string; values: string[] }[] }  // 对比表（rows 必须是对象数组！）
  | { type: "table"; headers: string[]; rows: string[][] }  // 表格（rows 是字符串数组的数组）
  | { type: "code"; code: string; language?: string; title?: string }  // 代码块
```

ContentBlock 示例：
- 段落: {"type": "paragraph", "text": "这是一段文字，支持 **粗体** 语法"}
- 引用: {"type": "quote", "text": "这是一段引用文字", "author": "作者名"}
- 提示框: {"type": "callout", "text": "这是提示内容", "title": "提示标题", "variant": "info"}
- 列表: {"type": "list", "items": ["项目1", "项目2", "项目3"], "title": "列表标题", "style": "bullet"}
- 网格卡片: {"type": "grid", "items": [{"title": "卡片1", "description": "描述1"}, {"title": "卡片2", "description": "描述2"}], "columns": 2}
- 图片: {"type": "image", "src": "https://example.com/image.jpg", "alt": "图片描述", "caption": "图片说明"}
- 统计数据: {"type": "stat", "items": [{"label": "用户数", "value": "10万+", "trend": "up"}, {"label": "增长率", "value": "25%", "trend": "up"}], "columns": 2}
- 标签: {"type": "tags", "items": ["标签1", "标签2", "标签3"]}
- 时间线: {"type": "timeline", "items": [{"title": "事件1", "time": "2024-01", "desc": "描述1"}, {"title": "事件2", "time": "2024-06", "desc": "描述2"}]}
- 对比表: {"type": "comparison", "columns": ["方案A", "方案B"], "rows": [{"label": "价格", "values": ["免费", "付费"]}, {"label": "功能", "values": ["基础", "完整"]}]}
- 表格: {"type": "table", "headers": ["列1", "列2", "列3"], "rows": [["数据1", "数据2", "数据3"], ["数据4", "数据5", "数据6"]]}
- 代码块: {"type": "code", "code": "console.log('Hello World');", "language": "javascript", "title": "示例代码"}

【特别注意 comparison 和 table 的 rows 格式区别！】
- comparison 的 rows 是对象数组: [{"label": "行名", "values": ["值1", "值2"]}]
- table 的 rows 是纯字符串数组: [["值1", "值2"], ["值3", "值4"]]
- 切勿混淆！comparison 需要每行有 label 和 values 两个字段

转换规则：
1. 提取文章标题作为 title
2. 如果有副标题或摘要，作为 subtitle
3. 尽量提取作者、日期信息到 meta
4. 根据内容逻辑划分为多个 sections，每个 section 有明确的主题
5. 根据内容特点选择合适的 ContentBlock 类型：
   - 普通文本用 paragraph
   - 重要引用用 quote
   - 提示/警告/建议用 callout
   - 列举项目用 list
   - 功能/特性介绍用 grid
   - 数据/统计用 stat
   - 事件/历程用 timeline
   - 多方案对比用 comparison（注意 rows 必须是 {label, values} 对象数组）
   - 结构化数据用 table（rows 是字符串数组的数组）
   - 关键词/分类用 tags
   - 代码示例/代码片段用 code

6. 确保输出是有效的 JSON，不要添加任何注释或额外文本
7. 如果文章有图片链接，保留原始 URL 在 image 块中
8. 【重要】JSON 中的文本内容不要包含 markdown 语法标记：
   - quote 类型的 text 不要包含 ">" 符号
   - list 类型的 items 不要包含 "-" 或 "*" 符号
   - 不要包含 "#" 标题标记
   - 只保留纯文本内容（**粗体** 语法除外，这个保留）
9. 【重要】过滤掉以下非正文内容，不要包含在输出中：
   - 广告和推广内容
   - 订阅邮件列表、Newsletter 的提示
   - 社交媒体关注引导（如 "Follow us on Twitter"）
   - 网站导航链接
   - 版权声明和免责声明
   - "相关文章"、"推荐阅读" 等推荐区块
   - 评论区内容
   - 作者简介/关于作者区块
   - 捐赠/赞助提示

请直接输出 JSON，不要包含 markdown 代码块标记。"""

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
        return data

    for section in data["sections"]:
        if "content" not in section:
            continue
        for block in section["content"]:
            if block.get("type") == "comparison" and "rows" in block:
                fixed_rows = []
                for row in block["rows"]:
                    # 如果 row 是列表而不是字典，需要转换
                    if isinstance(row, list) and len(row) >= 1:
                        # 第一个元素作为 label，其余作为 values
                        fixed_rows.append({
                            "label": str(row[0]),
                            "values": [str(v) for v in row[1:]]
                        })
                    elif isinstance(row, dict):
                        # 已经是正确格式，保持不变
                        fixed_rows.append(row)
                    else:
                        # 其他情况，尝试转换为字符串
                        fixed_rows.append({"label": str(row), "values": []})
                block["rows"] = fixed_rows

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
        # 根据翻译选项添加相应指令
        language_instruction = TRANSLATE_INSTRUCTION if translate_to_chinese else KEEP_ORIGINAL_INSTRUCTION
        system_prompt = SYSTEM_PROMPT + language_instruction

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请将以下文章内容转换为结构化JSON格式：\n\n{markdown_content}"}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        if not content:
            raise Exception("LLM returned empty response")

        try:
            data = json.loads(content)
            # 修正 comparison rows 格式错误
            data = fix_comparison_rows(data)
            return ArticleData(**data)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse LLM response as JSON: {e}")
        except Exception as e:
            raise Exception(f"Failed to validate article structure: {e}")


llm_service = LLMService()
