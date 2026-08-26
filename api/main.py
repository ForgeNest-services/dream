from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from starlette.exceptions import HTTPException as StarletteHTTPException
from utils.helpers import success_response, error_response, format_validation_errors
from utils.logger import logger
from core.database import Base, engine
from core.seed import (
    seed_superadmin,
    seed_apps,
    seed_subscription_plans,
    seed_app_icons,
    ensure_ims_products_schema,
    ensure_ims_parties_schema,
    ensure_ims_bs_date_schema,
    ensure_ims_invoice_line_vat_schema,
    ensure_ims_variant_expiry_schema,
    ensure_ims_fiscal_year_link_schema,
    ensure_ims_branch_settings_qr_schema,
    ensure_tenants_free_app_schema,
)
from core.storage import ensure_bucket
import shared_models
from features.auth import router as auth_router
from features.hotel_pms import router as hotel_pms_router
from features.restro import router as restro_router
from features.ims import router as ims_router
from features.apps import router as apps_router
from features.branches.router import router as branches_router
from features.uploads import router as uploads_router
from features.subscriptions.router import router as subscriptions_router


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
        logger.info("Backfilling ims_products schema...")
        ensure_ims_products_schema()
        logger.info("ims_products schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims_products schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims_parties schema...")
        ensure_ims_parties_schema()
        logger.info("ims_parties schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims_parties schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims BS date schema...")
        ensure_ims_bs_date_schema()
        logger.info("ims BS date schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims BS date schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims_invoice_lines VAT schema...")
        ensure_ims_invoice_line_vat_schema()
        logger.info("ims_invoice_lines VAT schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims_invoice_lines VAT schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims_variants expiry schema...")
        ensure_ims_variant_expiry_schema()
        logger.info("ims_variants expiry schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims_variants expiry schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims fiscal year link schema...")
        ensure_ims_fiscal_year_link_schema()
        logger.info("ims fiscal year link schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims fiscal year link schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling ims_branch_settings QR schema...")
        ensure_ims_branch_settings_qr_schema()
        logger.info("ims_branch_settings QR schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill ims_branch_settings QR schema: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Backfilling tenants free_app_code schema...")
        ensure_tenants_free_app_schema()
        logger.info("tenants free_app_code schema backfill completed")
    except Exception as e:
        logger.error(f"Failed to backfill tenants free_app_code schema: {type(e).__name__}: {str(e)}")
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

    try:
        logger.info("Seeding subscription plans...")
        seed_subscription_plans()
        logger.info("Subscription plans seeded")
    except Exception as e:
        logger.error(f"Failed to seed subscription plans: {type(e).__name__}: {str(e)}")
        raise

    try:
        logger.info("Ensuring storage bucket...")
        ensure_bucket()
        logger.info("Storage bucket ready")
    except Exception as e:
        logger.error(f"Failed to set up storage bucket: {type(e).__name__}: {str(e)}")
        raise

    # App icons depend on both the apps table + MinIO being ready, so this
    # runs last. Failures are logged but non-fatal (see seed_app_icons).
    try:
        logger.info("Seeding app icons...")
        seed_app_icons()
        logger.info("App icon seeding completed")
    except Exception as e:
        logger.error(f"Failed to seed app icons: {type(e).__name__}: {str(e)}")

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
app.include_router(branches_router)
app.include_router(hotel_pms_router)
app.include_router(restro_router)
app.include_router(ims_router)
app.include_router(apps_router)
app.include_router(uploads_router)
app.include_router(subscriptions_router)


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
