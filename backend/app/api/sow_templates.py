from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.database import get_db

router = APIRouter(prefix="/sow-templates", tags=["SOW Templates"])


class SowTemplateCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    file_name: Optional[str] = None
    content: Optional[str] = None


class SowTemplateResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str]
    file_name: Optional[str]
    version: int
    content: Optional[str]
    created_at: str


mock_templates = [
    {
        "id": "st001",
        "name": "Landing Zone 标准版 SOW",
        "category": "landing_zone",
        "description": "适用于中大型企业 Landing Zone 项目",
        "file_name": "LZ_SOW_Standard_v2.docx",
        "version": 2,
        "content": "<h3>1. 项目概述</h3><p>本项目旨在为客户构建安全、合规、可管理的云 Landing Zone 基础架构...</p>",
        "created_at": "2024-05-01T10:00:00Z",
    },
    {
        "id": "st002",
        "name": "Migration 迁移项目 SOW",
        "category": "migration",
        "description": "适用于云迁移项目，包含评估、设计、迁移、割接四大阶段",
        "file_name": "Migration_SOW_v1.docx",
        "version": 1,
        "content": "<h3>1. 项目概述</h3><p>本项目旨在将客户现有业务系统从本地机房迁移至目标云平台...</p>",
        "created_at": "2024-04-15T09:00:00Z",
    },
]


@router.get("", response_model=List[SowTemplateResponse])
async def list_templates():
    return mock_templates


@router.post("", response_model=SowTemplateResponse)
async def create_template(template: SowTemplateCreate):
    new_template = {
        "id": str(uuid.uuid4()),
        "name": template.name,
        "category": template.category,
        "description": template.description,
        "file_name": template.file_name,
        "version": 1,
        "content": template.content or "<p>模板内容将在上传后解析显示</p>",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    mock_templates.append(new_template)
    return new_template


@router.get("/{template_id}", response_model=SowTemplateResponse)
async def get_template(template_id: str):
    for t in mock_templates:
        if t["id"] == template_id:
            return t
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    global mock_templates
    mock_templates = [t for t in mock_templates if t["id"] != template_id]
    return {"message": "Template deleted"}


@router.post("/{template_id}/upload")
async def upload_template_file(template_id: str, file: UploadFile = File(...)):
    return {"message": f"File '{file.filename}' uploaded for template {template_id}"}
