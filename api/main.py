from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from starlette.exceptions import HTTPException as StarletteHTTPException
from utils.helpers import success_response, error_response, format_validation_errors
from utils.logger import logger
from core.database import Base, engine
from core.seed import seed_superadmin, seed_apps
import shared_models
from features.auth import router as auth_router
from features.hotel_pms import router as hotel_pms_router
from features.apps import router as apps_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("Initializing database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Seeding superadmin...")
        seed_superadmin()
        logger.info("Superadmin seeding completed")
    except Exception as e:
        logger.error(f"Failed to seed superadmin: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Seeding apps...")
        seed_apps()
        logger.info("App seeding completed")
    except Exception as e:
        logger.error(f"Failed to seed apps: {type(e).__name__}: {str(e)}")
        raise

    yield


app = FastAPI(
    title="API",
    description="API template",
    version="1.0.0",
    root_path="/api",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(hotel_pms_router)
app.include_router(apps_router)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return error_response(
        error_code="HTTP_ERROR",
        message=str(exc.detail),
        status_code=exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return error_response(
        error_code="VALIDATION_ERROR",
        message="Invalid request data",
        status_code=422,
        details=format_validation_errors(exc),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {type(exc).__name__}: {exc}")
    return error_response(
        error_code="INTERNAL_SERVER_ERROR",
        message="Something went wrong",
        status_code=500,
    )


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="API",
        version="1.0.0",
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter JWT token",
        }
    }

    openapi_schema["security"] = [{"Bearer": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/")
def root():
    return success_response(data={"message": "Welcome to the API!"})


@app.get("/health")
def health():
    return success_response(data={"status": "ok"})
