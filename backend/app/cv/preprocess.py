from __future__ import annotations

import io
import logging

import cv2
import numpy as np
from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = frozenset({"image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp", "application/pdf"})
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
MAX_DIMENSION = 1600


def _deskew(img: Image.Image) -> Image.Image:
    gray = np.asarray(img.convert("L"), dtype=np.uint8)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    points = cv2.findNonZero(binary)
    if points is None or len(points) < 100:
        return img
    angle = cv2.minAreaRect(points)[-1]
    if angle < -45:
        angle += 90
    elif angle > 45:
        angle -= 90
    if abs(angle) < 0.7 or abs(angle) > 12:
        return img
    return img.rotate(float(angle), resample=Image.Resampling.BICUBIC, expand=True, fillcolor="white")


def _pdf_to_image(data: bytes) -> Image.Image:
    """Choose the most promising PDF page, then return the rendered page.

    PDFs are deliberately reduced to a normal page image before entering the
    existing signature detector. Embedded images contribute to page selection,
    while the selected page is still rendered so document context is preserved.
    """
    try:
        from app.pdf.processor import inspect_pdf
        from app.pdf.signature_candidates import rank_candidates

        document = inspect_pdf(data)
        candidates = rank_candidates(document)
        if not candidates:
            raise ValueError("PDF contains no analyzable pages")

        best = candidates[0]
        selected_page = next((p for p in document.pages if p.page_number == best.page), None)
        if selected_page is None:
            raise ValueError("Could not select an analyzable PDF page")

        image = selected_page.image
        logger.info(
            "PDF ingestion selected page=%s source=%s candidate_score=%.3f pages=%s embedded_images=%s",
            best.page,
            best.source,
            best.score,
            document.page_count,
            len(document.embedded_images),
        )
        return image
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF ingestion failed")
        raise HTTPException(status_code=415, detail="The uploaded PDF could not be analyzed.") from exc


def bytes_to_image(data: bytes, content_type: str = "") -> Image.Image:
    ct = (content_type or "").lower().split(";")[0].strip()
    looks_like_pdf = data[:5] == b"%PDF-"
    if looks_like_pdf:
        ct = "application/pdf"
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only JPEG, PNG, WebP, BMP, and PDF files are supported.")
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Files must be 10 MB or smaller.")

    try:
        img = _pdf_to_image(data) if ct == "application/pdf" else Image.open(io.BytesIO(data)).convert("RGB")
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="The uploaded file is not a valid document image.") from exc

    if img.width * img.height > MAX_PIXELS:
        scale = (MAX_PIXELS / float(img.width * img.height)) ** 0.5
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.Resampling.LANCZOS)
    if max(img.width, img.height) > MAX_DIMENSION:
        scale = MAX_DIMENSION / float(max(img.width, img.height))
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.Resampling.LANCZOS)
    return _deskew(img)


def normalize_signature_crop(image: Image.Image, canvas: int = 480) -> Image.Image:
    """Create a display/model crop with visible context around the detected signature.

    The signature remains centered and undistorted, but the crop deliberately keeps
    substantially more whitespace/context so the result is not an extreme zoom.
    """
    rgb = image.convert("RGB")
    gray = np.asarray(rgb.convert("L"), dtype=np.uint8)
    mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    points = cv2.findNonZero(mask)
    if points is not None:
        x, y, w, h = cv2.boundingRect(points)
        pad_x = max(12, int(w * 0.22))
        pad_y = max(12, int(h * 0.35))
        x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
        x1, y1 = min(rgb.width, x + w + pad_x), min(rgb.height, y + h + pad_y)
        rgb = rgb.crop((x0, y0, x1, y1))

    scale = min((canvas - 48) / max(rgb.width, 1), (canvas - 48) / max(rgb.height, 1))
    new_size = (max(1, int(rgb.width * scale)), max(1, int(rgb.height * scale)))
    rgb = rgb.resize(new_size, Image.Resampling.LANCZOS)
    canvas_img = Image.new("RGB", (canvas, canvas), "white")
    offset = ((canvas - rgb.width) // 2, (canvas - rgb.height) // 2)
    canvas_img.paste(rgb, offset)
    return canvas_img
