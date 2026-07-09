import logging

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = None

try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.warning(f"Redis connection failed: {e}. Caching features will be disabled.")
