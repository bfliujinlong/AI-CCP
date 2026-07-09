from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any

import httpx
from app.core.config import settings


class AIProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str | None = None, **kwargs) -> str:
        pass

    @abstractmethod
    async def generate_structured(self, prompt: str, output_schema: dict, system_prompt: str | None = None, **kwargs) -> dict:
        pass


class QwenProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.QWEN_API_KEY
        self.model = settings.QWEN_MODEL
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

    async def generate(self, prompt: str, system_prompt: str | None = None, **kwargs) -> str:
        if not self.api_key:
            return self._mock_response(prompt)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "input": {"messages": messages},
            "parameters": {"result_format": "message", **kwargs},
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["output"]["choices"][0]["message"]["content"]

    async def generate_structured(self, prompt: str, output_schema: dict, system_prompt: str | None = None, **kwargs) -> dict:
        structured_prompt = f"""{prompt}

Please respond in valid JSON format matching this schema:
{output_schema}

Important: Return ONLY valid JSON, no markdown formatting."""
        raw = await self.generate(structured_prompt, system_prompt, **kwargs)
        import json
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(raw[start:end])
                except json.JSONDecodeError:
                    pass
            return {"raw_response": raw}

    def _mock_response(self, prompt: str) -> str:
        return """{
    "questions": [
        {"category": "Governance", "question": "How many cloud accounts are needed?", "purpose": "Determine governance scope"},
        {"category": "Network", "question": "How many VPCs are required?", "purpose": "Plan network architecture"},
        {"category": "Security", "question": "What compliance standards must be met?", "purpose": "Define security requirements"},
        {"category": "Identity", "question": "How many users need cloud access?", "purpose": "Plan IAM structure"}
    ]
}"""


class MockProvider(AIProvider):
    async def generate(self, prompt: str, system_prompt: str | None = None, **kwargs) -> str:
        return "Mock AI response. Please configure QWEN_API_KEY for real AI capabilities."

    async def generate_structured(self, prompt: str, output_schema: dict, system_prompt: str | None = None, **kwargs) -> dict:
        return {"mock": True, "message": "Please configure QWEN_API_KEY for real AI capabilities."}


def get_ai_provider() -> AIProvider:
    if settings.QWEN_API_KEY:
        return QwenProvider()
    return MockProvider()
