import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, db, ensure_indexes  # noqa: E402
from routers import admin, assets, auth, brands, campaigns, queue  # noqa: E402

logger = logging.getLogger(__name__)


async def scheduler_loop():
    """Background worker: interest-queue expiry + GTP due reminders."""
    from lib.engine import sweep_queues

    while True:
        try:
            await sweep_queues()
            await send_gtp_reminders()
            await send_queue_expiry_warnings()
        except Exception as exc:  # noqa: BLE001 - the loop must survive a bad tick
            logger.error("scheduler tick failed: %s", exc)
        await asyncio.sleep(300)


async def send_queue_expiry_warnings():
    """Warn the owning salesperson before an active interest slot lapses."""
    from datetime import date

    from lib.workflow import business_days_between, holiday_set, ist_today, notify

    holidays = await holiday_set()
    today = ist_today()
    for e in await db.queue_entries.find({"state": "active"}).to_list(500):
        if not e.get("expires_on"):
            continue
        left = business_days_between(today, date.fromisoformat(e["expires_on"]), holidays)
        if left > 2 or left < 0:
            continue
        key = f"queue-expiry-warning:{e['id']}:{today.isoformat()}"
        if await db.reminder_log.find_one({"key": key}):
            continue
        await db.reminder_log.insert_one({"key": key})
        await notify(
            e["salesperson_id"],
            title="Interest slot expiring soon" if left > 0 else "Interest slot expires today",
            body=(
                f"{e['brand']} on {e['asset_code']} expires {e['expires_on']}"
                + (f" — {left} business day(s) left." if left > 0 else " — today.")
                + " Get Finance to confirm it or it will lapse to the next brand in the waitlist."
            ),
            kind="warning" if left > 1 else "error",
            link="/queue",
        )


async def send_gtp_reminders():
    from datetime import date

    from lib.engine import gtp_state
    from lib.workflow import get_settings, ist_today, notify, users_with_roles

    settings = await get_settings()
    today = ist_today()
    ops = await users_with_roles("ops")
    if not ops:
        return
    for c in await db.campaigns.find({"stage": {"$in": ["live", "closing"]}}).to_list(500):
        state = gtp_state(c)
        if not state["next_due"]:
            continue
        days = (date.fromisoformat(state["next_due"]) - today).days
        if days > settings["gtp_reminder_days"]:
            continue
        key = f"gtp-reminder:{state['next_gtp_id']}:{today.isoformat()}"
        if await db.reminder_log.find_one({"key": key}):
            continue
        await db.reminder_log.insert_one({"key": key})
        await notify(
            ops,
            title="GTP due" if days >= 0 else "GTP overdue",
            body=f"GTP for {c['brand']} on {c['asset_code']} is due {state['next_due']}.",
            kind="warning" if days >= 0 else "error",
            link=f"/campaigns/{c['id']}",
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    try:
        if await db.users.count_documents({}) == 0:
            logger.info("Empty database detected: auto-seeding demo data...")
            import seed
            await seed.main()
    except Exception as exc:
        logger.error("Auto-seeding check failed: %s", exc)
    app.state.scheduler = asyncio.create_task(scheduler_loop())
    yield
    app.state.scheduler.cancel()
    client.close()


app = FastAPI(lifespan=lifespan, title="Outdoor Advertising IMS")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Outdoor Advertising IMS API", "status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(assets.router)
api_router.include_router(queue.router)
api_router.include_router(brands.router)
api_router.include_router(campaigns.router)
api_router.include_router(admin.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Include the router in the main app — must stay last.
app.include_router(api_router)
