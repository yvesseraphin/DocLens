from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

# These are deliberately conservative fallbacks. Production calibration only becomes
# authoritative when a real calibration artifact generated from labeled data exists.
DEFAULT_GENUINE_THRESHOLD = 0.75
DEFAULT_EMBEDDING_WEIGHT = 0.70
DEFAULT_FEATURE_WEIGHT = 0.30


def _load_calibration() -> tuple[float, float, float, bool]:
    candidates = []
    configured = os.getenv("DOC_LENS_CALIBRATION_PATH")
    if configured:
        candidates.append(Path(configured))
    candidates.append(Path(__file__).with_name("calibration.json"))

    for path in candidates:
        try:
            if not path.is_file():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            if not payload.get("calibrated", False):
                continue
            threshold = float(payload["threshold"])
            embedding_weight = float(payload["embedding_weight"])
            feature_weight = float(payload.get("feature_weight", 1.0 - embedding_weight))
            if not (0.0 < threshold < 1.0):
                continue
            if not (0.0 <= embedding_weight <= 1.0 and 0.0 <= feature_weight <= 1.0):
                continue
            if abs((embedding_weight + feature_weight) - 1.0) > 0.02:
                continue
            return threshold, embedding_weight, feature_weight, True
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            continue

    return DEFAULT_GENUINE_THRESHOLD, DEFAULT_EMBEDDING_WEIGHT, DEFAULT_FEATURE_WEIGHT, False


GENUINE_THRESHOLD, EMBEDDING_WEIGHT, FEATURE_WEIGHT, CALIBRATION_ACTIVE = _load_calibration()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=np.float32).reshape(-1)
    b = np.asarray(b, dtype=np.float32).reshape(-1)
    a_norm = float(np.linalg.norm(a))
    b_norm = float(np.linalg.norm(b))
    if a_norm == 0.0 or b_norm == 0.0:
        return 0.0
    return float(np.clip(np.dot(a, b) / (a_norm * b_norm), -1.0, 1.0))


def score_to_pct(sim: float) -> int:
    return int(round(float(np.clip(sim, 0.0, 1.0)) * 100))


def match_level(score_pct: int) -> str:
    threshold_pct = int(round(GENUINE_THRESHOLD * 100))
    if score_pct >= threshold_pct:
        return "Genuine Match"
    if score_pct >= max(50, threshold_pct - 15):
        return "Weak Match"
    return "Poor Match"


def _hybrid_score(embedding_similarity: float, feature_agreement: Optional[float]) -> float:
    if feature_agreement is None:
        return float(np.clip(embedding_similarity, 0.0, 1.0))
    return float(np.clip(
        EMBEDDING_WEIGHT * np.clip(embedding_similarity, 0.0, 1.0)
        + FEATURE_WEIGHT * np.clip(feature_agreement, 0.0, 1.0),
        0.0,
        1.0,
    ))


def compute_reference_consensus(scores: List[int]) -> float:
    if not scores:
        return 0.0
    values = np.asarray(scores, dtype=np.float32) / 100.0
    if len(values) == 1:
        return float(values[0])
    median = float(np.median(values))
    spread = float(np.std(values))
    agreement = 1.0 - min(spread / 0.20, 1.0)
    return float(np.clip(0.65 * median + 0.35 * agreement, 0.0, 1.0))


def reference_profile_similarity(questioned_emb: np.ndarray, reference_embs: List[np.ndarray]) -> float:
    if not reference_embs:
        return 0.0
    matrix = np.asarray([np.asarray(r, dtype=np.float32).reshape(-1) for r in reference_embs])
    centroid = np.mean(matrix, axis=0)
    norm = float(np.linalg.norm(centroid))
    if norm == 0.0:
        return 0.0
    return cosine_similarity(questioned_emb, centroid / norm)


def compute_verdict(
    questioned_emb: np.ndarray,
    reference_embs: List[np.ndarray],
    feature_agreement: Optional[float] = None,
    per_reference_feature_agreements: Optional[List[Optional[float]]] = None,
) -> Tuple[str, int, List[Tuple[int, str]]]:
    if not reference_embs:
        return "FORGED", 0, []

    per_ref: List[Tuple[int, str]] = []
    for idx, ref_emb in enumerate(reference_embs):
        embedding_similarity = cosine_similarity(questioned_emb, ref_emb)
        ref_feature = feature_agreement
        if per_reference_feature_agreements is not None and idx < len(per_reference_feature_agreements):
            ref_feature = per_reference_feature_agreements[idx]
        score = _hybrid_score(embedding_similarity, ref_feature)
        pct = score_to_pct(score)
        per_ref.append((pct, match_level(pct)))

    scores = [p for p, _ in per_ref]
    best_score = max(scores)
    median_score = float(np.median(scores))
    profile_sim = reference_profile_similarity(questioned_emb, reference_embs)
    profile_score = score_to_pct(_hybrid_score(profile_sim, feature_agreement))
    consensus = compute_reference_consensus(scores)
    evidence_score = 0.45 * best_score + 0.30 * median_score + 0.25 * profile_score
    confidence = 0.55 * (evidence_score / 100.0) + 0.30 * consensus + 0.15 * (profile_score / 100.0)
    verdict = "GENUINE" if evidence_score >= score_to_pct(GENUINE_THRESHOLD) and consensus >= 0.55 and profile_score >= max(65, score_to_pct(GENUINE_THRESHOLD) - 10) else "FORGED"
    return verdict, int(np.clip(round(confidence * 100), 0, 100)), per_ref


def detect_disguise(
    questioned_emb: np.ndarray,
    reference_embs: List[np.ndarray],
    self_consistency_score: float,
) -> str:
    if not reference_embs:
        return "Inconclusive"
    similarities = [cosine_similarity(questioned_emb, r) for r in reference_embs]
    best_ref_sim = max(similarities)
    median_sim = float(np.median(similarities))
    profile_sim = reference_profile_similarity(questioned_emb, reference_embs)
    if best_ref_sim >= GENUINE_THRESHOLD and median_sim >= max(0.65, GENUINE_THRESHOLD - 0.10) and profile_sim >= max(0.65, GENUINE_THRESHOLD - 0.10):
        return "Reference Pattern: Similar"
    if self_consistency_score < 0.45:
        return "Pattern Quality: Low Internal Consistency"
    return "Reference Pattern: Low Similarity"
