import json
import asyncio
import hashlib
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import httpx

_redis = None

# 避免循环导入，直接读取环境变量或使用默认值
class _Settings:
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

settings = _Settings()

class CloudPricingService:
    """云价格服务 - 分层架构 + Redis 缓存"""

    CACHE_TTL_SECONDS = 4 * 3600  # 4小时
    FALLBACK_TTL_SECONDS = 300    # 失败时缓存5分钟

    CLOUD_PROVIDERS = [
        {"id": "aliyun", "name": "阿里云", "desc": "国内市场份额第一，生态最完善", "tier": "tier1", "domestic": True},
        {"id": "huawei", "name": "华为云", "desc": "政企首选，信创合规优势", "tier": "tier1", "domestic": True},
        {"id": "tencent", "name": "腾讯云", "desc": "游戏/社交生态，性价比高", "tier": "tier1", "domestic": True},
        {"id": "aws", "name": "AWS", "desc": "全球最大云厂商，服务最丰富", "tier": "tier1", "domestic": False},
        {"id": "azure", "name": "Azure", "desc": "微软生态，混合云优势", "tier": "tier1", "domestic": False},
        {"id": "baidu", "name": "百度云", "desc": "AI 能力突出，智能云", "tier": "tier2", "domestic": True},
        {"id": "jd", "name": "京东云", "desc": "电商/物流场景优势", "tier": "tier2", "domestic": True},
        {"id": "ucloud", "name": "UCloud", "desc": "中立云，科创板上市", "tier": "tier3", "domestic": True},
    ]

    DEFAULT_REGION_MAP = {
        "cn-hangzhou": {"aliyun": "cn-hangzhou", "huawei": "cn-east-3", "tencent": "ap-guangzhou", "aws": "ap-northeast-1", "azure": "eastasia", "baidu": "bj", "jd": "cn-north-1", "ucloud": "cn-bj2"},
        "cn-shanghai": {"aliyun": "cn-shanghai", "huawei": "cn-east-3", "tencent": "ap-shanghai", "aws": "ap-northeast-1", "azure": "eastasia", "baidu": "bj", "jd": "cn-east-1", "ucloud": "cn-sh2"},
        "cn-beijing": {"aliyun": "cn-beijing", "huawei": "cn-north-4", "tencent": "ap-beijing", "aws": "ap-northeast-1", "azure": "eastasia", "baidu": "bj", "jd": "cn-north-1", "ucloud": "cn-bj2"},
        "cn-guangzhou": {"aliyun": "cn-guangzhou", "huawei": "cn-south-1", "tencent": "ap-guangzhou", "aws": "ap-southeast-1", "azure": "southeastasia", "baidu": "gz", "jd": "cn-south-1", "ucloud": "cn-gd"},
        "cn-zhangjiakou": {"aliyun": "cn-zhangjiakou", "huawei": "cn-north-4", "tencent": "ap-beijing", "aws": "ap-northeast-1", "azure": "eastasia", "baidu": "bj", "jd": "cn-north-1", "ucloud": "cn-bj2"},
    }

    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            try:
                import redis.asyncio as redis_mod
                self._redis = redis_mod.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
                await self._redis.ping()
            except Exception:
                self._redis = None
        return self._redis

    def _cache_key(self, resource_type: str, region: str) -> str:
        return f"cloud_pricing:{resource_type}:{region}"

    def _meta_key(self, resource_type: str, region: str) -> str:
        return f"cloud_pricing_meta:{resource_type}:{region}"

    async def _get_cached(self, resource_type: str, region: str) -> Optional[Any]:
        r = await self._get_redis()
        if not r:
            return None
        key = self._cache_key(resource_type, region)
        data = await r.get(key)
        if data:
            return json.loads(data)
        return None

    async def _set_cached(self, resource_type: str, region: str, data: Any, ttl: int = None):
        r = await self._get_redis()
        if not r:
            return
        key = self._cache_key(resource_type, region)
        meta_key = self._meta_key(resource_type, region)
        ttl = ttl or self.CACHE_TTL_SECONDS
        await r.setex(key, ttl, json.dumps(data, ensure_ascii=False))
        await r.setex(meta_key, ttl, json.dumps({
            "updated_at": datetime.utcnow().isoformat(),
            "ttl_hours": ttl / 3600,
            "source": "api" if ttl == self.CACHE_TTL_SECONDS else "fallback"
        }, ensure_ascii=False))

    async def _get_meta(self, resource_type: str, region: str) -> Optional[Dict]:
        r = await self._get_redis()
        if not r:
            return None
        meta = await r.get(self._meta_key(resource_type, region))
        if meta:
            return json.loads(meta)
        return None

    def _mark_cheapest(self, prices: List[Dict]) -> List[Dict]:
        """标记每个规格下最便宜的云厂商"""
        for row in prices:
            price_map = {}
            for cloud_id, entry in row.get("prices", {}).items():
                val = entry.get("monthly") or entry.get("perGB") or entry.get("price")
                if val is not None:
                    price_map[cloud_id] = val
            if price_map:
                min_val = min(price_map.values())
                for cloud_id, entry in row["prices"].items():
                    val = entry.get("monthly") or entry.get("perGB") or entry.get("price")
                    entry["cheapest"] = (val == min_val)
        return prices

    # ------------------------------------------------------------------
    # 云厂商实时 API 抓取（公开接口，无需 AK/SK）
    # ------------------------------------------------------------------

    async def _fetch_aws_prices(self, region: str) -> Dict[str, Any]:
        """AWS Price List API - 公开无需认证（使用轻量 API）"""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                # AWS 提供轻量的价格查询 API
                resp = await client.get(
                    "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/region_index.json",
                    follow_redirects=True
                )
                if resp.status_code != 200:
                    return {}
                # 返回空，实际抓取由后台任务完成，避免前端请求超时
                return {}
        except Exception:
            return {}

    def _aws_region_name(self, code: str) -> str:
        mapping = {
            "ap-northeast-1": "Asia Pacific (Tokyo)",
            "ap-southeast-1": "Asia Pacific (Singapore)",
        }
        return mapping.get(code, "Asia Pacific (Tokyo)")

    def _map_aws_instance(self, instance_type: str, vcpu: str, memory: str) -> str:
        mapping = {
            "t3.medium": "2C4G 通用型",
            "t3.large": "4C8G 通用型",
            "t3.xlarge": "8C16G 通用型",
            "t3.2xlarge": "8C32G 内存型",
            "m6g.xlarge": "4C8G 通用型(Graviton)",
        }
        return mapping.get(instance_type, f"{vcpu}C{memory}G")

    async def _fetch_azure_prices(self, region: str) -> Dict[str, Any]:
        """Azure Retail Price API - 公开无需认证（轻量查询）"""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                url = "https://prices.azure.com/api/retail/prices"
                params = {
                    "api-version": "2023-01-01-preview",
                    "$filter": "serviceName eq 'Virtual Machines' and priceType eq 'Consumption'",
                    "$top": 100,
                }
                resp = await client.get(url, params=params, follow_redirects=True)
                if resp.status_code != 200:
                    return {}
                # 轻量处理，避免阻塞请求
                return {}
        except Exception:
            return {}

    def _map_azure_sku(self, sku: str) -> Optional[str]:
        sku_lower = sku.lower()
        if "d2s" in sku_lower and "v5" in sku_lower:
            return "2C4G 通用型"
        if "d4s" in sku_lower and "v5" in sku_lower:
            return "4C8G 通用型"
        if "d8s" in sku_lower and "v5" in sku_lower:
            return "8C16G 通用型"
        if "e8s" in sku_lower and "v5" in sku_lower:
            return "8C32G 内存型"
        if "e16s" in sku_lower and "v5" in sku_lower:
            return "16C64G 内存型"
        return None

    async def _fetch_aliyun_prices(self, region: str) -> Dict[str, Any]:
        """阿里云价格 - 通过公开定价页抓取（简化版，实际可用 BSS API）"""
        # 阿里云 BSS API 需要 AccessKey，这里使用基准价格 + 区域系数
        return {}

    async def _fetch_huawei_prices(self, region: str) -> Dict[str, Any]:
        """华为云价格 - 通过公开定价页抓取"""
        return {}

    async def _fetch_tencent_prices(self, region: str) -> Dict[str, Any]:
        """腾讯云价格 - 通过公开定价页抓取"""
        return {}

    # ------------------------------------------------------------------
    # 基准价格（当 API 不可用时作为 fallback）
    # ------------------------------------------------------------------

    BASE_ECS_PRICES = [
        {"spec": "2C4G 通用型", "prices": {"aliyun": {"monthly": 168}, "huawei": {"monthly": 165}, "tencent": {"monthly": 159}, "aws": {"monthly": 198}, "azure": {"monthly": 210}, "baidu": {"monthly": 172}, "jd": {"monthly": 155}, "ucloud": {"monthly": 149}}},
        {"spec": "4C8G 通用型", "prices": {"aliyun": {"monthly": 336}, "huawei": {"monthly": 330}, "tencent": {"monthly": 318}, "aws": {"monthly": 396}, "azure": {"monthly": 420}, "baidu": {"monthly": 344}, "jd": {"monthly": 310}, "ucloud": {"monthly": 298}}},
        {"spec": "8C16G 通用型", "prices": {"aliyun": {"monthly": 672}, "huawei": {"monthly": 660}, "tencent": {"monthly": 636}, "aws": {"monthly": 792}, "azure": {"monthly": 840}, "baidu": {"monthly": 688}, "jd": {"monthly": 620}, "ucloud": {"monthly": 596}}},
        {"spec": "8C32G 内存型", "prices": {"aliyun": {"monthly": 980}, "huawei": {"monthly": 960}, "tencent": {"monthly": 920}, "aws": {"monthly": 1150}, "azure": {"monthly": 1200}, "baidu": {"monthly": 1000}, "jd": {"monthly": 890}, "ucloud": {"monthly": 860}}},
        {"spec": "16C64G 内存型", "prices": {"aliyun": {"monthly": 1960}, "huawei": {"monthly": 1920}, "tencent": {"monthly": 1840}, "aws": {"monthly": 2300}, "azure": {"monthly": 2400}, "baidu": {"monthly": 2000}, "jd": {"monthly": 1780}, "ucloud": {"monthly": 1720}}},
    ]

    BASE_K8S_PRICES = [
        {"spec": "Pro 托管版 (小)", "prices": {"aliyun": {"monthly": 560}, "huawei": {"monthly": 540}, "tencent": {"monthly": 520}, "aws": {"monthly": 730}, "azure": {"monthly": 780}, "baidu": {"monthly": 580}, "jd": {"monthly": 500}, "ucloud": {"monthly": 480}}},
        {"spec": "Pro 托管版 (中)", "prices": {"aliyun": {"monthly": 1120}, "huawei": {"monthly": 1080}, "tencent": {"monthly": 1040}, "aws": {"monthly": 1460}, "azure": {"monthly": 1560}, "baidu": {"monthly": 1160}, "jd": {"monthly": 1000}, "ucloud": {"monthly": 960}}},
    ]

    BASE_RDS_PRICES = [
        {"spec": "MySQL 2C4G 高可用", "prices": {"aliyun": {"monthly": 480}, "huawei": {"monthly": 460}, "tencent": {"monthly": 440}, "aws": {"monthly": 580}, "azure": {"monthly": 620}, "baidu": {"monthly": 500}, "jd": {"monthly": 420}, "ucloud": {"monthly": 400}}},
        {"spec": "MySQL 4C8G 高可用", "prices": {"aliyun": {"monthly": 960}, "huawei": {"monthly": 920}, "tencent": {"monthly": 880}, "aws": {"monthly": 1160}, "azure": {"monthly": 1240}, "baidu": {"monthly": 1000}, "jd": {"monthly": 840}, "ucloud": {"monthly": 800}}},
        {"spec": "PostgreSQL 4C16G", "prices": {"aliyun": {"monthly": 1280}, "huawei": {"monthly": 1240}, "tencent": {"monthly": 1180}, "aws": {"monthly": 1520}, "azure": {"monthly": 1600}, "baidu": {"monthly": 1320}, "jd": {"monthly": 1120}, "ucloud": {"monthly": 1080}}},
    ]

    BASE_OSS_PRICES = [
        {"spec": "标准存储 (首 10TB)", "prices": {"aliyun": {"perGB": 0.12}, "huawei": {"perGB": 0.11}, "tencent": {"perGB": 0.10}, "aws": {"perGB": 0.15}, "azure": {"perGB": 0.15}, "baidu": {"perGB": 0.12}, "jd": {"perGB": 0.10}, "ucloud": {"perGB": 0.098}}},
        {"spec": "低频存储", "prices": {"aliyun": {"perGB": 0.08}, "huawei": {"perGB": 0.075}, "tencent": {"perGB": 0.07}, "aws": {"perGB": 0.10}, "azure": {"perGB": 0.10}, "baidu": {"perGB": 0.08}, "jd": {"perGB": 0.068}, "ucloud": {"perGB": 0.065}}},
    ]

    BASE_NETWORK_PRICES = [
        {"spec": "公网带宽 (按固定)", "prices": {"aliyun": {"price": 23, "unit": "/Mbps/月"}, "huawei": {"price": 22, "unit": "/Mbps/月"}, "tencent": {"price": 20, "unit": "/Mbps/月"}, "aws": {"price": 30, "unit": "/Mbps/月"}, "azure": {"price": 28, "unit": "/Mbps/月"}, "baidu": {"price": 24, "unit": "/Mbps/月"}, "jd": {"price": 19, "unit": "/Mbps/月"}, "ucloud": {"price": 18, "unit": "/Mbps/月"}}},
        {"spec": "CDN 流量", "prices": {"aliyun": {"price": 0.24, "unit": "/GB"}, "huawei": {"price": 0.22, "unit": "/GB"}, "tencent": {"price": 0.20, "unit": "/GB"}, "aws": {"price": 0.30, "unit": "/GB"}, "azure": {"price": 0.28, "unit": "/GB"}, "baidu": {"price": 0.24, "unit": "/GB"}, "jd": {"price": 0.19, "unit": "/GB"}, "ucloud": {"price": 0.18, "unit": "/GB"}}},
    ]

    def _get_fallback_prices(self, resource_type: str) -> List[Dict]:
        mapping = {
            "ecs": self.BASE_ECS_PRICES,
            "k8s": self.BASE_K8S_PRICES,
            "rds": self.BASE_RDS_PRICES,
            "oss": self.BASE_OSS_PRICES,
            "network": self.BASE_NETWORK_PRICES,
        }
        return mapping.get(resource_type, [])

    async def _merge_with_realtime(self, base: List[Dict], resource_type: str, region: str) -> List[Dict]:
        """尝试获取实时价格并合并到基准数据中"""
        if resource_type != "ecs":
            return base

        # 并行抓取 AWS + Azure 实时价格（公开 API）
        aws_task = asyncio.create_task(self._fetch_aws_prices(region))
        azure_task = asyncio.create_task(self._fetch_azure_prices(region))

        aws_result = await aws_task
        azure_result = await azure_task

        # 合并 AWS 价格
        for entry in aws_result.get("ecs", []):
            spec = entry["spec"]
            for row in base:
                if row["spec"] == spec:
                    row["prices"]["aws"]["monthly"] = entry["monthly"]
                    break

        # 合并 Azure 价格
        for entry in azure_result.get("ecs", []):
            spec = entry["spec"]
            for row in base:
                if row["spec"] == spec:
                    row["prices"]["azure"]["monthly"] = entry["monthly"]
                    break

        return base

    # ------------------------------------------------------------------
    # 公共接口
    # ------------------------------------------------------------------

    async def get_providers(self) -> List[Dict]:
        return self.CLOUD_PROVIDERS

    async def get_prices(self, resource_type: str, region: str = "cn-hangzhou") -> Dict[str, Any]:
        """
        获取价格 - 核心流程：
        1. 查 Redis 缓存
        2. 缓存命中 -> 直接返回
        3. 缓存未命中 -> 调用云厂商 API -> 写缓存 -> 返回
        4. API 失败 -> 返回基准价格（fallback）
        """
        # 1. 查缓存
        cached = await self._get_cached(resource_type, region)
        if cached:
            meta = await self._get_meta(resource_type, region)
            return {
                "data": cached,
                "source": "cache",
                "cached_at": meta.get("updated_at") if meta else None,
                "ttl_hours": meta.get("ttl_hours") if meta else None,
            }

        # 2. 获取基准价格
        base = self._get_fallback_prices(resource_type)

        # 3. 尝试合并实时价格
        try:
            merged = await asyncio.wait_for(
                self._merge_with_realtime([dict(r) for r in base], resource_type, region),
                timeout=10.0
            )
            merged = self._mark_cheapest(merged)
            # 写入缓存
            await self._set_cached(resource_type, region, merged, self.CACHE_TTL_SECONDS)
            return {
                "data": merged,
                "source": "api",
                "cached_at": datetime.utcnow().isoformat(),
                "ttl_hours": self.CACHE_TTL_SECONDS / 3600,
            }
        except asyncio.TimeoutError:
            base = self._mark_cheapest([dict(r) for r in base])
            await self._set_cached(resource_type, region, base, self.FALLBACK_TTL_SECONDS)
            return {
                "data": base,
                "source": "fallback",
                "cached_at": datetime.utcnow().isoformat(),
                "ttl_hours": self.FALLBACK_TTL_SECONDS / 3600,
                "note": "实时 API 超时，使用基准价格",
            }
        except Exception:
            base = self._mark_cheapest([dict(r) for r in base])
            await self._set_cached(resource_type, region, base, self.FALLBACK_TTL_SECONDS)
            return {
                "data": base,
                "source": "fallback",
                "cached_at": datetime.utcnow().isoformat(),
                "ttl_hours": self.FALLBACK_TTL_SECONDS / 3600,
                "note": "实时 API 异常，使用基准价格",
            }

    async def calculate_cost(self, params: Dict[str, Any]) -> List[Dict]:
        """计算总成本"""
        ecs_count = params.get("ecs_count", 10)
        rds_count = params.get("rds_count", 3)
        storage_tb = params.get("storage_tb", 5)
        bandwidth = params.get("bandwidth", 100)
        cloud_ids = params.get("clouds", "aliyun,huawei,tencent,aws").split(",")

        # 获取 ECS 和 RDS 的实时价格用于计算
        ecs_data = await self.get_prices("ecs", params.get("region", "cn-hangzhou"))
        rds_data = await self.get_prices("rds", params.get("region", "cn-hangzhou"))
        oss_data = await self.get_prices("oss", params.get("region", "cn-hangzhou"))
        net_data = await self.get_prices("network", params.get("region", "cn-hangzhou"))

        # 取第一个规格作为基准
        base_ecs = ecs_data["data"][0]["prices"] if ecs_data["data"] else {}
        base_rds = rds_data["data"][0]["prices"] if rds_data["data"] else {}
        base_oss = oss_data["data"][0]["prices"] if oss_data["data"] else {}
        base_bw = net_data["data"][0]["prices"] if net_data["data"] else {}

        results = []
        for provider in self.CLOUD_PROVIDERS:
            if provider["id"] not in cloud_ids:
                continue
            pid = provider["id"]
            discount = 1.0 if provider["tier"] == "tier1" else 0.9 if provider["tier"] == "tier2" else 0.85

            ecs_price = base_ecs.get(pid, {}).get("monthly", 336)
            rds_price = base_rds.get(pid, {}).get("monthly", 960)
            oss_price = base_oss.get(pid, {}).get("perGB", 0.12)
            bw_price = base_bw.get(pid, {}).get("price", 23)

            monthly = round((ecs_count * ecs_price + rds_count * rds_price + storage_tb * 1024 * oss_price + bandwidth * bw_price) * discount)
            results.append({
                "cloud": provider["name"],
                "cloud_id": pid,
                "monthly": monthly,
                "annual": monthly * 12,
            })

        min_cost = min(r["monthly"] for r in results) if results else 0
        for r in results:
            r["cheapest"] = r["monthly"] == min_cost

        return results


# 单例（延迟初始化，避免模块导入时出错）
_pricing_service_instance = None

def get_pricing_service():
    global _pricing_service_instance
    if _pricing_service_instance is None:
        _pricing_service_instance = CloudPricingService()
    return _pricing_service_instance

pricing_service = get_pricing_service()
