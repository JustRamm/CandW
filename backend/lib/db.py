"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "app")

try:
    from pymongo import MongoClient
    MongoClient(mongo_url, serverSelectionTimeoutMS=800).admin.command("ping")
    client = AsyncIOMotorClient(mongo_url)
    logger.info("Connected to MongoDB at %s", mongo_url)
except Exception as _err:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    logger.warning("MongoDB not running locally; using in-memory AsyncMongoMockClient fallback (%s)", _err)

db = client[db_name]

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("role", ASCENDING), ("active", ASCENDING)], name="role_active"),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
    ],
    "assets": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("asset_code", ASCENDING)], name="asset_code", unique=True),
        IndexModel([("status", ASCENDING), ("asset_code", ASCENDING)], name="status_code"),
    ],
    "queue_entries": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("asset_id", ASCENDING), ("state", ASCENDING), ("position", ASCENDING)], name="asset_state_pos"),
        IndexModel([("state", ASCENDING), ("expires_on", ASCENDING)], name="state_expiry"),
        IndexModel([("salesperson_id", ASCENDING), ("state", ASCENDING)], name="sales_state"),
    ],
    "campaigns": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("asset_id", ASCENDING), ("created_at", DESCENDING)], name="asset_created"),
        IndexModel([("stage", ASCENDING)], name="stage"),
    ],
    "audit_logs": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("asset_id", ASCENDING), ("created_at", DESCENDING)], name="asset_created"),
        IndexModel([("entity_type", ASCENDING), ("created_at", DESCENDING)], name="entity_created"),
    ],
    "notifications": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "documents": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "brands": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("name", ASCENDING)], name="name"),
    ],
    "asset_types": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "reminder_log": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "holidays": [IndexModel([("date", ASCENDING)], name="date", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
