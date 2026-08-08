from __future__ import annotations

from typing import List, Tuple

import cv2
import numpy as np
from PIL import Image

_MIN_ASPECT = 1.25
_MAX_ASPECT = 14.0
_MIN_AREA_FRACTION = 0.0007
_MAX_AREA_FRACTION = 0.24


def _pad_box(box: Tuple[int, int, int, int], img_w: int, img_h: int, pad_x_frac: float = 0.10, pad_y_frac: float = 0.28) -> Tuple[int, int, int, int]:
    x, y, w, h = box
    pad_x = max(8, int(w * pad_x_frac))
    pad_y = max(6, int(h * pad_y_frac))
    x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
    x1, y1 = min(img_w, x + w + pad_x), min(img_h, y + h + pad_y)
    return x0, y0, max(1, x1 - x0), max(1, y1 - y0)


def _candidate_score(binary: np.ndarray, contour: np.ndarray, y0: int, page_w: int, page_h: int) -> tuple[float, Tuple[int, int, int, int]] | None:
    x, y, w, h = cv2.boundingRect(contour)
    if w < 30 or h < 8:
        return None
    roi = binary[y:y+h, x:x+w]
    area_fraction = (w * h) / max(page_w * page_h, 1)
    aspect = w / max(h, 1)
    if not (_MIN_AREA_FRACTION <= area_fraction <= _MAX_AREA_FRACTION and _MIN_ASPECT <= aspect <= _MAX_ASPECT):
        return None

    ink_density = float(np.mean(roi > 0)) if roi.size else 0.0
    # Signatures usually have moderate ink density and substantial horizontal span.
    if ink_density < 0.008 or ink_density > 0.62:
        return None

    page_y_center = (y0 + y + h / 2) / max(page_h, 1)
    width_ratio = w / max(page_w, 1)
    height_ratio = h / max(page_h, 1)
    horizontal_center = (x + w / 2) / max(page_w, 1)

    density_score = float(np.exp(-abs(ink_density - 0.20) / 0.18))
    lower_score = float(np.clip((page_y_center - 0.25) / 0.75, 0.0, 1.0))
    span_score = float(np.clip(width_ratio / 0.45, 0.0, 1.0))
    compactness = float(np.clip(1.0 - height_ratio / 0.25, 0.0, 1.0))
    center_score = float(1.0 - 0.30 * abs(horizontal_center - 0.5))
    full_width_penalty = float(np.clip((width_ratio - 0.72) / 0.28, 0.0, 1.0))

    # Connected components help reject paragraph-like text blocks.
    n_components, _, stats, _ = cv2.connectedComponentsWithStats(roi, 8)
    components = [int(s[4]) for s in stats[1:] if int(s[4]) >= 4]
    component_score = float(np.clip(len(components) / 10.0, 0.0, 1.0)) if components else 0.0
    text_like_penalty = 0.0
    if len(components) >= 35 and aspect < 8.0:
        text_like_penalty = 0.25

    score = (
        0.25 * density_score
        + 0.20 * lower_score
        + 0.20 * span_score
        + 0.12 * compactness
        + 0.10 * center_score
        + 0.08 * component_score
        - 0.25 * full_width_penalty
        - text_like_penalty
    )
    return score, (x, y0 + y, w, h)


def _find_candidates(image: Image.Image, y0: int, y1: int) -> List[tuple[float, Tuple[int, int, int, int]]]:
    img_w, img_h = image.size
    crop = image.crop((0, y0, img_w, y1))
    gray = cv2.cvtColor(np.asarray(crop), cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 11)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(9, int(img_w * 0.010)), 3))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    scored = []
    for contour in contours:
        result = _candidate_score(closed, contour, y0, img_w, img_h)
        if result is not None:
            scored.append(result)
    return sorted(scored, key=lambda item: item[0], reverse=True)


def detect_signature_region(image: Image.Image) -> Tuple[int, int, int, int]:
    img_w, img_h = image.size
    regions = [
        (int(img_h * 0.55), img_h),
        (int(img_h * 0.30), img_h),
        (0, img_h),
    ]
    candidates: List[tuple[float, Tuple[int, int, int, int]]] = []
    for y0, y1 in regions:
        candidates.extend(_find_candidates(image, y0, y1))
    if candidates:
        # Deduplicate highly-overlapping candidates, keeping the highest score.
        selected = candidates[0][1]
        sx, sy, sw, sh = selected
        return _pad_box((sx, sy, sw, sh), img_w, img_h)

    fb_w = int(img_w * 0.48)
    fb_h = max(1, int(img_h * 0.12))
    fb_x = int((img_w - fb_w) * 0.5)
    fb_y = int(img_h * 0.78)
    return fb_x, fb_y, fb_w, fb_h
