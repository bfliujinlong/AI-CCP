from __future__ import annotations
from typing import List, Dict, Optional, Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class LLMChatRequest(BaseModel):
    provider: str = Field(..., description="LLM provider identifier")
    api_key: str = Field(..., min_length=1, description="API key for the provider")
    model: str = Field(..., min_length=1, description="Model name or endpoint id")
    base_url: str = Field(..., min_length=1, description="OpenAI-compatible base URL")
    messages: List[ChatMessage] = Field(default_factory=list)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=8192)


class LLMTestRequest(BaseModel):
    provider: str = Field(..., description="LLM provider identifier")
    api_key: str = Field(..., min_length=1, description="API key for the provider")
    model: str = Field(..., min_length=1, description="Model name or endpoint id")
    base_url: str = Field(..., min_length=1, description="OpenAI-compatible base URL")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    max_tokens: int = Field(default=50, ge=1, le=8192)


class LLMChatResponse(BaseModel):
    content: str
    model: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    raw: Optional[Dict[str, Any]] = None


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    response: Optional[str] = None
