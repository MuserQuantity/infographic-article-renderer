import logging
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models import (
    CreateTaskRequest,
    CreateTextTaskRequest,
    RefreshTaskRequest,
    Task,
    TaskResponse,
    ErrorResponse
)
from app.services.database import db_service
from app.services.crawler import crawler_service
from app.services.llm import llm_service
from app.services.image_service import image_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tasks"])

def task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
    )


async def create_and_start_task(
    url: str,
    translate_to_chinese: bool,
    background_tasks: BackgroundTasks,
    existing_task: Task | None = None,
    delete_existing: bool = False
) -> TaskResponse:
    if delete_existing and existing_task:
        await db_service.delete_task(existing_task.id)

    task = await db_service.create_task(url)
    background_tasks.add_task(process_task, task.id, url, translate_to_chinese)
    return task_to_response(task)


async def create_and_start_text_task(
    content: str,
    translate_to_chinese: bool,
    background_tasks: BackgroundTasks
) -> TaskResponse:
    manual_url = f"https://manual.local/{uuid.uuid4().hex}"
    task = await db_service.create_task(manual_url)
    background_tasks.add_task(process_text_task, task.id, content, translate_to_chinese)
    return task_to_response(task)


async def process_task(task_id: str, url: str, translate_to_chinese: bool = True):
    """Background task to crawl URL and convert to article JSON."""
    logger.info(f"[Task {task_id}] Starting processing for URL: {url}")
    try:
        # Update status to processing
        logger.info(f"[Task {task_id}] Updating status to 'processing'")
        await db_service.update_task_status(task_id, "processing")

        # Step 1: Crawl the URL
        logger.info(f"[Task {task_id}] Step 1: Crawling URL...")
        markdown_content = await crawler_service.crawl_url(url)
        logger.info(f"[Task {task_id}] Crawl completed, content length: {len(markdown_content)}")

        # Step 2: Convert to article JSON using LLM
        logger.info(f"[Task {task_id}] Step 2: Converting to article JSON using LLM...")
        article_data = await llm_service.convert_to_article_json(markdown_content, translate_to_chinese)
        logger.info(f"[Task {task_id}] LLM conversion completed successfully")

        # Step 3: Process images (download and upload to PocketBase)
        logger.info(f"[Task {task_id}] Step 3: Processing images...")
        article_dict = article_data.model_dump()
        article_dict = await image_service.process_article_images(article_dict)
        # 重新创建 ArticleData 对象
        from app.models import ArticleData
        article_data = ArticleData(**article_dict)
        logger.info(f"[Task {task_id}] Image processing completed")

        # Step 4: Update task with result
        logger.info(f"[Task {task_id}] Step 4: Updating task with result...")
        await db_service.update_task_status(
            task_id,
            "completed",
            result=article_data
        )
        logger.info(f"[Task {task_id}] Task completed successfully!")

    except Exception as e:
        error_id = uuid.uuid4().hex[:8]
        error_msg = str(e)
        # 记录详细错误到服务器日志
        logger.exception(f"[Task {task_id}] Task failed (error_id={error_id})")
        logger.error(f"[Task {task_id}] Raw error for error_id={error_id}: {error_msg}")

        # 将错误翻译为用户友好的中文提示
        try:
            friendly_error = await llm_service.translate_error(error_msg)
        except Exception:
            friendly_error = "处理过程中发生错误，请稍后重试"

        friendly_error_with_id = f"{friendly_error}（错误ID: {error_id}）"
        logger.info(f"[Task {task_id}] Translated error for user: {friendly_error_with_id}")

        # Update task with friendly error - 用额外的 try-except 确保不会再次失败
        try:
            await db_service.update_task_status(
                task_id,
                "failed",
                error=friendly_error_with_id
            )
            logger.info(f"[Task {task_id}] Task status updated to 'failed'")
        except Exception as update_error:
            logger.exception(
                f"[Task {task_id}] Failed to update task status (error_id={error_id}): {update_error}"
            )


async def process_text_task(task_id: str, content: str, translate_to_chinese: bool = True):
    """Background task to convert manual text content to article JSON."""
    logger.info(f"[Task {task_id}] Starting processing for manual text input")
    try:
        logger.info(f"[Task {task_id}] Updating status to 'processing'")
        await db_service.update_task_status(task_id, "processing")

        logger.info(f"[Task {task_id}] Step 1: Converting manual content to article JSON using LLM...")
        article_data = await llm_service.convert_to_article_json(content, translate_to_chinese)
        logger.info(f"[Task {task_id}] LLM conversion completed successfully")

        logger.info(f"[Task {task_id}] Step 2: Processing images...")
        article_dict = article_data.model_dump()
        article_dict = await image_service.process_article_images(article_dict)
        from app.models import ArticleData
        article_data = ArticleData(**article_dict)
        logger.info(f"[Task {task_id}] Image processing completed")

        logger.info(f"[Task {task_id}] Step 3: Updating task with result...")
        await db_service.update_task_status(
            task_id,
            "completed",
            result=article_data
        )
        logger.info(f"[Task {task_id}] Task completed successfully!")

    except Exception as e:
        error_id = uuid.uuid4().hex[:8]
        error_msg = str(e)
        logger.exception(f"[Task {task_id}] Task failed (error_id={error_id})")
        logger.error(f"[Task {task_id}] Raw error for error_id={error_id}: {error_msg}")

        try:
            friendly_error = await llm_service.translate_error(error_msg)
        except Exception:
            friendly_error = "处理过程中发生错误，请稍后重试"

        friendly_error_with_id = f"{friendly_error}（错误ID: {error_id}）"
        logger.info(f"[Task {task_id}] Translated error for user: {friendly_error_with_id}")

        try:
            await db_service.update_task_status(
                task_id,
                "failed",
                error=friendly_error_with_id
            )
            logger.info(f"[Task {task_id}] Task status updated to 'failed'")
        except Exception as update_error:
            logger.exception(
                f"[Task {task_id}] Failed to update task status (error_id={error_id}): {update_error}"
            )


@router.post(
    "/tasks",
    response_model=TaskResponse,
    responses={400: {"model": ErrorResponse}}
)
async def create_task(
    request: CreateTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a new crawling task.

    - If the URL already exists and force_refresh is False, return existing task
    - If force_refresh is True, delete existing task and create new one
    """
    url = str(request.url)

    # Check if task already exists
    existing_task = await db_service.get_task_by_url(url)

    if existing_task and not request.force_refresh:
        # Return existing task
        return task_to_response(existing_task)

    # Delete existing task if force refresh
    return await create_and_start_task(
        url,
        request.translate_to_chinese,
        background_tasks,
        existing_task=existing_task,
        delete_existing=request.force_refresh
    )


@router.post(
    "/tasks/text",
    response_model=TaskResponse,
    responses={400: {"model": ErrorResponse}}
)
async def create_text_task(
    request: CreateTextTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a new task from manual text input.
    """
    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")

    return await create_and_start_text_task(
        content,
        request.translate_to_chinese,
        background_tasks
    )


@router.get(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    responses={404: {"model": ErrorResponse}}
)
async def get_task(task_id: str):
    """Get task status and result by ID."""
    task = await db_service.get_task_by_id(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task_to_response(task)


@router.post(
    "/tasks/refresh",
    response_model=TaskResponse,
    responses={400: {"model": ErrorResponse}}
)
async def refresh_task(
    request: RefreshTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    Force refresh a task by URL.

    This will delete any existing task for the URL and create a new one.
    """
    url = str(request.url)

    # Delete existing task if exists
    existing_task = await db_service.get_task_by_url(url)

    return await create_and_start_task(
        url,
        request.translate_to_chinese,
        background_tasks,
        existing_task=existing_task,
        delete_existing=True
    )


@router.get(
    "/tasks/url/{url:path}",
    response_model=TaskResponse,
    responses={404: {"model": ErrorResponse}}
)
async def get_task_by_url(url: str):
    """Get task by URL."""
    task = await db_service.get_task_by_url(url)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found for this URL")

    return task_to_response(task)
