from __future__ import annotations

import base64
import ctypes
import gc
import io
import logging
import time
from datetime import date, datetime
from typing import List

import cv2
import numpy as np
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageDraw
from supabase import Client

from app.core.storage import upload_file
from app.cv.embedder import embed, release_model
from app.cv.explainability import compute_key_differences, compute_overlay, compute_self_consistency
from app.cv.preprocess import bytes_to_image, normalize_signature_crop
from app.cv.region_detector import detect_signature_region, detect_signature_region_with_confidence
from app.cv.similarity import compute_verdict, detect_disguise, compute_reference_consensus
from app.models.analysis import AnalysisResult, ForensicMarker, ForensicOverlay, Hotspot, KeyDifference, Point, ReferenceMatch, SignatureRegion
from app.services.report_service import generate_written_report

logger = logging.getLogger(__name__)
_MAX_TEXT_LEN = 256


def _sanitize(text: str) -> str:
    return text.strip()[:_MAX_TEXT_LEN] if text else ""


def _release_memory() -> None:
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


def _pil_to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _png_data_url(img: Image.Image) -> str:
    return "data:image/png;base64," + base64.b64encode(_pil_to_png_bytes(img)).decode("ascii")


def _image_quality(image: Image.Image) -> float:
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    if gray.size == 0:
        return 0.0
    contrast = float(np.std(gray))
    sharpness = float(np.var(cv2.Laplacian(gray, cv2.CV_32F)))
    contrast_score = float(np.clip((contrast - 12.0) / 55.0, 0.0, 1.0))
    sharpness_score = float(np.clip(np.log1p(sharpness) / 9.0, 0.0, 1.0))
    return 0.45 * contrast_score + 0.55 * sharpness_score


def _make_context_crop(image: Image.Image, x: int, y: int, w: int, h: int) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Create the user-facing evidence image with generous document context.

    The detected signature box is retained inside the image rather than replacing
    the document with a tightly zoomed signature. This image is for visualization;
    model inference continues to use the normalized analysis crop.
    """
    margin_x = max(80, int(w * 1.25))
    margin_y = max(80, int(h * 1.75))
    cx0 = max(0, x - margin_x)
    cy0 = max(0, y - margin_y)
    cx1 = min(image.width, x + w + margin_x)
    cy1 = min(image.height, y + h + margin_y)
    context = image.crop((cx0, cy0, cx1, cy1)).convert("RGB")

    draw = ImageDraw.Draw(context, "RGBA")
    bx0, by0 = x - cx0, y - cy0
    bx1, by1 = bx0 + w, by0 + h
    draw.rectangle((bx0, by0, bx1, by1), outline=(126, 55, 35, 235), width=max(3, min(context.size) // 180))
    draw.rectangle((bx0, by0, bx1, by1), fill=(126, 55, 35, 18))
    return context, (cx0, cy0, context.width, context.height)


def _map_overlay_to_context(overlay: dict, signature_box: tuple[int, int, int, int], context_box: tuple[int, int, int, int]) -> dict:
    """Map normalized signature-crop evidence coordinates onto the context image."""
    sx, sy, sw, sh = signature_box
    cx, cy, cw, ch = context_box

    def point(x: float, y: float) -> tuple[float, float]:
        abs_x = sx + float(x) * sw
        abs_y = sy + float(y) * sh
        return (
            round(float(np.clip((abs_x - cx) / max(cw, 1), 0.0, 1.0)), 4),
            round(float(np.clip((abs_y - cy) / max(ch, 1), 0.0, 1.0)), 4),
        )

    mapped = dict(overlay)
    _, by = point(0.0, float(overlay.get("baseline_y", 0.72)))
    mapped["baseline_y"] = by

    mapped["pen_lifts"] = []
    for p in overlay.get("pen_lifts", []):
        px, py = point(p.get("x", 0.0), p.get("y", 0.5))
        mapped["pen_lifts"].append({"x": px, "y": py})

    mapped["markers"] = []
    for m in overlay.get("markers", []):
        mx, my = point(m.get("x", 0.5), m.get("y", 0.5))
        mapped["markers"].append({"x": mx, "y": my, "number": m["number"], "label": m["label"]})

    mapped["hotspots"] = []
    radius_scale = min(sw / max(cw, 1), sh / max(ch, 1))
    for h in overlay.get("hotspots", []):
        hx, hy = point(h.get("x", 0.5), h.get("y", 0.5))
        mapped["hotspots"].append({
            "x": hx,
            "y": hy,
            "intensity": h.get("intensity", 0.0),
            "radius": round(float(h.get("radius", 0.08)) * radius_scale, 4),
        })
    return mapped


class AnalysisService:
    TABLE = "cases"

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    async def analyze(self, case_id: str, user_id: str, questioned: UploadFile, references: List[UploadFile]) -> AnalysisResult:
        row = self._sb.table(self.TABLE).select("id, signer_name, case_ref").eq("id", case_id).eq("user_id", user_id).maybe_single().execute()
        if not row.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case {case_id!r} not found.")
        if not references:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one reference specimen is required.")
        signer_name = _sanitize(row.data.get("signer_name", "") or "")
        case_ref = _sanitize(row.data.get("case_ref", "") or case_id)
        self._sb.table(self.TABLE).update({"status": "analyzing"}).eq("id", case_id).execute()
        t_start = time.perf_counter()
        try:
            result = await self._run_pipeline(case_id, user_id, case_ref, signer_name, questioned, references, t_start, row)
        except Exception as exc:
            if isinstance(exc, HTTPException) and isinstance(exc.detail, dict) and str(exc.detail.get("error_code", "")).endswith("_SIGNATURE_NOT_DETECTED"):
                release_model()
                _release_memory()
                raise exc
            self._sb.table(self.TABLE).update({"status": "error"}).eq("id", case_id).execute()
            release_model()
            _release_memory()
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Analysis pipeline failed.") from exc
        self._sb.table(self.TABLE).update({"analysis_result": result.model_dump(by_alias=True), "verdict": result.verdict, "confidence": result.confidence, "status": "analyzed"}).eq("id", case_id).execute()
        return result

    async def _run_pipeline(self, case_id: str, user_id: str, case_ref: str, signer_name: str, questioned_file: UploadFile, reference_files: List[UploadFile], t_start: float, row=None) -> AnalysisResult:
        q_bytes = await questioned_file.read()
        q_image = bytes_to_image(q_bytes, questioned_file.content_type or "")
        del q_bytes
        ref_images = []
        for rf in reference_files:
            rb = await rf.read()
            ref_images.append(bytes_to_image(rb, rf.content_type or ""))
            del rb

        # Validation gate: the legacy detector always returned a fallback box when
        # it found no candidate. That fallback was then treated as a real signature
        # and sent through ResNet18. Use the confidence-aware detector here so an
        # unrelated image cannot reach forensic matching.
        q_detection, q_detection_score = detect_signature_region_with_confidence(q_image)
        if q_detection is None:
            self._sb.table(self.TABLE).update({"status": "uploaded"}).eq("id", case_id).execute()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "NO_SIGNATURE_DETECTED",
                    "message": "No signature was detected in the uploaded questioned specimen. Please upload a clear image containing a handwritten signature.",
                    "detection_score": round(q_detection_score, 3),
                },
            )

        q_x, q_y, q_w, q_h = q_detection
        q_region = q_image.crop((q_x, q_y, q_x + q_w, q_y + q_h)).convert("RGB")
        q_crop = normalize_signature_crop(q_region)
        display_context, context_box = _make_context_crop(q_image, q_x, q_y, q_w, q_h)

        ref_crops = []
        for ref_img in ref_images:
            ref_detection, ref_detection_score = detect_signature_region_with_confidence(ref_img)
            if ref_detection is None:
                self._sb.table(self.TABLE).update({"status": "uploaded"}).eq("id", case_id).execute()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "REFERENCE_SIGNATURE_NOT_DETECTED",
                        "message": "A reference specimen does not contain a detectable signature. Please replace it with a clear handwritten signature sample.",
                        "detection_score": round(ref_detection_score, 3),
                    },
                )
            rx, ry, rw, rh = ref_detection
            ref_crops.append(normalize_signature_crop(ref_img.crop((rx, ry, rx + rw, ry + rh))))
        del ref_images
        _release_memory()

        q_quality = _image_quality(q_crop)
        ref_quality = float(np.mean([_image_quality(rc) for rc in ref_crops])) if ref_crops else 0.0
        q_emb = embed(q_crop)
        ref_embs = [embed(rc) for rc in ref_crops]
        self_consistency = compute_self_consistency(q_crop)

        overlay_raw = compute_overlay(q_region, ref_crops, doc_w=q_region.width, doc_h=q_region.height)
        overlay_dict = _map_overlay_to_context(overlay_raw, (q_x, q_y, q_w, q_h), context_box)
        key_diffs_raw = compute_key_differences(overlay_raw)
        feature_metrics = overlay_raw.get("feature_metrics", [])
        feature_agreement = None if not feature_metrics else 1.0 - float(np.mean([m.get("difference", 0.0) for m in feature_metrics]))

        verdict, confidence, per_ref = compute_verdict(q_emb, ref_embs, feature_agreement=feature_agreement)
        consensus = compute_reference_consensus([s for s, _ in per_ref])
        quality_factor = 0.65 + 0.35 * ((q_quality + ref_quality) / 2.0)
        confidence = int(round(np.clip(confidence * quality_factor * (0.85 + 0.15 * consensus), 0, 100)))
        detection_mode = detect_disguise(q_emb, ref_embs, self_consistency)
        elapsed = f"{time.perf_counter() - t_start:.2f}s"
        display_name = signer_name or "Unknown"

        raw_created = row.data.get("created_at") if row and row.data else None
        if raw_created:
            try:
                uploaded_date = datetime.fromisoformat(raw_created.replace("Z", "+00:00")).strftime("%d %b %Y")
            except Exception:
                uploaded_date = date.today().strftime("%d %b %Y")
        else:
            uploaded_date = date.today().strftime("%d %b %Y")

        forensic_overlay = ForensicOverlay(
            baseline_y=overlay_dict["baseline_y"],
            pen_lifts=[Point(**pl) for pl in overlay_dict["pen_lifts"]],
            markers=[ForensicMarker(**m) for m in overlay_dict["markers"]],
            hotspots=[Hotspot(**h) for h in overlay_dict["hotspots"]],
        )
        key_differences = [KeyDifference(id=kd["id"], label=kd["label"], impact=kd["impact"]) for kd in key_diffs_raw]
        feature_scores = [{"label": m["label"], "score": max(0, min(100, round((1.0 - m["difference"]) * 100)))} for m in feature_metrics]
        best_sim = max((s for s, _ in per_ref), default=0) / 100.0

        written_report = await generate_written_report(
            verdict=verdict,
            confidence=confidence,
            similarity_score=best_sim,
            threshold=0.75,
            detection_mode=detection_mode,
            flagged_regions=[kd["label"] for kd in key_diffs_raw],
            reference_count=len(reference_files),
            key_differences=key_diffs_raw,
            per_ref_scores=[s for s, _ in per_ref],
            feature_scores=feature_scores,
        )

        questioned_crop_url = _png_data_url(display_context)
        reference_crop_urls: List[str] = [_png_data_url(rc) for rc in ref_crops]
        try:
            questioned_crop_url = upload_file(self._sb, f"{user_id}/{case_id}/crops/questioned_crop.png", _pil_to_png_bytes(display_context), "image/png")
            reference_crop_urls = [upload_file(self._sb, f"{user_id}/{case_id}/crops/ref_crop_{i:02d}.png", _pil_to_png_bytes(rc), "image/png") for i, rc in enumerate(ref_crops)]
        except Exception as exc:
            logger.exception("Evidence crop upload failed; using inline PNG data URLs: %s", exc)

        top2_labels = [kd["label"] for kd in key_diffs_raw[:2]]
        reference_matches: List[ReferenceMatch] = []
        ranked = sorted(enumerate(per_ref), key=lambda item: item[1][0], reverse=True)
        for rank, (original_index, (score_pct, mlevel)) in enumerate(ranked, start=1):
            scale = score_pct / 100.0
            reference_matches.append(ReferenceMatch(
                rank=rank,
                source=f"Ref Sample {original_index + 1:02d}",
                uploaded_date=uploaded_date,
                score=score_pct,
                match_level=mlevel,
                sample_text=display_name,
                key_differences=top2_labels,
                feature_scores=[{"label": fs["label"], "score": max(0, min(100, round(fs["score"] * scale)))} for fs in feature_scores],
                crop_url=reference_crop_urls[original_index] if original_index < len(reference_crop_urls) else "",
            ))

        release_model()
        _release_memory()
        return AnalysisResult(
            verdict=verdict,
            confidence=confidence,
            best_score=confidence,
            case_id=case_id,
            case_ref=case_ref,
            signer_name=signer_name,
            detection_mode=detection_mode,
            analysis_time=elapsed,
            model="ResNet18 + Grad-CAM + hybrid CV features + reference consensus",
            self_consistency_score=max(0, min(100, round(self_consistency * 100))),
            signature_region=SignatureRegion(x=q_x, y=q_y, w=q_w, h=q_h),
            forensic_overlay=forensic_overlay,
            key_differences=key_differences,
            reference_matches=reference_matches,
            written_report=written_report,
            questioned_crop_url=questioned_crop_url,
            reference_crop_urls=reference_crop_urls,
        )
