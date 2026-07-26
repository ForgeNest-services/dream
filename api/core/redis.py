from redis import Redis
from core.configs import settings
from utils.logger import logger

logger.info("Initializing Redis connection")

if not settings.REDIS_URL:
    logger.error("REDIS_URL is not set")
    raise ValueError("REDIS_URL environment variable is required")

redis_conn = Redis.from_url(settings.REDIS_URL)

logger.info("Redis connection established")
