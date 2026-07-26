from rq import Worker
from core.redis import redis_conn
from utils.logger import logger


if __name__ == "__main__":
    logger.info("Starting RQ Worker...")

    worker = Worker(["default"], connection=redis_conn)
    logger.info("RQ Worker is listening for jobs...")

    try:
        worker.work(with_scheduler=True)
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker error: {e}")
        raise
