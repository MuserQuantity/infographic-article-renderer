import httpx
import hashlib
import logging
from typing import Optional
from urllib.parse import urlparse
from app.config import get_settings

logger = logging.getLogger(__name__)


class ImageService:
    """处理文章中的图片：下载并上传到 PocketBase 存储"""

    COLLECTION = "infographic_images"

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.pocketbase_url.rstrip("/")
        self.admin_email = settings.pocketbase_admin_email
        self.admin_password = settings.pocketbase_admin_password
        self.api_url = f"{self.base_url}/api/collections/{self.COLLECTION}/records"
        self._token: Optional[str] = None

    async def _get_auth_token(self) -> str:
        """获取 PocketBase 认证 token"""
        if self._token:
            return self._token

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

            response.raise_for_status()
            return ""

    def _get_file_extension(self, url: str, content_type: str = "") -> str:
        """从 URL 或 Content-Type 获取文件扩展名"""
        # 从 URL 路径获取扩展名
        parsed = urlparse(url)
        path = parsed.path.lower()
        for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']:
            if path.endswith(ext):
                return ext

        # 从 Content-Type 获取
        content_type = content_type.lower()
        if 'jpeg' in content_type or 'jpg' in content_type:
            return '.jpg'
        elif 'png' in content_type:
            return '.png'
        elif 'gif' in content_type:
            return '.gif'
        elif 'webp' in content_type:
            return '.webp'
        elif 'svg' in content_type:
            return '.svg'

        return '.jpg'  # 默认

    async def download_and_upload_image(self, image_url: str) -> Optional[str]:
        """
        下载图片并上传到 PocketBase，返回新的 URL
        如果失败返回 None
        """
        try:
            # 跳过已经是 PocketBase 的 URL
            if self.base_url in image_url:
                logger.debug(f"Image already on PocketBase: {image_url}")
                return image_url

            # 跳过 data URL
            if image_url.startswith('data:'):
                logger.debug(f"Skipping data URL")
                return image_url

            logger.info(f"Downloading image: {image_url[:100]}...")

            # 下载图片
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    image_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                        "Accept": "image/*,*/*",
                    }
                )

                if response.status_code != 200:
                    logger.warning(f"Failed to download image: {response.status_code}")
                    return None

                image_data = response.content
                content_type = response.headers.get("content-type", "")

                # 检查是否是有效的图片
                if len(image_data) < 100:
                    logger.warning(f"Image too small, might be invalid")
                    return None

            # 生成文件名（使用 URL hash）
            url_hash = hashlib.md5(image_url.encode()).hexdigest()[:12]
            extension = self._get_file_extension(image_url, content_type)
            filename = f"{url_hash}{extension}"

            # 上传到 PocketBase
            token = await self._get_auth_token()

            async with httpx.AsyncClient(timeout=30.0) as client:
                # 使用 multipart form 上传
                files = {
                    "image": (filename, image_data, content_type or "image/jpeg")
                }
                data = {
                    "original_url": image_url[:500]  # 保存原始 URL（限制长度）
                }

                response = await client.post(
                    self.api_url,
                    headers={"Authorization": f"Bearer {token}"},
                    files=files,
                    data=data
                )

                if response.status_code in (200, 201):
                    record = response.json()
                    record_id = record.get("id")
                    image_filename = record.get("image")

                    if record_id and image_filename:
                        # 构建 PocketBase 文件 URL
                        new_url = f"{self.base_url}/api/files/{self.COLLECTION}/{record_id}/{image_filename}"
                        logger.info(f"Image uploaded successfully: {new_url}")
                        return new_url

                logger.warning(f"Failed to upload image: {response.status_code} - {response.text[:200]}")
                return None

        except Exception as e:
            logger.error(f"Error processing image {image_url[:50]}: {e}")
            return None

    async def process_article_images(self, article_data: dict) -> dict:
        """
        处理文章中的所有图片，上传到 PocketBase 并替换 URL
        """
        if not article_data or "sections" not in article_data:
            return article_data

        processed_count = 0
        failed_count = 0

        for section in article_data.get("sections", []):
            for block in section.get("content", []):
                # 处理 image 类型的 block
                if block.get("type") == "image" and block.get("src"):
                    original_src = block["src"]
                    new_src = await self.download_and_upload_image(original_src)

                    if new_src and new_src != original_src:
                        block["src"] = new_src
                        processed_count += 1
                    elif new_src is None:
                        failed_count += 1

                # 处理 linkcard 类型的 block（可能有图片）
                elif block.get("type") == "linkcard" and block.get("image"):
                    original_image = block["image"]
                    new_image = await self.download_and_upload_image(original_image)

                    if new_image and new_image != original_image:
                        block["image"] = new_image
                        processed_count += 1
                    elif new_image is None:
                        failed_count += 1

        logger.info(f"Image processing complete: {processed_count} uploaded, {failed_count} failed")
        return article_data


image_service = ImageService()
