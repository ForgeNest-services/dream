from typing import Any, Optional, Dict
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from utils.logger import logger


DEFAULT_ERROR_MESSAGE = "Something went wrong"


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
    meta: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    """Standard success response."""
    body: Dict[str, Any] = {"success": True, "data": data}

    if message:
        body["message"] = message

    if meta:
        body["meta"] = meta

    return JSONResponse(status_code=status_code, content=body)


def error_response(
    error_code: str,
    message: Optional[str] = None,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Standard error response with auto-logging."""
    message = message or DEFAULT_ERROR_MESSAGE

    if status_code >= 500:
        logger.error(f"{error_code}: {message}")
    else:
        logger.warning(f"{error_code}: {message}")

    error_body: Dict[str, Any] = {"code": error_code, "message": message}

    if details:
        error_body["details"] = details

    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": error_body},
        headers=headers,
    )


def format_validation_errors(exc: RequestValidationError) -> Dict[str, str]:
    """Converts validation errors to {field: message} format."""
    errors = {}
    for err in exc.errors():
        field = ".".join(map(str, err["loc"][1:])) if len(err["loc"]) > 1 else str(err["loc"][0])
        errors[field] = err["msg"]
    return errors
