from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class CreateCaseRequest(BaseModel):
    case_ref: str = Field(
        ...,
        min_length=1,
        max_length=64,
        alias="case_id",
        examples=["FDE-202464"],
    )
    case_type: str = Field(..., examples=["Forgery"])
    subject_names: str = Field(default="", max_length=512)
    signer_name: str = Field(default="", max_length=256)
    date_received: str = Field(default="", examples=["2026-06-01"])
    upload_reason: Optional[str] = Field(default="", max_length=1024)
    sample_description: Optional[str] = Field(default="", max_length=1024)

    model_config = {"populate_by_name": True}


class UpdateCaseRequest(BaseModel):
    case_type: Optional[str] = None
    subject_names: Optional[str] = None
    signer_name: Optional[str] = None
    date_received: Optional[str] = None
    upload_reason: Optional[str] = None
    sample_description: Optional[str] = None
    status: Optional[str] = None


class CaseOut(BaseModel):
    id: str
    user_id: str
    case_ref: str
    case_type: str
    subject_names: str = ""
    signer_name: str = ""
    date_received: str = ""
    upload_reason: str = ""
    sample_description: str = ""

    questioned_url: Optional[str] = None
    reference_urls: List[str] = Field(default_factory=list)

    status: str = "pending"
    verdict: Optional[str] = None
    confidence: Optional[int] = None
    analysis_result: Optional[Any] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UploadFilesResponse(BaseModel):
    questioned_url: str
    reference_urls: List[str]
