import os

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_DB = os.getenv("REDIS_DB")

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
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

    # Object storage — S3-API-compatible (MinIO in dev/self-hosted, real AWS
    # S3 later). S3_ENDPOINT is used server-side (container network);
    # S3_PUBLIC_URL is embedded in URLs returned to the browser.
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

    # docs/Srota_IRD_Compliance_Checklist.md's primary source gives this as
    # the current address; an older 202.166.207.75:9050 address also turned
    # up in research — confirm with IRD which is authoritative before a
    # real submission. Override via env if that changes.
    IRD_CBMS_URL: str = os.getenv("IRD_CBMS_URL", "https://cbapi.ird.gov.np/api/bill")
    IRD_CBMS_RETURN_URL: str = os.getenv("IRD_CBMS_RETURN_URL", "https://cbapi.ird.gov.np/api/billreturn")

    # Hard gate on CBMS auto-sync per app — stays False until that app is
    # actually IRD-certified. Flipping this is the ONLY code change needed
    # once certification is granted; see features/tax_settings/service.py's
    # enforcement in the sync-enabled toggle.
    IMS_CBMS_CERTIFIED: bool = os.getenv("IMS_CBMS_CERTIFIED", "false").lower() == "true"
    RMS_CBMS_CERTIFIED: bool = os.getenv("RMS_CBMS_CERTIFIED", "false").lower() == "true"

settings = Settings()
