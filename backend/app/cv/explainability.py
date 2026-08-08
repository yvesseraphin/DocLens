from __future__ import annotations

from typing import List

import cv2
import numpy as np
from PIL import Image

from app.cv.embedder import embed, get_model, to_tensor

_TARGET_LAYER_NAME = "layer4"
_FEATURE_LABELS = [
    "Stroke Width Variation",
    "Letter Proportion Inconsistency",
    "Baseline Deviation",
    "Pen Lift Positions",
    "Slant Deviation",
]


def _ink_mask(image: Image.Image) -> np.ndarray:
    gray = np.array(image.convert("L"), dtype=np.uint8)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return mask


def _stroke_width(mask: np.ndarray) -> float:
    if not np.any(mask):
        return 0.0
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
    values = dist[mask > 0]
    return float(np.median(values) * 2.0) if values.size else 0.0


def _component_profile(mask: np.ndarray) -> tuple[float, float]:
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    aspects: list[float] = []
    heights: list[float] = []
    min_area = max(8, mask.size * 0.00015)
    for i in range(1, n):
        _, _, w, h, area = stats[i]
        if area < min_area or h < 3 or w < 2:
            continue
        aspects.append(w / max(h, 1))
        heights.append(float(h))
    if not aspects:
        return 0.0, 0.0
    return float(np.median(aspects)), float(np.median(heights))


def _baseline_slope(mask: np.ndarray) -> float:
    ys, xs = np.where(mask > 0)
    if len(xs) < 8 or np.ptp(xs) < 4:
        return 0.0
    keep = ys >= np.percentile(ys, 20)
    if keep.sum() < 8:
        return 0.0
    slope = np.polyfit(xs[keep].astype(np.float32), ys[keep].astype(np.float32), 1)[0]
    return float(np.arctan(slope))


def _pen_lift_count(mask: np.ndarray) -> int:
    projection = np.sum(mask > 0, axis=0)
    if projection.size < 8:
        return 0
    threshold = max(1, int(mask.shape[0] * 0.015))
    active = projection > threshold
    transitions = np.diff(active.astype(np.int8))
    return max(0, int(np.sum(transitions == -1)))


def _principal_angle(mask: np.ndarray) -> float:
    ys, xs = np.where(mask > 0)
    if len(xs) < 8:
        return 0.0
    points = np.column_stack((xs.astype(np.float32), ys.astype(np.float32)))
    cov = np.cov(points.T)
    vals, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, int(np.argmax(vals))]
    return float(np.arctan2(vy, vx))


def _relative_difference(a: float, b: float) -> float:
    if abs(a) < 1e-6 and abs(b) < 1e-6:
        return 0.0
    return float(np.clip(abs(a - b) / max(abs(a), abs(b), 1e-6), 0.0, 1.0))


def _feature_metrics(questioned: Image.Image, reference: Image.Image) -> list[dict]:
    q = questioned.resize((224, 224), Image.Resampling.BILINEAR)
    r = reference.resize((224, 224), Image.Resampling.BILINEAR)
    qm, rm = _ink_mask(q), _ink_mask(r)
    q_stroke, r_stroke = _stroke_width(qm), _stroke_width(rm)
    q_aspect, q_height = _component_profile(qm)
    r_aspect, r_height = _component_profile(rm)
    q_base, r_base = _baseline_slope(qm), _baseline_slope(rm)
    q_lifts, r_lifts = _pen_lift_count(qm), _pen_lift_count(rm)
    q_slant, r_slant = _principal_angle(qm), _principal_angle(rm)

    raw = [
        _relative_difference(q_stroke, r_stroke),
        0.65 * _relative_difference(q_aspect, r_aspect) + 0.35 * _relative_difference(q_height, r_height),
        min(1.0, abs(q_base - r_base) / 0.45),
        min(1.0, abs(q_lifts - r_lifts) / max(3, q_lifts, r_lifts)),
        min(1.0, abs(q_slant - r_slant) / 0.9),
    ]
    metrics = []
    for label, diff in zip(_FEATURE_LABELS, raw):
        diff = float(np.clip(diff, 0.0, 1.0))
        impact = "High" if diff >= 0.45 else "Medium" if diff >= 0.22 else "Low"
        metrics.append({"label": label, "difference": round(diff, 4), "impact": impact})
    return metrics


def _detect_pen_lifts(crop: Image.Image) -> List[dict]:
    mask = _ink_mask(crop)
    h, w = mask.shape
    if w < 8:
        return []
    projection = np.sum(mask > 0, axis=0)
    active = projection > max(1, int(h * 0.015))
    lifts: list[dict] = []
    for x in range(1, w - 1):
        if not active[x] and active[x - 1] and active[x + 1]:
            lifts.append({"x": round(x / w, 3), "y": 0.5})
            if len(lifts) >= 5:
                break
    return lifts


def _detect_baseline(crop: Image.Image) -> float:
    mask = _ink_mask(crop)
    h = mask.shape[0]
    start = int(h * 0.4)
    row_ink = np.mean(mask[start:] > 0, axis=1)
    if row_ink.size == 0 or float(row_ink.max()) < 0.01:
        return 0.72
    return round((int(np.argmax(row_ink)) + start) / max(h, 1), 3)


def _gradcam_heatmap(questioned_crop: Image.Image, best_reference_crop: Image.Image) -> np.ndarray:
    try:
        from pytorch_grad_cam import GradCAM
    except ImportError:
        return np.zeros((questioned_crop.height, questioned_crop.width), dtype=np.float32)

    import gc
    import torch

    model = get_model()
    target_layer = getattr(model, _TARGET_LAYER_NAME)
    ref_tensor = to_tensor(best_reference_crop)
    with torch.inference_mode():
        ref_feat = model(ref_tensor)

    class _DifferenceTarget:
        def __init__(self, ref: torch.Tensor):
            self.ref = ref

        def __call__(self, model_output: torch.Tensor) -> torch.Tensor:
            return (model_output - self.ref).norm(dim=1)

    q_tensor = to_tensor(questioned_crop)
    cam = GradCAM(model=model, target_layers=[target_layer])
    try:
        heatmap = cam(input_tensor=q_tensor, targets=[_DifferenceTarget(ref_feat)])[0]
    finally:
        del cam, q_tensor, ref_tensor, ref_feat
        gc.collect()

    return cv2.resize(
        heatmap,
        (questioned_crop.width, questioned_crop.height),
        interpolation=cv2.INTER_LINEAR,
    ).astype(np.float32)


def compute_self_consistency(crop: Image.Image) -> float:
    """Estimate internal consistency from spatial stroke structure, not document geometry alone."""
    mask = _ink_mask(crop)
    ys, xs = np.where(mask > 0)
    if len(xs) < 20:
        return 0.0

    mid = max(1, crop.width // 2)
    left = crop.crop((0, 0, mid, crop.height))
    right = crop.crop((mid, 0, crop.width, crop.height))
    left_emb = embed(left)
    right_emb = embed(right)
    half_similarity = float(np.clip(np.dot(left_emb, right_emb), -1.0, 1.0))

    mask_f = mask.astype(np.float32) / 255.0
    col_profile = mask_f.mean(axis=0)
    row_profile = mask_f.mean(axis=1)
    col_variation = float(np.std(col_profile) / max(np.mean(col_profile), 1e-3))
    row_variation = float(np.std(row_profile) / max(np.mean(row_profile), 1e-3))
    regularity = float(np.exp(-0.08 * min(col_variation + row_variation, 12.0)))

    return float(np.clip(0.75 * half_similarity + 0.25 * regularity, 0.0, 1.0))


def compute_overlay(
    questioned_crop: Image.Image,
    reference_crops: List[Image.Image],
    doc_w: int = 0,
    doc_h: int = 0,
    crop_x: int = 0,
    crop_y: int = 0,
) -> dict:
    crop_w, crop_h = questioned_crop.size
    eff_doc_w = doc_w or crop_w
    eff_doc_h = doc_h or crop_h

    def to_doc_x(cx: float) -> float:
        return round(min(1.0, max(0.0, (crop_x + cx * crop_w) / eff_doc_w)), 4)

    def to_doc_y(cy: float) -> float:
        return round(min(1.0, max(0.0, (crop_y + cy * crop_h) / eff_doc_h)), 4)

    if reference_crops:
        q_emb = embed(questioned_crop)
        ref_embs = [embed(rc) for rc in reference_crops]
        sims = [float(np.dot(q_emb, ref_emb)) for ref_emb in ref_embs]
        best_ref = reference_crops[int(np.argmax(sims))]
        heatmap = _gradcam_heatmap(questioned_crop, best_ref)
        feature_metrics = _feature_metrics(questioned_crop, best_ref)
    else:
        heatmap = np.zeros((crop_h, crop_w), dtype=np.float32)
        feature_metrics = [{"label": label, "difference": 0.0, "impact": "Low"} for label in _FEATURE_LABELS]

    cols, rows = 8, 4
    cell_h = max(1, crop_h // rows)
    cell_w = max(1, crop_w // cols)
    intensities = []
    for r in range(rows):
        for c in range(cols):
            y0, y1 = r * cell_h, min(crop_h, (r + 1) * cell_h)
            x0, x1 = c * cell_w, min(crop_w, (c + 1) * cell_w)
            cell = heatmap[y0:y1, x0:x1]
            intensities.append(float(cell.mean()) if cell.size else 0.0)

    ci_arr = np.asarray(intensities, dtype=np.float32)
    ci_min, ci_max = float(ci_arr.min()), float(ci_arr.max())
    ci_norm = (ci_arr - ci_min) / (ci_max - ci_min) if ci_max > ci_min else np.zeros_like(ci_arr)
    top_idx = np.argsort(ci_norm)[::-1][:5]

    hotspots = []
    for idx in top_idx:
        r, c = divmod(int(idx), cols)
        intensity = round(float(ci_norm[idx]), 3)
        hotspots.append({
            "x": to_doc_x((c + 0.5) / cols),
            "y": to_doc_y((r + 0.5) / rows),
            "intensity": intensity,
            "radius": round(0.06 + intensity * 0.08, 3),
        })

    ranked_metrics = sorted(feature_metrics, key=lambda item: item["difference"], reverse=True)
    markers = []
    for num, metric in enumerate(ranked_metrics, start=1):
        idx = int(top_idx[min(num - 1, len(top_idx) - 1)]) if len(top_idx) else 0
        r, c = divmod(idx, cols)
        markers.append({
            "x": to_doc_x((c + 0.5) / cols),
            "y": to_doc_y((r + 0.5) / rows),
            "number": num,
            "label": metric["label"],
        })

    return {
        "baseline_y": to_doc_y(_detect_baseline(questioned_crop)),
        "pen_lifts": [{"x": to_doc_x(p["x"]), "y": to_doc_y(p["y"])} for p in _detect_pen_lifts(questioned_crop)],
        "markers": markers,
        "hotspots": hotspots,
        "feature_metrics": ranked_metrics,
    }


def compute_key_differences(overlay: dict) -> List[dict]:
    return [
        {"id": i, "label": metric["label"], "impact": metric["impact"]}
        for i, metric in enumerate(overlay.get("feature_metrics", []), start=1)
    ]
