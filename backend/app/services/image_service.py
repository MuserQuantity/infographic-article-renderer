import httpx
import hashlib
import logging
import io
from typing import Optional, Tuple
from urllib.parse import urlparse
from PIL import Image
from app.config import get_settings

logger = logging.getLogger(__name__)


class ImageService:
    """处理文章中的图片：下载、压缩并上传到 PocketBase 存储"""

    COLLECTION = "infographic_images"

    # 压缩配置
    MAX_WIDTH = 1920  # 最大宽度
    MAX_HEIGHT = 1920  # 最大高度
    JPEG_QUALITY = 85  # JPEG 压缩质量 (1-100)
    PNG_COMPRESS_LEVEL = 6  # PNG 压缩级别 (0-9)

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

    def _compress_image(self, image_data: bytes, content_type: str) -> Tuple[bytes, str, str]:
        """
        压缩图片，返回 (压缩后的数据, 新的content_type, 新的扩展名)
        """
        try:
            # 打开图片
            img = Image.open(io.BytesIO(image_data))
            original_size = len(image_data)

            # 跳过 SVG 和 GIF（动图）
            if content_type and ('svg' in content_type.lower() or 'gif' in content_type.lower()):
                logger.debug("Skipping compression for SVG/GIF")
                return image_data, content_type, self._get_file_extension("", content_type)

            # 如果是 GIF 且有多帧，跳过压缩
            if getattr(img, 'n_frames', 1) > 1:
                logger.debug("Skipping compression for animated image")
                return image_data, content_type, self._get_file_extension("", content_type)

            # 转换模式（如果需要）
            if img.mode in ('RGBA', 'LA', 'P'):
                # 有透明通道，保存为 PNG
                output_format = 'PNG'
                new_content_type = 'image/png'
                new_extension = '.png'
            else:
                # 转换为 RGB，保存为 JPEG（压缩效果更好）
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                output_format = 'JPEG'
                new_content_type = 'image/jpeg'
                new_extension = '.jpg'

            # 调整尺寸（如果超过最大值）
            width, height = img.size
            if width > self.MAX_WIDTH or height > self.MAX_HEIGHT:
                ratio = min(self.MAX_WIDTH / width, self.MAX_HEIGHT / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")

            # 压缩并保存到内存
            output = io.BytesIO()
            if output_format == 'JPEG':
                img.save(output, format='JPEG', quality=self.JPEG_QUALITY, optimize=True)
            else:
                img.save(output, format='PNG', optimize=True, compress_level=self.PNG_COMPRESS_LEVEL)

            compressed_data = output.getvalue()
            compressed_size = len(compressed_data)

            # 只有压缩后更小才使用压缩版本
            if compressed_size < original_size:
                ratio = (1 - compressed_size / original_size) * 100
                logger.info(f"Image compressed: {original_size} -> {compressed_size} bytes ({ratio:.1f}% smaller)")
                return compressed_data, new_content_type, new_extension
            else:
                logger.debug(f"Compression not effective, using original")
                return image_data, content_type, self._get_file_extension("", content_type)

        except Exception as e:
            logger.warning(f"Failed to compress image: {e}")
            return image_data, content_type, self._get_file_extension("", content_type)

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

            # 压缩图片
            image_data, content_type, extension = self._compress_image(image_data, content_type)

            # 生成文件名（使用 URL hash）
            url_hash = hashlib.md5(image_url.encode()).hexdigest()[:12]
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
