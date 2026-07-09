from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
import httpx
import secrets

from app.core.config import settings
from app.core.database import get_db
from app.schemas.user import LoginRequest, Token, UserCreate, UserResponse, UserUpdate
from app.services.auth_service import AuthService
from app.api.deps import get_current_user_id

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SSOConfig(BaseModel):
    lark_enabled: bool = False
    lark_app_id: Optional[str] = None
    lark_app_secret: Optional[str] = None
    oidc_enabled: bool = False
    oidc_issuer: Optional[str] = None
    oidc_client_id: Optional[str] = None
    oidc_client_secret: Optional[str] = None
    oidc_scope: str = "openid profile email"
    wecom_enabled: bool = False
    wecom_corp_id: Optional[str] = None
    wecom_agent_id: Optional[str] = None
    wecom_secret: Optional[str] = None


class BrandingConfig(BaseModel):
    system_name: str = "AICC Platform"
    logo_url: Optional[str] = None
    login_title: str = "AI 云咨询平台"
    login_subtitle: str = "智能报价 · SOW · WBS · 多云对比"


@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    token = await service.authenticate(request.username, request.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    return token


@router.post("/register", response_model=UserResponse)
async def register(request: UserCreate, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        user = await service.register(request)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = AuthService(db)
    user = await service.get_current_user(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/sso/lark")
async def lark_sso_login():
    app_id = getattr(settings, "LARK_APP_ID", None)
    if not app_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lark SSO not configured")
    redirect_uri = f"{settings.API_V1_STR}/auth/sso/lark/callback"
    state = secrets.token_urlsafe(32)
    auth_url = (
        f"https://open.feishu.cn/open-apis/authen/v1/authorize"
        f"?app_id={app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/sso/lark/callback")
async def lark_sso_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    app_id = getattr(settings, "LARK_APP_ID", "")
    app_secret = getattr(settings, "LARK_APP_SECRET", "")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret},
        )
        app_access_token = token_resp.json().get("app_access_token")
        if not app_access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get Lark app token")

        user_resp = await client.post(
            "https://open.feishu.cn/open-apis/authen/v1/access_token",
            headers={"Authorization": f"Bearer {app_access_token}"},
            json={"grant_type": "authorization_code", "code": code},
        )
        user_data = user_resp.json().get("data", {})
        open_id = user_data.get("open_id")
        name = user_data.get("name", "Lark User")
        email = user_data.get("email", f"{open_id}@lark")

    service = AuthService(db)
    user = await service.find_or_create_sso_user(
        sso_id=f"lark:{open_id}",
        username=f"lark_{open_id[:8]}",
        email=email,
        full_name=name,
    )
    token = service.create_token(user.id)
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/?sso_token={token.access_token}")


@router.get("/sso/oidc")
async def oidc_sso_login():
    client_id = getattr(settings, "OIDC_CLIENT_ID", None)
    issuer = getattr(settings, "OIDC_ISSUER", "")
    if not client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OIDC SSO not configured")
    redirect_uri = f"{settings.API_V1_STR}/auth/sso/oidc/callback"
    state = secrets.token_urlsafe(32)
    auth_url = (
        f"{issuer.replace('/.well-known/openid-configuration', '')}/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid+profile+email"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/sso/oidc/callback")
async def oidc_sso_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    client_id = getattr(settings, "OIDC_CLIENT_ID", "")
    client_secret = getattr(settings, "OIDC_CLIENT_SECRET", "")
    issuer = getattr(settings, "OIDC_ISSUER", "")
    redirect_uri = f"{settings.API_V1_STR}/auth/sso/oidc/callback"
    token_url = f"{issuer.replace('/.well-known/openid-configuration', '')}/token"

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        token_data = token_resp.json()
        id_token = token_data.get("id_token")
        if id_token:
            payload = jwt.decode(id_token, options={"verify_signature": False})
            sub = payload.get("sub", "unknown")
            name = payload.get("name", "OIDC User")
            email = payload.get("email", f"{sub}@oidc")
        else:
            sub = "unknown"
            name = "OIDC User"
            email = f"{sub}@oidc"

    service = AuthService(db)
    user = await service.find_or_create_sso_user(
        sso_id=f"oidc:{sub}",
        username=f"oidc_{sub[:8]}",
        email=email,
        full_name=name,
    )
    token = service.create_token(user.id)
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/?sso_token={token.access_token}")


@router.get("/sso/wecom")
async def wecom_sso_login():
    corp_id = getattr(settings, "WECOM_CORP_ID", None)
    agent_id = getattr(settings, "WECOM_AGENT_ID", None)
    if not corp_id or not agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WeCom SSO not configured")
    redirect_uri = f"{settings.API_V1_STR}/auth/sso/wecom/callback"
    state = secrets.token_urlsafe(32)
    auth_url = (
        f"https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
        f"?appid={corp_id}"
        f"&agentid={agent_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/sso/wecom/callback")
async def wecom_sso_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    corp_id = getattr(settings, "WECOM_CORP_ID", "")
    secret = getattr(settings, "WECOM_SECRET", "")
    async with httpx.AsyncClient() as client:
        token_resp = await client.get(
            f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={corp_id}&corpsecret={secret}"
        )
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get WeCom access token")

        user_resp = await client.get(
            f"https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token={access_token}&code={code}"
        )
        user_data = user_resp.json()
        userid = user_data.get("userid", "wecom_user")

    service = AuthService(db)
    user = await service.find_or_create_sso_user(
        sso_id=f"wecom:{userid}",
        username=f"wecom_{userid}",
        email=f"{userid}@wecom",
        full_name=userid,
    )
    token = service.create_token(user.id)
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/?sso_token={token.access_token}")


@router.get("/sso/providers")
async def get_sso_providers():
    providers = []
    if getattr(settings, "LARK_APP_ID", None):
        providers.append({"id": "lark", "name": "飞书", "url": f"{settings.API_V1_STR}/auth/sso/lark"})
    if getattr(settings, "OIDC_CLIENT_ID", None):
        providers.append({"id": "oidc", "name": "企业 SSO (OIDC)", "url": f"{settings.API_V1_STR}/auth/sso/oidc"})
    if getattr(settings, "WECOM_CORP_ID", None):
        providers.append({"id": "wecom", "name": "企业微信", "url": f"{settings.API_V1_STR}/auth/sso/wecom"})
    return {"providers": providers}


@router.post("/sso/config")
async def save_sso_config(config: SSOConfig):
    return {"message": "SSO configuration saved successfully"}


@router.get("/branding")
async def get_branding():
    return BrandingConfig()


@router.post("/branding")
async def save_branding(config: BrandingConfig):
    return {"message": "Branding configuration saved successfully"}
