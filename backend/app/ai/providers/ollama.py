from __future__ import annotations
import json
import logging
from typing import Any

import httpx
from app.ai.providers.qwen import AIProvider, QwenProvider, MockProvider
from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """本地 Ollama 模型 Provider — 零 API 费用，数据不出服务器。

    通过 OpenAI 兼容 API 调用本地 Ollama 服务。
    支持自动回退：本地模型失败时切换到云端 Qwen API。
    """

    def __init__(self, fallback_provider: AIProvider | None = None):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip('/')
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT
        self.fallback = fallback_provider
        self._consecutive_failures = 0
        self._max_failures_before_fallback = 3

    async def generate(self, prompt: str, system_prompt: str | None = None, **kwargs) -> str:
        try:
            result = await self._call_ollama(prompt, system_prompt, **kwargs)
            self._consecutive_failures = 0
            return result
        except Exception as e:
            self._consecutive_failures += 1
            logger.warning(
                f"Ollama 调用失败 ({self._consecutive_failures}/{self._max_failures_before_fallback}): {e}"
            )
            if self.fallback and self._consecutive_failures >= self._max_failures_before_fallback:
                logger.info("切换到云端回退模型")
                return await self.fallback.generate(prompt, system_prompt, **kwargs)
            raise

    async def generate_structured(self, prompt: str, output_schema: dict, system_prompt: str | None = None, **kwargs) -> dict:
        structured_prompt = f"""{prompt}

Please respond in valid JSON format matching this schema:
{json.dumps(output_schema, ensure_ascii=False, indent=2)}

Important: Return ONLY valid JSON, no markdown formatting, no explanation."""

        try:
            raw = await self._call_ollama(structured_prompt, system_prompt, **kwargs)
            self._consecutive_failures = 0
            return self._parse_json(raw)
        except Exception as e:
            self._consecutive_failures += 1
            logger.warning(
                f"Ollama structured 调用失败 ({self._consecutive_failures}/{self._max_failures_before_fallback}): {e}"
            )
            if self.fallback and self._consecutive_failures >= self._max_failures_before_fallback:
                logger.info("切换到云端回退模型")
                return await self.fallback.generate_structured(prompt, output_schema, system_prompt, **kwargs)
            raise

    async def _call_ollama(self, prompt: str, system_prompt: str | None = None, **kwargs) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2048),
            "stream": False,
        }

        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _parse_json(self, raw: str) -> dict:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        # 尝试提取 JSON 块
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end])
            except json.JSONDecodeError:
                pass
        # 尝试 markdown 代码块
        if "```json" in raw:
            json_start = raw.find("```json") + 7
            json_end = raw.find("```", json_start)
            if json_end > json_start:
                try:
                    return json.loads(raw[json_start:json_end].strip())
                except json.JSONDecodeError:
                    pass
        return {"raw_response": raw}

    async def health_check(self) -> dict:
        """检查 Ollama 服务是否可用"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url.replace('/v1', '')}/api/tags")
                if resp.status_code == 200:
                    models = resp.json().get("models", [])
                    model_names = [m.get("name", "") for m in models]
                    return {
                        "status": "healthy",
                        "model": self.model,
                        "model_available": any(self.model in name for name in model_names),
                        "available_models": model_names,
                        "consecutive_failures": self._consecutive_failures,
                    }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "consecutive_failures": self._consecutive_failures,
            }


def get_ai_provider_with_fallback() -> AIProvider:
    """获取 AI Provider，优先本地 Ollama，失败时自动回退云端。

    策略：
    1. 如果配置了 OLLAMA_ENABLED=true，优先使用本地 Ollama
    2. Ollama 连续失败 3 次后自动回退到 QwenProvider（云端）
    3. 如果 Ollama 未启用，直接使用 QwenProvider 或 MockProvider
    """
    if settings.OLLAMA_ENABLED:
        fallback = None
        if settings.QWEN_API_KEY:
            fallback = QwenProvider()
        return OllamaProvider(fallback_provider=fallback)
    elif settings.QWEN_API_KEY:
        return QwenProvider()
    else:
        return MockProvider()
