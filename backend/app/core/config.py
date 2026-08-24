import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Cloud Consulting Platform"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    API_V1_STR: str = "/api/v1"

    AUTO_CREATE_TABLES: bool = True

    DATABASE_URL: str = "sqlite+aiosqlite:///./aicc.db"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    REDIS_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "aicc_minio"
    MINIO_SECRET_KEY: str = "aicc_minio_secret"
    MINIO_BUCKET: str = "aicc-documents"
    MINIO_SECURE: bool = False

    JWT_SECRET: str = "aicc_jwt_secret_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # 云端 Qwen API（回退用）
    QWEN_API_KEY: str = ""
    QWEN_MODEL: str = "qwen-plus"

    # 本地 Ollama 配置
    OLLAMA_ENABLED: bool = False
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    OLLAMA_MODEL: str = "qwen3.5:4b"
    OLLAMA_TIMEOUT: int = 120  # 纯CPU推理较慢，默认2分钟超时

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    FRONTEND_URL: str = "http://localhost:5173"

    LARK_APP_ID: str = ""
    LARK_APP_SECRET: str = ""

    OIDC_ISSUER: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""

    WECOM_CORP_ID: str = ""
    WECOM_AGENT_ID: str = ""
    WECOM_SECRET: str = ""

    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    SHOW_DEFAULT_PASSWORD_ON_LOGIN: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
