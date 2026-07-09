from __future__ import annotations
import re
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user_id
from app.schemas.llm import LLMChatRequest, LLMChatResponse, LLMTestRequest, LLMTestResponse

router = APIRouter(prefix="/llm", tags=["LLM"])


def _normalize_base_url(base_url: str) -> str:
    """归一化 base_url，确保以 /v1 结尾（OpenAI 兼容约定）。

    用户可能填入:
      - https://api.deepseek.com        → 补 /v1
      - https://api.deepseek.com/       → 补 /v1
      - https://api.deepseek.com/v1     → 保持
      - https://api.deepseek.com/v1/    → 去尾斜杠
      - https://ark.cn-beijing.volces.com/api/v3  → 保持（含版本段）
    规则: 如果末尾路径段不是 v1~v9 形式，则补 /v1。
    """
    url = base_url.strip().rstrip("/")
    # 已包含 /vN 版本段（v1 ~ v9）则保持
    if re.search(r"/v\d+$", url):
        return url
    # 否则补 /v1
    return f"{url}/v1"


async def _call_openai_compatible_chat(payload: Dict[str, Any]) -> Dict[str, Any]:
    """通用 OpenAI 兼容 chat/completions 代理调用。"""
    base_url = _normalize_base_url(payload["base_url"])
    url = f"{base_url}/chat/completions"

    body = {
        "model": payload["model"],
        "messages": payload["messages"],
        "temperature": payload.get("temperature", 0.7),
        "max_tokens": payload.get("max_tokens", 2048),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {payload['api_key']}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        res.raise_for_status()
        return res.json()


@router.post("/chat", response_model=LLMChatResponse)
async def chat(
    request: LLMChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """代理 LLM chat/completions 请求。前端无需直接暴露 API Key 给第三方。"""
    try:
        data = await _call_openai_compatible_chat(request.model_dump())
    except httpx.TimeoutException as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"LLM API 请求超时: {e}",
        )
    except httpx.HTTPStatusError as e:
        err_text = e.response.text or "未知错误"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM API 错误 ({e.response.status_code}): {err_text}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM API 调用失败: {str(e)}",
        )

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return LLMChatResponse(
        content=content,
        model=data.get("model"),
        usage=data.get("usage"),
        raw=data,
    )


@router.post("/test", response_model=LLMTestResponse)
async def test(
    request: LLMTestRequest,
    user_id: str = Depends(get_current_user_id),
):
    """测试 LLM 连接是否可用。"""
    messages: List[Dict[str, str]] = [
        {"role": "user", "content": "你好，请回复\"连接成功\"四个字"}
    ]
    try:
        data = await _call_openai_compatible_chat({
            "base_url": request.base_url,
            "api_key": request.api_key,
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        })
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        return LLMTestResponse(
            success=True,
            message=f"模型 {request.model} 响应正常",
            response=content,
        )
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        err_text = e.response.text or ""
        # 常见错误码友好提示
        hints = {
            401: "API Key 无效或已过期，请检查 Key 是否正确",
            402: "账户余额不足（402 Payment Required），请登录厂商控制台充值或更换有额度的 Key",
            403: "无权限访问该模型（403 Forbidden），请检查 Key 权限或模型名是否正确",
            404: "接口地址或模型名不存在（404），请检查 Base URL 和模型名",
            429: "请求频率超限（429），请稍后重试",
        }
        hint = hints.get(code, "")
        return LLMTestResponse(
            success=False,
            message=f"HTTP {code}{' — ' + hint if hint else ''} | {err_text[:300]}",
            response=None,
        )
    except httpx.TimeoutException as e:
        return LLMTestResponse(
            success=False,
            message=f"请求超时（60s），请检查网络或 Base URL 是否可达: {e}",
            response=None,
        )
    except Exception as e:
        return LLMTestResponse(
            success=False,
            message=str(e),
            response=None,
        )
