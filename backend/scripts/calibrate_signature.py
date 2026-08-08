"""Calibrate DocLens signature verification on a labeled offline-signature dataset.

Expected dataset layout:
    dataset/<writer>/images/*

Files matching --forged-pattern are treated as forged; all other supported image
files are treated as genuine unless --genuine-pattern is used to narrow matching.
The dataset itself is never copied into the repository.

Protocol:
- split writers, never individual images, into calibration/test groups;
- use genuine enrollment samples for each writer;
- compare held-out genuine and forged samples against that writer's enrollment;
- calibrate embedding/CV weight and decision threshold on calibration writers;
- report FAR, FRR, balanced accuracy, ROC-AUC and EER on unseen writers.
"""

from __future__ import annotations

import argparse
import json
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image

from app.cv.embedder import embed, release_model
from app.cv.explainability import _feature_metrics

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}


@dataclass(frozen=True)
class Sample:
    path: Path
    writer: str
    genuine: bool


def discover(root: Path, genuine_pattern: str, forged_pattern: str) -> list[Sample]:
    genuine_re = re.compile(genuine_pattern, re.I)
    forged_re = re.compile(forged_pattern, re.I)
    samples: list[Sample] = []
    for writer_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for path in sorted(writer_dir.rglob("*")):
            if path.suffix.lower() not in IMAGE_EXTS:
                continue
            name = path.name
            if forged_re.search(name):
                samples.append(Sample(path, writer_dir.name, False))
            elif genuine_re.search(name) or not forged_re.search(name):
                samples.append(Sample(path, writer_dir.name, True))
    return samples


def load(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB")


def feature_agreement(q: Image.Image, r: Image.Image) -> float:
    metrics = _feature_metrics(q, r)
    if not metrics:
        return 0.0
    return float(np.clip(1.0 - np.mean([m["difference"] for m in metrics]), 0.0, 1.0))


def hybrid(embedding_similarity: float, feature_similarity: float, embedding_weight: float) -> float:
    return float(np.clip(embedding_weight * embedding_similarity + (1.0 - embedding_weight) * feature_similarity, 0.0, 1.0))


def auc(scores: np.ndarray, labels: np.ndarray) -> float:
    positives = scores[labels == 1]
    negatives = scores[labels == 0]
    if len(positives) == 0 or len(negatives) == 0:
        return 0.0
    wins = 0.0
    for p in positives:
        wins += float(np.sum(p > negatives)) + 0.5 * float(np.sum(p == negatives))
    return wins / (len(positives) * len(negatives))


def operating_point(scores: np.ndarray, labels: np.ndarray, threshold: float) -> dict[str, float]:
    predicted = scores >= threshold
    positive = labels == 1
    negative = labels == 0
    tp = int(np.sum(predicted & positive))
    fn = int(np.sum(~predicted & positive))
    fp = int(np.sum(predicted & negative))
    tn = int(np.sum(~predicted & negative))
    far = fp / max(1, fp + tn)
    frr = fn / max(1, fn + tp)
    return {
        "far": far,
        "frr": frr,
        "balanced_accuracy": 0.5 * ((tp / max(1, tp + fn)) + (tn / max(1, tn + fp))),
    }


def eer(scores: np.ndarray, labels: np.ndarray) -> tuple[float, float]:
    thresholds = np.unique(np.concatenate(([0.0], scores, [1.0])))
    best_gap = 1.0
    best_eer = 0.5
    best_threshold = 0.5
    for threshold in thresholds:
        op = operating_point(scores, labels, float(threshold))
        gap = abs(op["far"] - op["frr"])
        if gap < best_gap:
            best_gap = gap
            best_eer = 0.5 * (op["far"] + op["frr"])
            best_threshold = float(threshold)
    return best_eer, best_threshold


def cache_embeddings(samples: Iterable[Sample]) -> dict[str, np.ndarray]:
    cache: dict[str, np.ndarray] = {}
    for sample in samples:
        cache[str(sample.path)] = embed(load(sample.path))
    return cache


def writer_scores(samples: list[Sample], embeddings: dict[str, np.ndarray], enrollment_count: int, embedding_weight: float) -> tuple[np.ndarray, np.ndarray]:
    by_writer: dict[str, list[Sample]] = {}
    for sample in samples:
        by_writer.setdefault(sample.writer, []).append(sample)

    scores: list[float] = []
    labels: list[int] = []
    for writer_samples in by_writer.values():
        genuine = [s for s in writer_samples if s.genuine]
        forged = [s for s in writer_samples if not s.genuine]
        if len(genuine) <= enrollment_count or not forged:
            continue
        enrollment = genuine[:enrollment_count]
        remaining = genuine[enrollment_count:]
        refs = [(s, load(s.path)) for s in enrollment]
        ref_embs = [embeddings[str(s.path)] for s, _ in refs]

        for sample in remaining + forged:
            q_image = load(sample.path)
            q_emb = embeddings[str(sample.path)]
            sims = [float(np.dot(q_emb, r)) for r in ref_embs]
            best_idx = int(np.argmax(sims))
            feature_sim = feature_agreement(q_image, refs[best_idx][1])
            scores.append(hybrid(max(sims), feature_sim, embedding_weight))
            labels.append(1 if sample.genuine else 0)
    return np.asarray(scores, dtype=np.float32), np.asarray(labels, dtype=np.int8)


def split_writers(samples: list[Sample], test_fraction: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    writers = sorted({s.writer for s in samples})
    rng = random.Random(seed)
    rng.shuffle(writers)
    cut = max(1, int(round(len(writers) * (1.0 - test_fraction))))
    calibration_writers = set(writers[:cut])
    calibration = [s for s in samples if s.writer in calibration_writers]
    test = [s for s in samples if s.writer not in calibration_writers]
    return calibration, test


def calibrate(scores_by_weight: dict[float, tuple[np.ndarray, np.ndarray]]) -> tuple[float, float, dict[str, float]]:
    best = None
    for weight, (scores, labels) in scores_by_weight.items():
        if len(np.unique(labels)) < 2:
            continue
        thresholds = np.unique(np.concatenate(([0.0], scores, [1.0])))
        for threshold in thresholds:
            op = operating_point(scores, labels, float(threshold))
            hter = 0.5 * (op["far"] + op["frr"])
            candidate = (hter, -op["balanced_accuracy"], -weight, float(threshold), op)
            if best is None or candidate < best:
                best = candidate
    if best is None:
        raise SystemExit("Calibration split did not produce both genuine and forged comparisons.")
    return float(-best[2]), float(best[3]), best[4]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path, default=Path("app/cv/calibration.json"))
    parser.add_argument("--test-fraction", type=float, default=0.20)
    parser.add_argument("--enrollment", type=int, default=8)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--genuine-pattern", default=r"(genuine|real|^c-)")
    parser.add_argument("--forged-pattern", default=r"(forg|forge|fake|^cf-)")
    args = parser.parse_args()

    samples = discover(args.dataset, args.genuine_pattern, args.forged_pattern)
    if not samples:
        raise SystemExit("No signature images found. Check the dataset path and filename patterns.")
    if len({s.writer for s in samples}) < 5:
        raise SystemExit("At least five writers are required for a meaningful writer-disjoint evaluation.")

    calibration_samples, test_samples = split_writers(samples, args.test_fraction, args.seed)
    embeddings = cache_embeddings(calibration_samples + test_samples)

    weights = [round(x, 2) for x in np.arange(0.50, 1.01, 0.05)]
    calibration_scores = {weight: writer_scores(calibration_samples, embeddings, args.enrollment, weight) for weight in weights}
    weight, threshold, calibration_op = calibrate(calibration_scores)

    test_scores, test_labels = writer_scores(test_samples, embeddings, args.enrollment, weight)
    if len(np.unique(test_labels)) < 2:
        raise SystemExit("Test split did not produce both genuine and forged comparisons.")
    test_op = operating_point(test_scores, test_labels, threshold)
    test_eer, eer_threshold = eer(test_scores, test_labels)
    result = {
        "schema_version": 1,
        "calibrated": True,
        "dataset": "user-supplied offline signature dataset",
        "protocol": "writer-disjoint enrollment/test split",
        "seed": args.seed,
        "enrollment_count": args.enrollment,
        "embedding_weight": weight,
        "feature_weight": round(1.0 - weight, 4),
        "threshold": threshold,
        "calibration": {**calibration_op, "sample_count": int(len(calibration_scores[weight][0]))},
        "test": {
            **test_op,
            "roc_auc": auc(test_scores, test_labels),
            "eer": test_eer,
            "eer_threshold": eer_threshold,
            "sample_count": int(len(test_scores)),
            "genuine_count": int(np.sum(test_labels == 1)),
            "forged_count": int(np.sum(test_labels == 0)),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    release_model()


if __name__ == "__main__":
    main()
