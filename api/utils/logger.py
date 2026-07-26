import os
import sys
from loguru import logger

config = {
    "handlers": [
        {
            "sink": (
                sys.stdout if os.getenv("ENVIRO", "dev") != "prod" else "logs/api.log"
            ),
            "format": "{time} | {level} | {name}:{file}:{line} | {extra} | {message}",
            "level": "DEBUG",
            "backtrace": False,
            "diagnose": False,
        }
    ]
}

logger.remove()
logger.configure(**config)
