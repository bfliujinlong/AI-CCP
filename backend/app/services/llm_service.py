"""AICC 共享 LLM 服务。

统一所有 LLM 调用入口，遵循 OpenAI 兼容协议。
- 被 api/llm.py（/chat /test）调用
- 被 services/skill_service.py（Skill 执行）调用

设计:
- call_chat(): 通用 chat/completions 调用，返回 OpenAI 标准响应
- call_structured(): 在 chat 基础上要求 JSON 输出，自动解析
- normalize_base_url(): 自动补 /v1
"""

from __future__ import annotations
import json
import re
from typing import Any, Dict, List, Optional

import httpx


def normalize_base_url(base_url: str) -> str:
    """归一化 base_url，确保以 /v1 结尾（OpenAI 兼容约定）。

    用户可能填入:
      - https://api.deepseek.com        → 补 /v1
      - https://api.deepseek.com/       → 补 /v1
      - https://api.deepseek.com/v1     → 保持
      - https://ark.cn-beijing.volces.com/api/v3  → 保持（含版本段）
      - https://open.bigmodel.cn/api/paas/v4       → 保持（智谱 GLM）
    规则: 如果末尾路径段不是 v1~v9 形式，则补 /v1。
    """
    url = (base_url or "").strip().rstrip("/")
    if re.search(r"/v\d+$", url):
        return url
    return f"{url}/v1"


async def call_chat(
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    timeout: float = 60.0,
) -> Dict[str, Any]:
    """通用 OpenAI 兼容 chat/completions 调用。

    Args:
        base_url: OpenAI 兼容端点（会自动归一化补 /v1）
        api_key: Bearer token
        model: 模型名
        messages: [{"role":"system|user|assistant","content":"..."}]
        temperature: 0.0-2.0
        max_tokens: 最大输出 token 数
        timeout: 超时秒数

    Returns:
        OpenAI 标准响应 dict（含 choices/usage/model 等字段）

    Raises:
        httpx.HTTPStatusError: 4xx/5xx
        httpx.TimeoutException: 超时
    """
    url = f"{normalize_base_url(base_url)}/chat/completions"
    body = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        res.raise_for_status()
        return res.json()


async def call_structured(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    output_schema: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    timeout: float = 90.0,
) -> Dict[str, Any]:
    """调用 LLM 并要求返回 JSON 结构化输出。

    在 prompt 后追加 JSON schema 提示，自动解析响应为 dict。
    解析失败时返回 {"raw_response": <原文>}。

    Args:
        prompt: 用户提示词
        output_schema: 期望的 JSON schema（用于提示 LLM）
        system_prompt: 系统提示词
        其它参数同 call_chat

    Returns:
        dict: LLM 返回的 JSON 结构（解析失败则含 raw_response 键）
    """
    structured_prompt = prompt
    if output_schema:
        structured_prompt = f"""{prompt}

请返回严格的 JSON 格式，匹配以下 schema：
{json.dumps(output_schema, ensure_ascii=False, indent=2)}

重要：只返回有效 JSON，不要 markdown 代码块，不要额外说明文字。"""

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": structured_prompt})

    data = await call_chat(
        base_url=base_url,
        api_key=api_key,
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )

    # 尝试解析 JSON
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        # 兜底：截取 { ... } 之间的内容
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass
        return {"raw_response": content}


def mock_structured_output() -> Dict[str, Any]:
    """未配置 LLM 时的 mock 输出（明确告知用户）。"""
    return {
        "mock": True,
        "message": "未配置 LLM（请在系统设置 → LLM 配置页填入 API Key）。当前返回 mock 数据。",
        "hint": "配置 GLM-4-Flash (免费) / DeepSeek / 通义千问等后，Skill 将输出真实 AI 内容。",
    }
