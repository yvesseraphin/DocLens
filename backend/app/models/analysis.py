from __future__ import annotations
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class SignatureRegion(_CamelModel):
    x: int
    y: int
    w: int
    h: int


class Point(_CamelModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)


class ForensicMarker(_CamelModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    number: int
    label: str


class Hotspot(_CamelModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    intensity: float = Field(..., ge=0.0, le=1.0)
    radius: float = Field(..., ge=0.0, le=1.0)


class ForensicOverlay(_CamelModel):
    baseline_y: float = Field(..., ge=0.0, le=1.0)
    pen_lifts: List[Point] = Field(default_factory=list)
    markers: List[ForensicMarker] = Field(default_factory=list)
    hotspots: List[Hotspot] = Field(default_factory=list)


class KeyDifference(_CamelModel):
    id: int
    label: str
    impact: Literal["High", "Medium", "Low"]


class ReferenceMatch(_CamelModel):
    rank: int
    source: str
    uploaded_date: str
    score: int = Field(..., ge=0, le=100)
    match_level: str
    sample_text: str = ""
    key_differences: List[str] = Field(default_factory=list)
    feature_scores: List[dict] = Field(default_factory=list)
    crop_url: str = ""


class AnalysisResult(_CamelModel):
    verdict: Literal["FORGED", "GENUINE"]
    confidence: int = Field(..., ge=0, le=100)
    best_score: int = Field(0, ge=0, le=100)
    case_id: str
    case_ref: str = ""
    signer_name: str = ""
    detection_mode: str
    analysis_time: str
    model: str = "DocLens v2.1"
    self_consistency_score: int = Field(0, ge=0, le=100)
    signature_region: Optional[SignatureRegion] = None
    forensic_overlay: Optional[ForensicOverlay] = None
    key_differences: List[KeyDifference] = Field(default_factory=list)
    reference_matches: List[ReferenceMatch] = Field(default_factory=list)
    written_report: str = ""
    questioned_crop_url: str = ""
    reference_crop_urls: List[str] = Field(default_factory=list)
