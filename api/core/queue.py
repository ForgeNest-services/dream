from rq import Queue
from core.redis import redis_conn
from utils.logger import logger

job_queue = Queue("default", connection=redis_conn)

logger.info("RQ Queue initialized")
