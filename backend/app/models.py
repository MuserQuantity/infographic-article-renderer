from pydantic import BaseModel, HttpUrl, model_validator
from typing import Optional, Literal, Any, Union
from datetime import datetime


# Task Status
TaskStatus = Literal["pending", "processing", "completed", "failed"]


# Request Models
class CreateTaskRequest(BaseModel):
    url: HttpUrl
    force_refresh: bool = False
    translate_to_chinese: bool = True  # 是否翻译为中文，默认开启


class RefreshTaskRequest(BaseModel):
    url: HttpUrl
    translate_to_chinese: bool = True  # 是否翻译为中文，默认开启


# Article JSON Schema (matches frontend types.ts)
class StatItem(BaseModel):
    label: str
    value: str
    trend: Optional[Literal["up", "down", "flat"]] = None
    note: Optional[str] = None


class GridItem(BaseModel):
    title: str
    description: str
    icon: Optional[str] = None


class TimelineItem(BaseModel):
    title: str
    time: Optional[str] = None
    desc: Optional[str] = None


class ComparisonRow(BaseModel):
    label: str
    values: list[str]


class AccordionItem(BaseModel):
    question: str
    answer: str


class StepItem(BaseModel):
    step: int
    title: str
    description: str


class ProgressItem(BaseModel):
    label: str
    value: int
    max: Optional[int] = 100


class DefinitionItem(BaseModel):
    term: str
    definition: str


class RatingItem(BaseModel):
    label: str
    score: float
    maxScore: Optional[float] = 5


class ContentBlock(BaseModel):
    type: Literal[
        "paragraph", "list", "quote", "callout", "grid",
        "image", "stat", "tags", "timeline", "comparison", "table", "code",
        "accordion", "steps", "progress", "highlight", "definition",
        "proscons", "video", "divider", "linkcard", "rating"
    ]
    # Common fields
    id: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None
    # List specific
    items: Optional[list[Any]] = None
    style: Optional[Literal["bullet", "check", "number"]] = None
    # Quote specific
    author: Optional[str] = None
    # Callout specific
    variant: Optional[Literal["info", "warning", "success"]] = None
    # Grid/Stat columns (int) or Comparison columns (list[str])
    columns: Optional[Union[int, list[str]]] = None
    # Image specific
    src: Optional[str] = None
    alt: Optional[str] = None
    caption: Optional[str] = None
    # Comparison: list[ComparisonRow], Table: list[list[str]]
    rows: Optional[Union[list[ComparisonRow], list[list[str]]]] = None
    # Table specific
    headers: Optional[list[str]] = None
    # Code specific
    code: Optional[str] = None
    language: Optional[str] = None
    # Accordion specific (items reused as list[AccordionItem])
    # Steps specific (items reused as list[StepItem])
    # Progress specific (items reused as list[ProgressItem])
    # Highlight specific
    color: Optional[Literal["yellow", "blue", "green", "pink"]] = None
    # Definition specific (items reused as list[DefinitionItem])
    # ProsСons specific
    pros: Optional[list[str]] = None
    cons: Optional[list[str]] = None
    # Video specific
    platform: Optional[Literal["youtube", "bilibili", "custom"]] = None
    # Divider specific
    dividerStyle: Optional[Literal["simple", "decorated", "text"]] = None
    # LinkCard specific
    url: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    # Rating specific (items reused as list[RatingItem])

    @model_validator(mode="before")
    @classmethod
    def convert_comparison_rows(cls, data):
        """
        只对 comparison 类型的 block 转换 rows 格式。
        ['label', 'val1', 'val2'] -> {'label': 'label', 'values': ['val1', 'val2']}
        table 类型的 rows 保持 string[][] 格式不变。
        """
        if not isinstance(data, dict):
            return data

        block_type = data.get("type")
        rows = data.get("rows")

        # 只对 comparison 类型进行转换
        if block_type == "comparison" and rows and isinstance(rows, list):
            converted = []
            for row in rows:
                if isinstance(row, list) and len(row) >= 1:
                    # 列表格式，转换为 ComparisonRow 格式
                    converted.append({
                        "label": str(row[0]),
                        "values": [str(val) for val in row[1:]]
                    })
                elif isinstance(row, dict):
                    # 已经是正确格式
                    converted.append(row)
                else:
                    # 其他情况，尝试转换
                    converted.append({"label": str(row), "values": []})
            data["rows"] = converted

        return data


class ArticleSection(BaseModel):
    title: str
    content: list[ContentBlock]


class ArticleMeta(BaseModel):
    author: Optional[str] = None
    date: Optional[str] = None
    readTime: Optional[str] = None


class ArticleData(BaseModel):
    title: str
    subtitle: Optional[str] = None
    meta: Optional[ArticleMeta] = None
    sections: list[ArticleSection]


# Task Model (stored in PocketBase)
class Task(BaseModel):
    id: Optional[str] = None
    url: str
    status: TaskStatus = "pending"
    result: Optional[ArticleData] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Response Models
class TaskResponse(BaseModel):
    id: str
    url: str
    status: TaskStatus
    result: Optional[ArticleData] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
