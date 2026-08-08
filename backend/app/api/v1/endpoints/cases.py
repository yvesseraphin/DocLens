import uuid
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status

from app.dependencies import CurrentUser, SupabaseClient
from app.models.case import CaseOut, CreateCaseRequest, UpdateCaseRequest, UploadFilesResponse
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["Cases"])


def _validate_case_id(case_id: str) -> None:
    try:
        uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="case_id must be a valid UUID.",
        )


@router.get("", response_model=List[CaseOut])
async def list_cases(user: CurrentUser, sb: SupabaseClient) -> List[CaseOut]:
    return CaseService(sb).list_cases(user["id"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CaseOut)
async def create_case(body: CreateCaseRequest, user: CurrentUser, sb: SupabaseClient) -> CaseOut:
    return CaseService(sb).create_case(body, user["id"])


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(case_id: str, user: CurrentUser, sb: SupabaseClient) -> CaseOut:
    _validate_case_id(case_id)
    return CaseService(sb).get_case(case_id, user["id"])


@router.patch("/{case_id}", response_model=CaseOut)
async def update_case(case_id: str, body: UpdateCaseRequest, user: CurrentUser, sb: SupabaseClient) -> CaseOut:
    _validate_case_id(case_id)
    return CaseService(sb).update_case(case_id, body, user["id"])


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(case_id: str, user: CurrentUser, sb: SupabaseClient) -> Response:
    _validate_case_id(case_id)
    CaseService(sb).delete_case(case_id, user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{case_id}/upload", response_model=UploadFilesResponse)
async def upload_files(
    case_id: str,
    user: CurrentUser,
    sb: SupabaseClient,
    questioned: UploadFile = File(...),
    references: Optional[List[UploadFile]] = File(default=None),
) -> UploadFilesResponse:
    _validate_case_id(case_id)
    return await CaseService(sb).upload_files(case_id, user["id"], questioned, references or [])
