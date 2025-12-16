#!/usr/bin/env python3
"""
Initialize PocketBase collection for tasks.
Run this once after setting up PocketBase.

Usage:
    cd backend
    python scripts/init_pocketbase.py
"""

import httpx
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root directory
root_dir = Path(__file__).parent.parent.parent
env_file = root_dir / ".env"

if env_file.exists():
    load_dotenv(env_file)
    print(f"Loaded .env from {env_file}")
else:
    print(f"Warning: .env file not found at {env_file}")
    print("Please create .env file with PocketBase credentials.")
    sys.exit(1)

# Get config from environment
POCKETBASE_URL = os.getenv("POCKETBASE_URL", "").rstrip("/")
POCKETBASE_ADMIN_EMAIL = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
POCKETBASE_ADMIN_PASSWORD = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")

if not all([POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD]):
    print("Error: Missing required environment variables:")
    print("  - POCKETBASE_URL")
    print("  - POCKETBASE_ADMIN_EMAIL")
    print("  - POCKETBASE_ADMIN_PASSWORD")
    sys.exit(1)


def init_pocketbase():
    # 1. Authenticate as admin (try new API first, then old API)
    print(f"Connecting to PocketBase at {POCKETBASE_URL}...")

    auth_endpoints = [
        # PocketBase v0.23+ (superusers)
        f"{POCKETBASE_URL}/api/collections/_superusers/auth-with-password",
        # PocketBase < v0.23 (admins)
        f"{POCKETBASE_URL}/api/admins/auth-with-password",
    ]

    auth_response = None
    for endpoint in auth_endpoints:
        try:
            auth_response = httpx.post(
                endpoint,
                json={
                    "identity": POCKETBASE_ADMIN_EMAIL,
                    "password": POCKETBASE_ADMIN_PASSWORD
                },
                timeout=30.0
            )
            if auth_response.status_code == 200:
                break
        except httpx.ConnectError as e:
            print(f"Failed to connect to PocketBase: {e}")
            sys.exit(1)

    if not auth_response or auth_response.status_code != 200:
        print(f"Failed to authenticate: {auth_response.text if auth_response else 'No response'}")
        sys.exit(1)

    token = auth_response.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Authenticated successfully.")

    # 2. Check if collection exists
    collections_response = httpx.get(
        f"{POCKETBASE_URL}/api/collections",
        headers=headers,
        timeout=30.0
    )

    existing_collections = [c["name"] for c in collections_response.json().get("items", [])]

    # 3. Create infographic_tasks collection if not exists
    if "infographic_tasks" not in existing_collections:
        print("Creating 'infographic_tasks' collection...")
        tasks_schema = {
            "name": "infographic_tasks",
            "type": "base",
            "schema": [
                {
                    "name": "url",
                    "type": "url",
                    "required": True,
                    "options": {
                        "exceptDomains": [],
                        "onlyDomains": []
                    }
                },
                {
                    "name": "status",
                    "type": "select",
                    "required": True,
                    "options": {
                        "maxSelect": 1,
                        "values": ["pending", "processing", "completed", "failed"]
                    }
                },
                {
                    "name": "result",
                    "type": "json",
                    "required": False,
                    "options": {
                        "maxSize": 5242880
                    }
                },
                {
                    "name": "error",
                    "type": "text",
                    "required": False,
                    "options": {
                        "min": None,
                        "max": 10000,
                        "pattern": ""
                    }
                }
            ],
            "indexes": [
                "CREATE INDEX idx_infographic_tasks_url ON infographic_tasks (url)",
                "CREATE INDEX idx_infographic_tasks_status ON infographic_tasks (status)"
            ],
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": ""
        }

        create_response = httpx.post(
            f"{POCKETBASE_URL}/api/collections",
            json=tasks_schema,
            headers=headers,
            timeout=30.0
        )

        if create_response.status_code in [200, 201]:
            print("Collection 'infographic_tasks' created successfully!")
        else:
            print(f"Failed to create collection: {create_response.text}")
    else:
        print("Collection 'infographic_tasks' already exists. Skipping.")

    # 4. Create infographic_images collection for image storage
    if "infographic_images" not in existing_collections:
        print("Creating 'infographic_images' collection...")
        images_schema = {
            "name": "infographic_images",
            "type": "base",
            "schema": [
                {
                    "name": "image",
                    "type": "file",
                    "required": True,
                    "options": {
                        "maxSelect": 1,
                        "maxSize": 10485760,  # 10MB
                        "mimeTypes": [
                            "image/jpeg",
                            "image/png",
                            "image/gif",
                            "image/webp",
                            "image/svg+xml"
                        ],
                        "thumbs": ["100x100", "300x300"]
                    }
                },
                {
                    "name": "original_url",
                    "type": "text",
                    "required": False,
                    "options": {
                        "min": None,
                        "max": 2000,
                        "pattern": ""
                    }
                }
            ],
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": ""
        }

        create_response = httpx.post(
            f"{POCKETBASE_URL}/api/collections",
            json=images_schema,
            headers=headers,
            timeout=30.0
        )

        if create_response.status_code in [200, 201]:
            print("Collection 'infographic_images' created successfully!")
        else:
            print(f"Failed to create images collection: {create_response.text}")
    else:
        print("Collection 'infographic_images' already exists. Skipping.")


if __name__ == "__main__":
    init_pocketbase()
