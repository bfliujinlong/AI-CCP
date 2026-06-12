from fastapi import APIRouter, Query, Body
from pydantic import BaseModel
from typing import Optional, Dict, List

try:
    from app.services.cloud_pricing_service import pricing_service
except Exception:
    # 如果导入失败，使用延迟导入
    pricing_service = None

router = APIRouter(prefix="/cloud-pricing", tags=["Cloud Pricing"])


class CloudProvider(BaseModel):
    id: str
    name: str
    desc: str
    tier: str
    domestic: bool


class PriceEntry(BaseModel):
    monthly: Optional[float] = None
    perGB: Optional[float] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    cheapest: bool = False


class ResourcePrice(BaseModel):
    spec: str
    prices: Dict[str, PriceEntry]


class PriceResponse(BaseModel):
    data: List[Dict]
    source: str
    cached_at: Optional[str] = None
    ttl_hours: Optional[float] = None
    note: Optional[str] = None


class CostCalculateRequest(BaseModel):
    ecs_count: int = 10
    rds_count: int = 3
    storage_tb: float = 5
    bandwidth: int = 100
    clouds: str = "aliyun,huawei,tencent,aws"
    region: str = "cn-hangzhou"


def _get_service():
    global pricing_service
    if pricing_service is None:
        from app.services.cloud_pricing_service import get_pricing_service
        pricing_service = get_pricing_service()
    return pricing_service


@router.get("/providers", response_model=List[CloudProvider])
async def get_providers():
    """获取云厂商列表"""
    svc = _get_service()
    providers = await svc.get_providers()
    return providers


@router.get("/ecs", response_model=PriceResponse)
async def get_ecs_prices(region: str = "cn-hangzhou"):
    """获取 ECS 云服务器价格 - 支持实时缓存"""
    svc = _get_service()
    return await svc.get_prices("ecs", region)


@router.get("/k8s", response_model=PriceResponse)
async def get_k8s_prices(region: str = "cn-hangzhou"):
    """获取 Kubernetes 托管集群价格 - 支持实时缓存"""
    svc = _get_service()
    return await svc.get_prices("k8s", region)


@router.get("/rds", response_model=PriceResponse)
async def get_rds_prices(region: str = "cn-hangzhou"):
    """获取云数据库 RDS 价格 - 支持实时缓存"""
    svc = _get_service()
    return await svc.get_prices("rds", region)


@router.get("/oss", response_model=PriceResponse)
async def get_oss_prices(region: str = "cn-hangzhou"):
    """获取对象存储 OSS 价格 - 支持实时缓存"""
    svc = _get_service()
    return await svc.get_prices("oss", region)


@router.get("/network", response_model=PriceResponse)
async def get_network_prices(region: str = "cn-hangzhou"):
    """获取网络/CDN 价格 - 支持实时缓存"""
    svc = _get_service()
    return await svc.get_prices("network", region)


@router.post("/calculate")
async def calculate_total_cost(payload: CostCalculateRequest):
    """计算多云总成本 - 使用实时价格数据"""
    svc = _get_service()
    params = payload.model_dump()
    results = await svc.calculate_cost(params)
    return results


@router.get("/status")
async def get_pricing_status():
    """获取价格服务状态 - 展示缓存命中率和数据源信息"""
    import redis.asyncio as redis
    from app.core.config import settings

    svc = _get_service()

    status = {
        "redis_connected": False,
        "cache_ttl_hours": svc.CACHE_TTL_SECONDS / 3600,
        "fallback_ttl_minutes": svc.FALLBACK_TTL_SECONDS / 60,
        "supported_resources": ["ecs", "k8s", "rds", "oss", "network"],
        "realtime_apis": {
            "aws": "https://pricing.us-east-1.amazonaws.com (公开)",
            "azure": "https://prices.azure.com/api/retail/prices (公开)",
            "aliyun": "BSS API (需 AccessKey)",
            "huawei": "BSS API (需 AccessKey)",
            "tencent": "BSS API (需 SecretId/Key)",
        },
    }

    try:
        r = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await r.ping()
        status["redis_connected"] = True
        info = await r.info("stats")
        status["redis_keyspace_hits"] = info.get("keyspace_hits", "N/A")
        status["redis_keyspace_misses"] = info.get("keyspace_misses", "N/A")
        await r.close()
    except Exception as e:
        status["redis_error"] = str(e)

    return status
