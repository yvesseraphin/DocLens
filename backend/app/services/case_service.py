from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from supabase import Client

from app.core.storage import (
    build_questioned_path,
    build_reference_path,
    safe_image_filename,
    upload_file,
)
from app.cv.preprocess import bytes_to_image
from app.models.case import (
    CaseOut,
    CreateCaseRequest,
    UpdateCaseRequest,
    UploadFilesResponse,
)


class CaseService:
    TABLE = "cases"

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def _assert_ownership(self, case_id: str, user_id: str) -> dict:
        resp = (
            self._sb.table(self.TABLE)
            .select("*")
            .eq("id", case_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case {case_id!r} not found.",
            )
        return resp.data

    def list_cases(self, user_id: str) -> List[CaseOut]:
        resp = (
            self._sb.table(self.TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [CaseOut(**row) for row in (resp.data or [])]

    def create_case(self, body: CreateCaseRequest, user_id: str) -> CaseOut:
        record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "case_ref": body.case_ref,
            "case_type": body.case_type,
            "subject_names": body.subject_names,
            "signer_name": body.signer_name,
            "date_received": body.date_received,
            "upload_reason": body.upload_reason or "",
            "sample_description": body.sample_description or "",
            "status": "pending",
        }
        resp = self._sb.table(self.TABLE).insert(record).execute()
        if not resp.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create case.",
            )
        return CaseOut(**resp.data[0])

    def get_case(self, case_id: str, user_id: str) -> CaseOut:
        row = self._assert_ownership(case_id, user_id)
        return CaseOut(**row)

    def update_case(self, case_id: str, body: UpdateCaseRequest, user_id: str) -> CaseOut:
        self._assert_ownership(case_id, user_id)
        patch = body.model_dump(exclude_none=True)
        if not patch:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No updatable fields provided.",
            )
        resp = (
            self._sb.table(self.TABLE)
            .update(patch)
            .eq("id", case_id)
            .eq("user_id", user_id)
            .execute()
        )
        return CaseOut(**resp.data[0])

    def delete_case(self, case_id: str, user_id: str) -> None:
        self._assert_ownership(case_id, user_id)
        self._sb.table(self.TABLE).delete().eq("id", case_id).execute()

    async def upload_files(
        self,
        case_id: str,
        user_id: str,
        questioned: UploadFile,
        references: Optional[List[UploadFile]] = None,
    ) -> UploadFilesResponse:
        self._assert_ownership(case_id, user_id)

        q_bytes = await questioned.read()
        bytes_to_image(q_bytes, questioned.content_type or "")
        q_name = safe_image_filename(questioned.filename, questioned.content_type or "", "questioned")
        q_url = upload_file(
            self._sb,
            build_questioned_path(user_id, case_id, q_name),
            q_bytes,
            questioned.content_type or "application/octet-stream",
        )

        ref_urls: List[str] = []
        for index, ref in enumerate(references or [], start=1):
            r_bytes = await ref.read()
            bytes_to_image(r_bytes, ref.content_type or "")
            r_name = safe_image_filename(ref.filename, ref.content_type or "", f"reference-{index}")
            ref_urls.append(upload_file(
                self._sb,
                build_reference_path(user_id, case_id, r_name),
                r_bytes,
                ref.content_type or "application/octet-stream",
            ))

        self._sb.table(self.TABLE).update(
            {"questioned_url": q_url, "reference_urls": ref_urls, "status": "uploaded"}
        ).eq("id", case_id).execute()

        return UploadFilesResponse(questioned_url=q_url, reference_urls=ref_urls)
