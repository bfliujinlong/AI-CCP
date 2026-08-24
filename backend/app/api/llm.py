from __future__ import annotations
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user_id
from app.schemas.llm import LLMChatRequest, LLMChatResponse, LLMTestRequest, LLMTestResponse
from app.services.llm_service import call_chat, normalize_base_url

router = APIRouter(prefix="/llm", tags=["LLM"])


@router.post("/chat", response_model=LLMChatResponse)
async def chat(
    request: LLMChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """代理 LLM chat/completions 请求。前端无需直接暴露 API Key 给第三方。"""
    try:
        data = await call_chat(
            base_url=request.base_url,
            api_key=request.api_key,
            model=request.model,
            messages=[m.model_dump() for m in request.messages],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
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
        data = await call_chat(
            base_url=request.base_url,
            api_key=request.api_key,
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
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


@router.get("/normalize-url")
async def normalize_url_demo(base_url: str, user_id: str = Depends(get_current_user_id)):
    """调试用：展示 base_url 归一化结果。"""
    return {"input": base_url, "normalized": normalize_base_url(base_url)}
