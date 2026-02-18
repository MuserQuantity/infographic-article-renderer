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
        logger.info(
            "Dify service initialized: base_url=%s user=%s api_key_set=%s",
            self.base_url,
            self.user,
            bool(self.api_key)
        )

    def is_configured(self) -> bool:
        configured = bool(self.base_url and self.api_key)
        if not configured:
            missing = []
            if not self.base_url:
                missing.append("DIFY_BASE_URL")
            if not self.api_key:
                missing.append("DIFY_API_KEY")
            logger.error("Dify is not configured. Missing: %s", ", ".join(missing))
        return configured

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"}

    async def upload_file(self, content: bytes, filename: str, content_type: Optional[str]) -> str:
        if not self.is_configured():
            raise Exception("Dify is not configured")

        logger.info(
            "Uploading file to Dify: filename=%s content_type=%s size_bytes=%s",
            filename,
            content_type or "application/octet-stream",
            len(content)
        )
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

        if response.status_code not in (200, 201):
            logger.error(
                "Dify upload failed: status=%s body=%s",
                response.status_code,
                response.text[:500]
            )
            raise Exception(f"Dify upload failed: {response.text}")

        payload = response.json()
        upload_id = payload.get("id")
        if not upload_id:
            raise Exception("Dify upload did not return file id")
        logger.info("Dify file uploaded successfully: upload_id=%s", upload_id)
        return upload_id

    async def run_workflow(self, inputs: dict) -> dict:
        if not self.is_configured():
            raise Exception("Dify is not configured")

        body = {
            "inputs": inputs,
            "response_mode": "blocking",
            "user": self.user
        }
        logger.info("Running Dify workflow with input keys: %s", list(inputs.keys()))

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{self.base_url}/v1/workflows/run",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=body
            )

        if response.status_code != 200:
            logger.error(
                "Dify workflow failed: status=%s body=%s",
                response.status_code,
                response.text[:500]
            )
            raise Exception(f"Dify workflow failed: {response.text}")

        payload = response.json()
        data = payload.get("data") or {}
        outputs = data.get("outputs") or {}
        logger.info(
            "Dify workflow succeeded: status=%s output_keys=%s",
            data.get("status"),
            list(outputs.keys()) if isinstance(outputs, dict) else []
        )
        return payload

    @staticmethod
    def _should_retry_with_file_array(error: Exception) -> bool:
        message = str(error).lower()
        return "must be a list" in message or "must be an array" in message

    async def _run_workflow_with_file_input(self, file_input: dict) -> dict:
        """
        Prefer single-file object for `file` variables.
        If workflow expects `array[file]`, retry with list wrapper.
        """
        try:
            return await self.run_workflow({"file": file_input})
        except Exception as error:
            if not self._should_retry_with_file_array(error):
                raise
            logger.info("Retrying Dify workflow with array[file] payload for key `file`")
            return await self.run_workflow({"file": [file_input]})

    def extract_text(self, payload: dict) -> str:
        data = payload.get("data") or {}
        status = data.get("status")
        if status and status != "succeeded":
            raise Exception(f"Dify workflow status: {status}")

        outputs = data.get("outputs") or {}
        text = outputs.get("text")
        if not text or not str(text).strip():
            logger.error(
                "Dify workflow returned empty text. output_keys=%s",
                list(outputs.keys()) if isinstance(outputs, dict) else []
            )
            raise Exception("Dify workflow returned empty text")

        logger.info("Dify text extracted successfully: length=%s", len(str(text).strip()))
        return str(text).strip()

    async def parse_file(self, content: bytes, filename: str, content_type: Optional[str]) -> str:
        upload_id = await self.upload_file(content, filename, content_type)
        payload = await self._run_workflow_with_file_input({
            "transfer_method": "local_file",
            "upload_file_id": upload_id,
            "type": "document"
        })
        return self.extract_text(payload)

    async def parse_url(self, url: str) -> str:
        payload = await self._run_workflow_with_file_input({
            "transfer_method": "remote_url",
            "url": url,
            "type": "document"
        })
        return self.extract_text(payload)


dify_service = DifyService()
