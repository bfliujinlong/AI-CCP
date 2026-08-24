from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import engine, Base, async_session_factory
from app.core.security import get_password_hash
from app.models.models import User, AuditLog
from app.api import api_router
from app.ai.registry import seed_builtin_skills


async def seed_initial_data():
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none() is None:
            admin = User(
                username="admin",
                email="admin@aicc.com",
                hashed_password=get_password_hash("admin123"),
                full_name="System Admin",
                role="admin",
            )
            session.add(admin)
            await session.commit()

        # 同步内置 Skill 到 DB（Skill → Prompt → LLM → Output 链路）
        try:
            stats = await seed_builtin_skills(session)
            print(f"[AICC] builtin skills seeded: {stats}")
        except Exception as e:
            print(f"[AICC] WARNING: seed builtin skills failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # In development (no alembic), create tables automatically.
    # In production, tables are managed by alembic (run before uvicorn starts).
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    await seed_initial_data()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 审计日志中间件 ====================
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    """记录所有 API 请求到 audit_logs 表。"""
    start_time = time.time()

    # 跳过静态文件和健康检查
    path = request.url.path
    if path.startswith("/docs") or path.startswith("/openapi") or path == "/health" or "/redoc" in path:
        return await call_next(request)

    # 提取客户端 IP（支持反向代理）
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"

    # 尝试从 JWT 中解析用户信息
    user_id = None
    username = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            username = payload.get("username")
        except (JWTError, Exception):
            pass

    # 执行请求
    response = await call_next(request)

    # 计算耗时
    duration_ms = int((time.time() - start_time) * 1000)

    # 推断操作类型
    method = request.method
    action = _infer_action(method, path)

    # 异步写入审计日志（不阻塞响应）
    try:
        async with async_session_factory() as session:
            log = AuditLog(
                user_id=user_id,
                username=username,
                ip_address=ip,
                method=method,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_agent=request.headers.get("User-Agent", "")[:500],
                action=action,
            )
            session.add(log)
            await session.commit()
    except Exception:
        pass  # 日志写入失败不影响正常请求

    return response


def _infer_action(method: str, path: str) -> str:
    """从请求方法和路径推断操作类型。"""
    if "/auth/login" in path:
        return "login"
    if "/auth/me" in path:
        return "get_user_info"
    if "/meeting-analysis" in path:
        return "meeting_import"
    if "/customers" in path:
        return "customer_" + method.lower()
    if "/opportunities" in path:
        return "opportunity_" + method.lower()
    if "/fact-sheets" in path:
        return "factsheet_" + method.lower()
    if "/skills" in path:
        return "skill_" + method.lower()
    if "/llm/chat" in path:
        return "llm_chat"
    if "/dashboard" in path:
        return "dashboard"
    if "/accounts" in path:
        return "account_" + method.lower()
    return method.lower()


app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}
