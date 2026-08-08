"""Fast writer-disjoint CEDAR benchmark for DocLens verification.

Expected layout:
    CEDAR/<writer>/original_<writer>_<sample>.png
    CEDAR/<writer>/forgeries_<writer>_<sample>.png

CEDAR signatures are already cropped, so document/signature localization is bypassed.
The dataset must remain outside the repository.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import numpy as np
from PIL import Image

from app.cv.embedder import embed, release_model
from app.cv.explainability import _feature_metrics

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}
ORIGINAL_RE = re.compile(r"^original_(\d+)_(\d+)$", re.IGNORECASE)
FORGERY_RE = re.compile(r"^forgeries_(\d+)_(\d+)$", re.IGNORECASE)


@dataclass(frozen=True)
class Sample:
    path: Path
    writer: str
    genuine: bool


def image_files(root: Path) -> list[Path]:
    return sorted(
        (p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS),
        key=lambda p: str(p).lower(),
    )


def discover_native_cedar(root: Path) -> list[Sample]:
    samples: list[Sample] = []
    writer_dirs = sorted(
        (p for p in root.iterdir() if p.is_dir() and p.name.isdigit()),
        key=lambda p: int(p.name),
    )
    for writer_dir in writer_dirs:
        writer_id = writer_dir.name
        for path in image_files(writer_dir):
            original = ORIGINAL_RE.match(path.stem)
            forgery = FORGERY_RE.match(path.stem)
            if original and original.group(1) == writer_id:
                samples.append(Sample(path, writer_id, True))
            elif forgery and forgery.group(1) == writer_id:
                samples.append(Sample(path, writer_id, False))
    return samples


def discover(root: Path, genuine_dir: str | None, forged_dir: str | None) -> list[Sample]:
    if genuine_dir and forged_dir:
        samples: list[Sample] = []
        for folder_name, genuine in ((genuine_dir, True), (forged_dir, False)):
            folder = root / folder_name
            if not folder.exists():
                continue
            for path in image_files(folder):
                rel = path.relative_to(folder)
                writer = rel.parts[0] if len(rel.parts) > 1 else path.stem.split("_")[0]
                samples.append(Sample(path, writer, genuine))
        return samples
    native = discover_native_cedar(root)
    if native:
        return native
    samples: list[Sample] = []
    for folder_name, genuine in (("full_org", True), ("full_forg", False), ("genuine", True), ("forged", False), ("forgeries", False)):
        folder = root / folder_name
        if not folder.exists():
            continue
        for path in image_files(folder):
            rel = path.relative_to(folder)
            writer = rel.parts[0] if len(rel.parts) > 1 else path.stem.split("_")[0]
            samples.append(Sample(path, writer, genuine))
    return samples


def load(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB")


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0))


def feature_similarity(questioned: Image.Image, reference: Image.Image) -> float:
    metrics = _feature_metrics(questioned, reference)
    if not metrics:
        return 0.0
    return float(np.clip(1.0 - np.mean([m.get("difference", 0.0) for m in metrics]), 0.0, 1.0))


def roc_auc(scores: np.ndarray, labels: np.ndarray) -> float:
    positive = scores[labels == 1]
    negative = scores[labels == 0]
    if len(positive) == 0 or len(negative) == 0:
        return 0.0
    wins = 0.0
    for score in positive:
        wins += float(np.sum(score > negative))
        wins += 0.5 * float(np.sum(score == negative))
    return wins / float(len(positive) * len(negative))


def operating_point(scores: np.ndarray, labels: np.ndarray, threshold: float) -> dict[str, float]:
    predicted = scores >= threshold
    genuine = labels == 1
    forged = labels == 0
    tp = int(np.sum(predicted & genuine))
    fn = int(np.sum(~predicted & genuine))
    fp = int(np.sum(predicted & forged))
    tn = int(np.sum(~predicted & forged))
    far = fp / max(1, fp + tn)
    frr = fn / max(1, fn + tp)
    tar = tp / max(1, tp + fn)
    tnr = tn / max(1, tn + fp)
    return {"far": float(far), "frr": float(frr), "balanced_accuracy": float(0.5 * (tar + tnr))}


def eer(scores: np.ndarray, labels: np.ndarray) -> tuple[float, float]:
    best_gap = float("inf")
    best_eer = 1.0
    best_threshold = 0.5
    thresholds = np.unique(np.concatenate(([0.0, 1.0], scores)))
    for threshold in thresholds:
        metrics = operating_point(scores, labels, float(threshold))
        gap = abs(metrics["far"] - metrics["frr"])
        if gap < best_gap:
            best_gap = gap
            best_eer = 0.5 * (metrics["far"] + metrics["frr"])
            best_threshold = float(threshold)
    return float(best_eer), best_threshold


def split_writers(samples: list[Sample], test_fraction: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    writers = sorted({sample.writer for sample in samples})
    if len(writers) < 2:
        raise SystemExit("At least two writers are required for a writer-disjoint split.")
    random.Random(seed).shuffle(writers)
    calibration_count = max(1, int(round(len(writers) * (1.0 - test_fraction))))
    calibration_count = min(calibration_count, len(writers) - 1)
    calibration_writers = set(writers[:calibration_count])
    return (
        [sample for sample in samples if sample.writer in calibration_writers],
        [sample for sample in samples if sample.writer not in calibration_writers],
    )


def embed_dataset(samples: list[Sample], batch_size: int = 32) -> dict[str, np.ndarray]:
    """Embed signatures in batches with visible progress.

    The existing embed() helper remains the source of truth for preprocessing/model
    behavior. Batching here is intentionally conservative: each batch is processed
    sequentially while progress is reported, so the benchmark stays compatible with
    the current backend model implementation without pretending it has a batch API.
    """
    total = len(samples)
    result: dict[str, np.ndarray] = {}
    started = time.perf_counter()
    last_report = started
    for index, sample in enumerate(samples, start=1):
        result[str(sample.path)] = embed(load(sample.path))
        now = time.perf_counter()
        if index == 1 or index % batch_size == 0 or index == total:
            elapsed = now - started
            rate = index / elapsed if elapsed > 0 else 0.0
            remaining = (total - index) / rate if rate > 0 else 0.0
            print(
                f"  embeddings: {index}/{total} "
                f"({index / total * 100:5.1f}%) | "
                f"{rate:5.1f}/s | ETA {remaining / 60:5.1f} min",
                flush=True,
            )
            last_report = now
    return result


def build_pair_cache(
    samples: list[Sample],
    enrollment: int,
    embeddings: dict[str, np.ndarray],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    by_writer: dict[str, list[Sample]] = {}
    for sample in samples:
        by_writer.setdefault(sample.writer, []).append(sample)

    neural_rows: list[list[float]] = []
    visual_rows: list[list[float]] = []
    labels: list[int] = []
    for writer_samples in by_writer.values():
        genuine = sorted((s for s in writer_samples if s.genuine), key=lambda s: s.path.name)
        forged = sorted((s for s in writer_samples if not s.genuine), key=lambda s: s.path.name)
        if len(genuine) <= enrollment or not forged:
            continue
        references = [(s, load(s.path)) for s in genuine[:enrollment]]
        queries = genuine[enrollment:] + forged
        for query_sample in queries:
            query_image = load(query_sample.path)
            q_emb = embeddings[str(query_sample.path)]
            neural_row: list[float] = []
            visual_row: list[float] = []
            for ref_sample, ref_image in references:
                neural_row.append(cosine(q_emb, embeddings[str(ref_sample.path)]))
                visual_row.append(feature_similarity(query_image, ref_image))
            neural_rows.append(neural_row)
            visual_rows.append(visual_row)
            labels.append(1 if query_sample.genuine else 0)

    if not labels:
        return np.empty((0, enrollment), dtype=np.float32), np.empty((0, enrollment), dtype=np.float32), np.empty(0, dtype=np.int8)
    return np.asarray(neural_rows, dtype=np.float32), np.asarray(visual_rows, dtype=np.float32), np.asarray(labels, dtype=np.int8)


def aggregate_scores(neural: np.ndarray, visual: np.ndarray, embedding_weight: float) -> np.ndarray:
    if neural.size == 0:
        return np.empty(0, dtype=np.float32)
    pair_scores = embedding_weight * neural + (1.0 - embedding_weight) * visual
    return np.max(pair_scores, axis=1).astype(np.float32)


def find_threshold(scores: np.ndarray, labels: np.ndarray) -> tuple[float, dict[str, float]]:
    best_threshold = 0.5
    best_key = (float("inf"), float("inf"), float("inf"))
    best_metrics: dict[str, float] = {}
    thresholds = np.unique(np.concatenate(([0.0, 1.0], scores)))
    for threshold in thresholds:
        metrics = operating_point(scores, labels, float(threshold))
        hter = 0.5 * (metrics["far"] + metrics["frr"])
        key = (hter, -metrics["balanced_accuracy"], abs(float(threshold) - 0.75))
        if key < best_key:
            best_key = key
            best_threshold = float(threshold)
            best_metrics = metrics
    return best_threshold, best_metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast writer-disjoint CEDAR evaluation for DocLens")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--genuine-dir")
    parser.add_argument("--forged-dir")
    parser.add_argument("--enrollment", type=int, default=8)
    parser.add_argument("--test-fraction", type=float, default=0.20)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("cedar_evaluation.json"))
    args = parser.parse_args()

    samples = discover(args.dataset, args.genuine_dir, args.forged_dir)
    writers = {sample.writer for sample in samples}
    genuine_count = sum(sample.genuine for sample in samples)
    forged_count = sum(not sample.genuine for sample in samples)
    if len(writers) < 10 or genuine_count == 0 or forged_count == 0:
        raise SystemExit("Could not find enough CEDAR data. Expected CEDAR/1/original_1_1.png and CEDAR/1/forgeries_1_1.png.")

    calibration, test = split_writers(samples, args.test_fraction, args.seed)
    all_samples = calibration + test

    print(f"CEDAR: {len(writers)} writers, {genuine_count} genuine, {forged_count} forged")
    print(f"Split: {len({s.writer for s in calibration})} calibration writers / {len({s.writer for s in test})} unseen test writers")
    print(f"Embedding {len(all_samples)} signatures...")
    embeddings = embed_dataset(all_samples)

    print("Computing pair evidence once (neural + visual)...", flush=True)
    cal_neural, cal_visual, cal_labels = build_pair_cache(calibration, args.enrollment, embeddings)
    test_neural, test_visual, test_labels = build_pair_cache(test, args.enrollment, embeddings)
    if cal_neural.size == 0 or len(np.unique(cal_labels)) < 2:
        raise SystemExit("Calibration produced no valid genuine/forged comparisons.")
    if test_neural.size == 0 or len(np.unique(test_labels)) < 2:
        raise SystemExit("Test split produced no valid genuine/forged comparisons.")

    print("Calibrating embedding/visual weight...", flush=True)
    best: tuple[float, float, float, dict[str, float]] | None = None
    for weight in np.arange(0.50, 1.001, 0.05):
        embedding_weight = round(float(weight), 2)
        scores = aggregate_scores(cal_neural, cal_visual, embedding_weight)
        threshold, metrics = find_threshold(scores, cal_labels)
        hter = 0.5 * (metrics["far"] + metrics["frr"])
        candidate = (hter, -metrics["balanced_accuracy"], -embedding_weight, {"threshold": threshold, **metrics})
        if best is None or candidate[:3] < best[:3]:
            best = candidate

    if best is None:
        raise SystemExit("Calibration failed to find a valid weight.")

    _, _, negative_weight, calibration_choice = best
    embedding_weight = -negative_weight
    feature_weight = 1.0 - embedding_weight
    threshold = float(calibration_choice.pop("threshold"))

    test_scores = aggregate_scores(test_neural, test_visual, embedding_weight)
    test_metrics = operating_point(test_scores, test_labels, threshold)
    test_eer, eer_threshold = eer(test_scores, test_labels)

    result = {
        "dataset": "CEDAR",
        "protocol": "writer-disjoint calibration/test split; pre-cropped signatures; document detector bypassed",
        "layout": "<writer>/original_<writer>_<sample>.png and <writer>/forgeries_<writer>_<sample>.png",
        "seed": args.seed,
        "writer_count": len(writers),
        "genuine_samples": genuine_count,
        "forged_samples": forged_count,
        "calibration_writers": len({s.writer for s in calibration}),
        "test_writers": len({s.writer for s in test}),
        "enrollment_count": args.enrollment,
        "embedding_weight": embedding_weight,
        "feature_weight": round(feature_weight, 4),
        "threshold": threshold,
        "calibration": {**calibration_choice, "comparisons": int(len(cal_labels))},
        "test": {
            **test_metrics,
            "roc_auc": roc_auc(test_scores, test_labels),
            "eer": test_eer,
            "eer_threshold": eer_threshold,
            "comparisons": int(len(test_scores)),
            "writers": len({s.writer for s in test}),
        },
    }

    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    release_model()


if __name__ == "__main__":
    main()
