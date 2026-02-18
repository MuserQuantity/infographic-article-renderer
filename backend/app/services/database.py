import httpx
from urllib.parse import quote
from typing import Optional
from datetime import datetime
from app.config import get_settings
from app.models import Task, ArticleData, TaskStatus, TaskSourceType

MANUAL_URL_PREFIX = "https://manual.local/"
BILIBILI_VIDEO_PREFIX = "https://www.bilibili.com/video/"


def fix_comparison_rows_in_result(data: dict) -> dict:
    """
    修正数据库中存储的旧格式 comparison rows。
    将列表格式 ['label', 'val1', 'val2'] 转换为对象格式 {'label': 'label', 'values': ['val1', 'val2']}
    并保证每行 values 与 columns 长度一致，不足补 "—"。
    只对 comparison 类型的 block 进行修复，table 类型的 rows 保持 string[][] 格式。
    """
    if not data or "sections" not in data:
        return data

    for section in data.get("sections", []):
        for block in section.get("content", []):
            block_type = block.get("type", "")
            # 只对 comparison 类型的 block 进行修复
            if block_type == "comparison" and "rows" in block and block["rows"]:
                columns = block.get("columns") or []
                if not isinstance(columns, list):
                    columns = [columns]
                expected_values_count = len([str(col).strip() for col in columns if str(col).strip()])

                fixed_rows = []
                needs_fix = False
                for row in block["rows"]:
                    if isinstance(row, list):
                        # 列表格式，需要转换
                        needs_fix = True
                        if len(row) >= 1:
                            label = str(row[0]).strip()
                            values = [str(v).strip() if v is not None else "" for v in row[1:]]
                        else:
                            label = ""
                            values = []

                        normalized_values = [value if value else "—" for value in values]
                        if expected_values_count > 0:
                            normalized_values = normalized_values[:expected_values_count]
                            while len(normalized_values) < expected_values_count:
                                normalized_values.append("—")
                        elif not normalized_values:
                            normalized_values = ["—"]

                        fixed_rows.append({"label": label, "values": normalized_values})
                    elif isinstance(row, dict):
                        # 已经是正确的对象格式
                        label = str(row.get("label", "")).strip()
                        values = row.get("values") or []
                        if not isinstance(values, list):
                            values = [values]
                            needs_fix = True

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

                        fixed_rows.append({"label": label, "values": normalized_values})
                    else:
                        needs_fix = True
                        normalized_values = ["—"] * expected_values_count if expected_values_count > 0 else ["—"]
                        fixed_rows.append({"label": str(row).strip(), "values": normalized_values})

                if needs_fix or fixed_rows != block["rows"]:
                    block["rows"] = fixed_rows

    return data


class PocketBaseService:
    """PocketBase database service for task management."""

    COLLECTION = "infographic_tasks"

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.pocketbase_url.rstrip("/")
        self.admin_email = settings.pocketbase_admin_email
        self.admin_password = settings.pocketbase_admin_password
        self.api_url = f"{self.base_url}/api/collections/{self.COLLECTION}/records"
        self._token: Optional[str] = None

    async def _get_auth_token(self) -> str:
        """Get admin auth token from PocketBase."""
        if self._token:
            return self._token

        # Try new API (v0.23+) first, then old API
        auth_endpoints = [
            f"{self.base_url}/api/collections/_superusers/auth-with-password",
            f"{self.base_url}/api/admins/auth-with-password",
        ]

        async with httpx.AsyncClient() as client:
            for endpoint in auth_endpoints:
                response = await client.post(
                    endpoint,
                    json={
                        "identity": self.admin_email,
                        "password": self.admin_password
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    self._token = data.get("token")
                    return self._token

            # If all endpoints failed, raise error
            response.raise_for_status()
            return ""

    async def _get_headers(self) -> dict:
        """Get request headers with auth token."""
        token = await self._get_auth_token()
        return {"Authorization": f"Bearer {token}"}

    async def _request(
        self,
        method: str,
        url: str,
        json_data: Optional[dict] = None
    ) -> dict:
        """Make HTTP request to PocketBase with authentication."""
        headers = await self._get_headers()

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                json=json_data,
                headers=headers,
                timeout=30.0
            )

            # If token expired or forbidden, refresh and retry
            if response.status_code in (401, 403):
                self._token = None
                headers = await self._get_headers()
                response = await client.request(
                    method=method,
                    url=url,
                    json=json_data,
                    headers=headers,
                    timeout=30.0
                )

            response.raise_for_status()
            return response.json() if response.content else {}

    def _parse_task(self, record: dict) -> Task:
        """Parse PocketBase record to Task model."""
        result_data = None
        if record.get("result"):
            # 修正数据库中可能存在的旧格式 comparison rows
            fixed_result = fix_comparison_rows_in_result(record["result"])
            result_data = ArticleData(**fixed_result)

        source_type = record.get("source_type")
        if source_type not in ("url", "text", "dify"):
            url = record.get("url", "")
            if url.startswith(MANUAL_URL_PREFIX) or url.startswith(BILIBILI_VIDEO_PREFIX):
                source_type = "text"
            else:
                source_type = "url"

        return Task(
            id=record.get("id"),
            url=record.get("url", ""),
            status=record.get("status", "pending"),
            source_type=source_type,
            result=result_data,
            error=record.get("error"),
            created_at=datetime.fromisoformat(record["created"].replace("Z", "+00:00")) if record.get("created") else None,
            updated_at=datetime.fromisoformat(record["updated"].replace("Z", "+00:00")) if record.get("updated") else None,
        )

    async def get_task_by_url(self, url: str) -> Optional[Task]:
        """Find a task by URL."""
        try:
            # URL 编码 filter 查询参数
            filter_query = quote(f'url="{url}"', safe='')
            response = await self._request(
                "GET",
                f"{self.api_url}?filter={filter_query}&sort=-created"
            )
            items = response.get("items", [])
            if items:
                return self._parse_task(items[0])
            return None
        except httpx.HTTPStatusError:
            return None
        except Exception:
            # 捕获所有异常，避免查询失败导致重复创建
            return None

    async def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        try:
            response = await self._request("GET", f"{self.api_url}/{task_id}")
            return self._parse_task(response)
        except httpx.HTTPStatusError:
            return None

    async def list_tasks(
        self,
        page: int = 1,
        per_page: int = 12,
        status: Optional[TaskStatus] = None
    ) -> tuple[list[Task], int, int]:
        """List tasks with pagination, optionally filtered by status."""
        try:
            params = [f"page={page}", f"perPage={per_page}", "sort=-created"]
            if status:
                filter_query = quote(f'status="{status}"', safe="")
                params.append(f"filter={filter_query}")
            url = f"{self.api_url}?{'&'.join(params)}"
            response = await self._request("GET", url)
            items = response.get("items", [])
            tasks = [self._parse_task(item) for item in items]
            total_items = int(response.get("totalItems", len(tasks)))
            total_pages = int(response.get("totalPages", 1))
            return tasks, total_items, total_pages
        except httpx.HTTPStatusError:
            return [], 0, 0
        except Exception:
            return [], 0, 0

    async def create_task(self, url: str, source_type: TaskSourceType = "url") -> Task:
        """Create a new task."""
        data = {
            "url": url,
            "status": "pending",
            "source_type": source_type,
            "result": None,
            "error": None
        }
        try:
            response = await self._request("POST", self.api_url, json_data=data)
            return self._parse_task(response)
        except httpx.HTTPStatusError as e:
            # 如果是 400 错误，可能是 URL 已存在，尝试查询并返回
            if e.response.status_code == 400:
                error_text = e.response.text or ""
                if "source_type" in error_text:
                    fallback_data = {key: value for key, value in data.items() if key != "source_type"}
                    response = await self._request("POST", self.api_url, json_data=fallback_data)
                    return self._parse_task(response)
                existing = await self.get_task_by_url(url)
                if existing:
                    return existing
            raise

    async def update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        result: Optional[ArticleData] = None,
        error: Optional[str] = None
    ) -> Task:
        """Update task status and result."""
        data = {"status": status}

        if result is not None:
            data["result"] = result.model_dump()

        if error is not None:
            data["error"] = error

        response = await self._request(
            "PATCH",
            f"{self.api_url}/{task_id}",
            json_data=data
        )
        return self._parse_task(response)

    async def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        try:
            await self._request("DELETE", f"{self.api_url}/{task_id}")
            return True
        except httpx.HTTPStatusError:
            return False


db_service = PocketBaseService()
