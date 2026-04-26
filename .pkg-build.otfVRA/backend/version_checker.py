import asyncio

CURRENT_VERSION = "2.0.0"

_disabled_status = {
    "version": CURRENT_VERSION,
    "update_available": False,
    "last_check": None,
    "details": {},
    "disabled": True,
    "message": "Update checks are disabled in this build.",
}


async def check_for_updates():
    return None


async def version_check_scheduler():
    while True:
        await asyncio.sleep(24 * 3600)


def get_update_status():
    return _disabled_status
