from pydantic import BaseModel, HttpUrl
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


class ContentBlock(BaseModel):
    type: Literal[
        "paragraph", "list", "quote", "callout", "grid",
        "image", "stat", "tags", "timeline", "comparison", "table"
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
    # Comparison specific
    rows: Optional[list[ComparisonRow]] = None
    # Table specific
    headers: Optional[list[str]] = None


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
