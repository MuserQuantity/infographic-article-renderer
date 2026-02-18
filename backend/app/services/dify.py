import logging
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class DifyService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.dify_base_url.rstrip("/")
        self.api_key = settings.dify_api_key
        self.user = settings.dify_user

    def is_configured(self) -> bool:
        return bool(self.base_url and self.api_key)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"}

    async def upload_file(self, content: bytes, filename: str, content_type: Optional[str]) -> str:
        if not self.is_configured():
            raise Exception("Dify is not configured")

        files = {
            "file": (filename, content, content_type or "application/octet-stream")
        }
        data = {"user": self.user}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/v1/files/upload",
                headers=self._headers(),
                data=data,
                files=files
            )

        if response.status_code != 200:
            raise Exception(f"Dify upload failed: {response.text}")

        payload = response.json()
        upload_id = payload.get("id")
        if not upload_id:
            raise Exception("Dify upload did not return file id")
        return upload_id

    async def run_workflow(self, inputs: dict) -> dict:
        if not self.is_configured():
            raise Exception("Dify is not configured")

        body = {
            "inputs": inputs,
            "response_mode": "blocking",
            "user": self.user
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{self.base_url}/v1/workflows/run",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=body
            )

        if response.status_code != 200:
            raise Exception(f"Dify workflow failed: {response.text}")

        return response.json()

    def extract_text(self, payload: dict) -> str:
        data = payload.get("data") or {}
        status = data.get("status")
        if status and status != "succeeded":
            raise Exception(f"Dify workflow status: {status}")

        outputs = data.get("outputs") or {}
        text = outputs.get("text")
        if not text or not str(text).strip():
            raise Exception("Dify workflow returned empty text")

        return str(text).strip()

    async def parse_file(self, content: bytes, filename: str, content_type: Optional[str]) -> str:
        upload_id = await self.upload_file(content, filename, content_type)
        payload = await self.run_workflow({
            "file": [
                {
                    "transfer_method": "local_file",
                    "upload_file_id": upload_id,
                    "type": "document"
                }
            ]
        })
        return self.extract_text(payload)

    async def parse_url(self, url: str) -> str:
        payload = await self.run_workflow({
            "file": {
                "transfer_method": "remote_url",
                "url": url,
                "type": "document"
            }
        })
        return self.extract_text(payload)


dify_service = DifyService()
