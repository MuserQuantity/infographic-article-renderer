import logging
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from app.models import (
    ArticleData,
    CreateTaskRequest,
    CreateTextTaskRequest,
    RefreshTaskRequest,
    Task,
    TaskResponse,
    TaskListItem,
    TaskListResponse,
    ErrorResponse
)
from app.services.database import db_service
from app.services.crawler import crawler_service
from app.services.llm import llm_service
from app.services.image_service import image_service
from app.services.dify import dify_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tasks"])
MANUAL_URL_PREFIX = "https://manual.local/"


def build_manual_url() -> str:
    return f"{MANUAL_URL_PREFIX}{uuid.uuid4().hex}"


def task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        url=task.url,
        status=task.status,
        source_type=task.source_type,
        result=task.result,
        error=task.error,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
    )


def task_to_list_item(task: Task) -> TaskListItem:
    return TaskListItem(
        id=task.id,
        url=task.url,
        status=task.status,
        source_type=task.source_type,
        title=task.result.title if task.result else None,
        subtitle=task.result.subtitle if task.result else None,
        meta=task.result.meta if task.result else None,
        created_at=task.created_at.isoformat() if task.created_at else None,
        updated_at=task.updated_at.isoformat() if task.updated_at else None,
    )

async def process_article_images(article_data: ArticleData) -> ArticleData:
    article_dict = article_data.model_dump()
    article_dict = await image_service.process_article_images(article_dict)
    return ArticleData(**article_dict)

async def handle_task_failure(task_id: str, error: Exception):
    error_id = uuid.uuid4().hex[:8]
    error_msg = str(error)
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


async def create_and_start_task(
    url: str,
    translate_to_chinese: bool,
    background_tasks: BackgroundTasks,
    existing_task: Task | None = None,
    delete_existing: bool = False
) -> TaskResponse:
    if delete_existing and existing_task:
        await db_service.delete_task(existing_task.id)

    task = await db_service.create_task(url, source_type="url")
    background_tasks.add_task(process_task, task.id, url, translate_to_chinese)
    return task_to_response(task)


async def create_and_start_text_task(
    text: str,
    translate_to_chinese: bool,
    background_tasks: BackgroundTasks,
    source_url: str | None = None
) -> TaskResponse:
    task_url = source_url or build_manual_url()
    task = await db_service.create_task(task_url, source_type="text")
    background_tasks.add_task(process_text_task, task.id, text, translate_to_chinese)
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
        article_data = await process_article_images(article_data)
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
        await handle_task_failure(task_id, e)


async def process_text_task(task_id: str, text: str, translate_to_chinese: bool = True):
    """Background task to convert manual text content to article JSON."""
    logger.info(f"[Task {task_id}] Starting processing for manual text, length: {len(text)}")
    try:
        logger.info(f"[Task {task_id}] Updating status to 'processing'")
        await db_service.update_task_status(task_id, "processing")

        logger.info(f"[Task {task_id}] Step 1: Converting manual content to article JSON using LLM...")
        article_data = await llm_service.convert_to_article_json(text, translate_to_chinese)
        logger.info(f"[Task {task_id}] LLM conversion completed successfully")

        logger.info(f"[Task {task_id}] Step 2: Processing images...")
        article_data = await process_article_images(article_data)
        logger.info(f"[Task {task_id}] Image processing completed")

        logger.info(f"[Task {task_id}] Step 3: Updating task with result...")
        await db_service.update_task_status(
            task_id,
            "completed",
            result=article_data
        )
        logger.info(f"[Task {task_id}] Task completed successfully!")

    except Exception as e:
        await handle_task_failure(task_id, e)

async def process_dify_task(
    task_id: str,
    translate_to_chinese: bool,
    file_content: bytes | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
    source_url: str | None = None
):
    """Background task to parse a document via Dify and convert to article JSON."""
    logger.info(f"[Task {task_id}] Starting Dify processing")
    try:
        logger.info(f"[Task {task_id}] Updating status to 'processing'")
        await db_service.update_task_status(task_id, "processing")

        if file_content:
            logger.info(f"[Task {task_id}] Step 1: Uploading file to Dify")
            text = await dify_service.parse_file(
                file_content,
                file_name or "document",
                file_type
            )
        elif source_url:
            logger.info(f"[Task {task_id}] Step 1: Parsing URL via Dify")
            text = await dify_service.parse_url(source_url)
        else:
            raise Exception("No file or URL provided for Dify parsing")

        logger.info(f"[Task {task_id}] Step 2: Converting Dify output to article JSON")
        article_data = await llm_service.convert_to_article_json(text, translate_to_chinese)

        logger.info(f"[Task {task_id}] Step 3: Processing images")
        article_data = await process_article_images(article_data)

        logger.info(f"[Task {task_id}] Step 4: Updating task with result")
        await db_service.update_task_status(
            task_id,
            "completed",
            result=article_data
        )
        logger.info(f"[Task {task_id}] Task completed successfully!")

    except Exception as e:
        await handle_task_failure(task_id, e)


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
    """Create a new task from manual text input."""
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    return await create_and_start_text_task(
        text,
        request.translate_to_chinese,
        background_tasks,
        source_url=str(request.source_url) if request.source_url else None
    )

@router.post(
    "/tasks/dify",
    response_model=TaskResponse,
    responses={400: {"model": ErrorResponse}}
)
async def create_dify_task(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    translate_to_chinese: bool = Form(default=True)
):
    """Create a new task from a document parsed by Dify workflow."""
    if not dify_service.is_configured():
        raise HTTPException(status_code=500, detail="Dify configuration is missing")

    source_url = url.strip() if url else None
    if file and source_url:
        raise HTTPException(status_code=400, detail="Provide either file or url, not both")
    if not file and not source_url:
        raise HTTPException(status_code=400, detail="File or URL is required")

    file_content = None
    file_name = None
    file_type = None
    if file:
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        file_name = file.filename or "document"
        file_type = file.content_type

    task_url = source_url or build_manual_url()
    task = await db_service.create_task(task_url, source_type="dify")

    background_tasks.add_task(
        process_dify_task,
        task.id,
        translate_to_chinese,
        file_content,
        file_name,
        file_type,
        source_url
    )
    return task_to_response(task)


@router.get(
    "/tasks",
    response_model=TaskListResponse
)
async def list_tasks(page: int = 1, per_page: int = 12):
    """List completed tasks with pagination, sorted by newest first."""
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if per_page < 1 or per_page > 50:
        raise HTTPException(status_code=400, detail="per_page must be between 1 and 50")

    tasks, total_items, total_pages = await db_service.list_tasks(
        page=page,
        per_page=per_page,
        status="completed"
    )
    return TaskListResponse(
        items=[task_to_list_item(task) for task in tasks],
        page=page,
        per_page=per_page,
        total_items=total_items,
        total_pages=total_pages
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
