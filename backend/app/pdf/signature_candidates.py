from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

from app.cv.region_detector import detect_signature_region


@dataclass(frozen=True)
class SignatureCandidate:
    page: int
    image: Image.Image
    source: str
    score: float
    bbox: tuple[int, int, int, int]
    context_image: Image.Image


def _quality(image: Image.Image) -> float:
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    if gray.size == 0:
        return 0.0
    contrast = float(np.std(gray))
    sharpness = float(np.var(cv2.Laplacian(gray, cv2.CV_32F)))
    contrast_score = float(np.clip((contrast - 10.0) / 60.0, 0.0, 1.0))
    sharpness_score = float(np.clip(np.log1p(sharpness) / 9.0, 0.0, 1.0))
    return 0.45 * contrast_score + 0.55 * sharpness_score


def _ink_score(image: Image.Image) -> float:
    gray = np.asarray(image.convert("L"), dtype=np.uint8)
    binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    density = float(np.mean(binary > 0)) if binary.size else 0.0
    return float(np.exp(-abs(density - 0.16) / 0.16))


def _crop_with_context(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = box
    px = max(40, int(w * 1.25))
    py = max(40, int(h * 1.75))
    return image.crop((max(0, x - px), max(0, y - py), min(image.width, x + w + px), min(image.height, y + h + py))).convert("RGB")


def _candidate_from_page(page_number: int, image: Image.Image) -> SignatureCandidate:
    x, y, w, h = detect_signature_region(image)
    crop = image.crop((x, y, x + w, y + h)).convert("RGB")
    score = 0.60 * _quality(crop) + 0.40 * _ink_score(crop)
    return SignatureCandidate(page_number, crop, "rendered-page", score, (x, y, w, h), _crop_with_context(image, (x, y, w, h)))


def _candidate_from_embedded(page: int, image: Image.Image, index: int) -> SignatureCandidate:
    # Embedded images have no guaranteed document-level signature label, so score them
    # conservatively using the same visual quality signals as rendered candidates.
    x, y, w, h = 0, 0, image.width, image.height
    score = 0.60 * _quality(image) + 0.40 * _ink_score(image)
    return SignatureCandidate(page, image, f"embedded-image-{index}", score, (x, y, w, h), image)


def rank_candidates(document) -> list[SignatureCandidate]:
    candidates: list[SignatureCandidate] = []
    for page in document.pages:
        candidates.append(_candidate_from_page(page.page_number, page.image))
    for index, item in enumerate(document.embedded_images, start=1):
        candidates.append(_candidate_from_embedded(item.page, item.image, index))
    return sorted(candidates, key=lambda c: c.score, reverse=True)
