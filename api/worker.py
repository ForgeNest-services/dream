import main  # noqa: F401 — resolves the app's full module graph first; without
# this, a job's lazy `features.*` import (e.g. cbms_jobs.py's _load_document)
# is the first thing to touch that graph in this process, and hits the
# features.auth <-> core.deps circular-import ordering that only resolves
# safely when main's own import sequence runs first.
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
