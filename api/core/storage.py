import json
import uuid
import boto3
from botocore.exceptions import ClientError
from core.configs import settings
from utils.logger import logger

_client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
)

_PUBLIC_READ_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{settings.S3_BUCKET}/*",
        }
    ],
}


def ensure_bucket() -> None:
    """Create the shared bucket and make it public-read if it doesn't exist
    yet. Called once at API startup — safe to call repeatedly (idempotent)."""
    try:
        _client.head_bucket(Bucket=settings.S3_BUCKET)
    except ClientError:
        _client.create_bucket(Bucket=settings.S3_BUCKET)
        logger.info(f"Created storage bucket: {settings.S3_BUCKET}")

    _client.put_bucket_policy(
        Bucket=settings.S3_BUCKET,
        Policy=json.dumps(_PUBLIC_READ_POLICY),
    )


def upload_file(prefix: str, filename: str, content: bytes, content_type: str) -> str:
    """Uploads bytes under `{prefix}/{uuid}-{filename}` and returns the
    public URL. `prefix` should already be app/tenant/branch-scoped, e.g.
    'restro/{tenant_id}/{branch_id}/menu-items'."""
    safe_name = filename.replace("/", "_").replace("\\", "_")
    key = f"{prefix.strip('/')}/{uuid.uuid4()}-{safe_name}"

    _client.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    return build_public_url(key)


def delete_file(key: str) -> None:
    _client.delete_object(Bucket=settings.S3_BUCKET, Key=key)


def build_public_url(key: str) -> str:
    return f"{settings.S3_PUBLIC_URL}/{settings.S3_BUCKET}/{key}"


def key_from_url(url: str) -> str | None:
    """Extracts the object key from a URL previously returned by upload_file,
    for use with delete_file. Returns None if the URL isn't ours."""
    prefix = f"{settings.S3_PUBLIC_URL}/{settings.S3_BUCKET}/"
    if not url.startswith(prefix):
        return None
    return url[len(prefix):]
