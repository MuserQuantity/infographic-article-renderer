import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models import (
    CreateTaskRequest,
    RefreshTaskRequest,
    TaskResponse,
    ErrorResponse
)
from app.services.database import db_service
from app.services.crawler import crawler_service
from app.services.llm import llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tasks"])


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

        # Step 3: Update task with result
        logger.info(f"[Task {task_id}] Step 3: Updating task with result...")
        await db_service.update_task_status(
            task_id,
            "completed",
            result=article_data
        )
        logger.info(f"[Task {task_id}] Task completed successfully!")

    except Exception as e:
        error_msg = str(e)
        # 记录详细错误到服务器日志
        logger.error(f"[Task {task_id}] Task failed with error: {error_msg}")

        # 将错误翻译为用户友好的中文提示
        try:
            friendly_error = await llm_service.translate_error(error_msg)
        except Exception:
            friendly_error = "处理过程中发生错误，请稍后重试"

        logger.info(f"[Task {task_id}] Translated error for user: {friendly_error}")

        # Update task with friendly error - 用额外的 try-except 确保不会再次失败
        try:
            await db_service.update_task_status(
                task_id,
                "failed",
                error=friendly_error
            )
            logger.info(f"[Task {task_id}] Task status updated to 'failed'")
        except Exception as update_error:
            logger.error(f"[Task {task_id}] Failed to update task status: {update_error}")


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
        return TaskResponse(
            id=existing_task.id,
            url=existing_task.url,
            status=existing_task.status,
            result=existing_task.result,
            error=existing_task.error,
            created_at=existing_task.created_at.isoformat() if existing_task.created_at else None,
            updated_at=existing_task.updated_at.isoformat() if existing_task.updated_at else None,
        )

    # Delete existing task if force refresh
    if existing_task and request.force_refresh:
        await db_service.delete_task(existing_task.id)

    # Create new task
    task = await db_service.create_task(url)

    # Start background processing
    background_tasks.add_task(process_task, task.id, url, request.translate_to_chinese)

    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
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

    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
    )


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
    if existing_task:
        await db_service.delete_task(existing_task.id)

    # Create new task
    task = await db_service.create_task(url)

    # Start background processing
    background_tasks.add_task(process_task, task.id, url, request.translate_to_chinese)

    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
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

    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
    )
