from __future__ import annotations
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

minio_client = None

try:
    from minio import Minio
    minio_client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )
except Exception as e:
    logger.warning(f"MinIO connection failed: {e}. File storage features will be disabled.")


def ensure_bucket(bucket_name: str | None = None) -> None:
    if minio_client is None:
        logger.warning("MinIO unavailable, skipping ensure_bucket")
        return
    bucket = bucket_name or settings.MINIO_BUCKET
    try:
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)
    except Exception as e:
        logger.warning(f"MinIO ensure_bucket failed: {e}")
