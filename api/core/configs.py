import os

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_DB = os.getenv("REDIS_DB")

class Settings:
    DATABASE_ADMIN_URL: str = os.getenv("DATABASE_ADMIN_URL") or os.getenv("DATABASE_URL")
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    DATABASE_APP_USER: str = os.getenv("DATABASE_APP_USER", "srota_app")
    DATABASE_APP_PASSWORD: str = os.getenv("DATABASE_APP_PASSWORD", "")
    REDIS_URL: str = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    ENVIRO: str = os.getenv("ENVIRO", "prod")
    JWT_SECRET: str = os.getenv("JWT_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    SUPERADMIN_EMAIL: str = os.getenv("SUPERADMIN_EMAIL")
    SUPERADMIN_PASSWORD: str = os.getenv("SUPERADMIN_PASSWORD")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "")
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    BREVO_FROM_EMAIL: str = os.getenv("BREVO_FROM_EMAIL", "")
    BREVO_FROM_NAME: str = os.getenv("BREVO_FROM_NAME", "Dream")

    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://minio:9000")
    S3_PUBLIC_URL: str = os.getenv("S3_PUBLIC_URL", "http://localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "dream-uploads")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")

    # Symmetric key for encrypting secrets at rest (e.g. a tenant's IRD CBMS
    # Taxpayer Portal password — see core/crypto.py). Generate with:
    # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    CBMS_ENCRYPTION_KEY: str = os.getenv("CBMS_ENCRYPTION_KEY", "")

    IRD_CBMS_URL: str = os.getenv("IRD_CBMS_URL", "https://cbapi.ird.gov.np/api/bill")
    IRD_CBMS_RETURN_URL: str = os.getenv("IRD_CBMS_RETURN_URL", "https://cbapi.ird.gov.np/api/billreturn")

    IMS_CBMS_CERTIFIED: bool = os.getenv("IMS_CBMS_CERTIFIED", "false").lower() == "true"
    RMS_CBMS_CERTIFIED: bool = os.getenv("RMS_CBMS_CERTIFIED", "false").lower() == "true"

    CORS_ALLOWED_ORIGINS: list[str] = sorted({
        f"https://{host.strip()}"
        for var in (
            "UI_VIRTUAL_HOST", "ADMIN_VIRTUAL_HOST",
            "RMS_VIRTUAL_HOST", "IMS_VIRTUAL_HOST",
        )
        for host in os.getenv(var, "").split(",")
        if host.strip()
    })

settings = Settings()
