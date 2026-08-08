import uuid
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.dependencies import CurrentUser, SupabaseClient
from app.models.analysis import AnalysisResult
from app.services.analysis_service import AnalysisService

router = APIRouter(tags=["Analysis"])


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    user: CurrentUser,
    sb: SupabaseClient,
    case_id: str = Form(...),
    questioned: UploadFile = File(...),
    references: Optional[List[UploadFile]] = File(default=None),
) -> AnalysisResult:
    try:
        uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="case_id must be a valid UUID.",
        )
    return await AnalysisService(sb).analyze(
        case_id=case_id,
        user_id=user["id"],
        questioned=questioned,
        references=references or [],
    )
