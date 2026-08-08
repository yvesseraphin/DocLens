"""Multi-seed writer-disjoint CEDAR validation for DocLens.

This intentionally does NOT replace the production calibration artifact. It evaluates
multiple independent writer-disjoint splits and reports mean/std test metrics so we can
check whether the first CEDAR result is robust to the choice of held-out writers.

Run from backend/:
    python scripts/validate_cedar_multiseed.py ..\datasets\CEDAR
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

import numpy as np

from evaluate_cedar import (
    aggregate_scores,
    build_pair_cache,
    discover,
    embed_dataset,
    eer,
    find_threshold,
    roc_auc,
    split_writers,
    operating_point,
)


def mean_std(values: list[float]) -> dict[str, float]:
    if not values:
        return {"mean": 0.0, "std": 0.0}
    return {
        "mean": float(statistics.mean(values)),
        "std": float(statistics.stdev(values)) if len(values) > 1 else 0.0,
    }


def run_seed(samples, embeddings, seed: int, enrollment: int, test_fraction: float) -> dict:
    calibration, test = split_writers(samples, test_fraction, seed)
    cal_neural, cal_visual, cal_labels = build_pair_cache(calibration, enrollment, embeddings)
    test_neural, test_visual, test_labels = build_pair_cache(test, enrollment, embeddings)

    if cal_neural.size == 0 or len(np.unique(cal_labels)) < 2:
        raise RuntimeError(f"Seed {seed}: calibration split has no valid genuine/forged comparisons")
    if test_neural.size == 0 or len(np.unique(test_labels)) < 2:
        raise RuntimeError(f"Seed {seed}: test split has no valid genuine/forged comparisons")

    best = None
    for weight in np.arange(0.50, 1.001, 0.05):
        embedding_weight = round(float(weight), 2)
        cal_scores = aggregate_scores(cal_neural, cal_visual, embedding_weight)
        threshold, metrics = find_threshold(cal_scores, cal_labels)
        hter = 0.5 * (metrics["far"] + metrics["frr"])
        candidate = (hter, -metrics["balanced_accuracy"], -embedding_weight, threshold, metrics)
        if best is None or candidate[:3] < best[:3]:
            best = candidate

    if best is None:
        raise RuntimeError(f"Seed {seed}: calibration failed")

    _, _, negative_weight, threshold, cal_metrics = best
    embedding_weight = -negative_weight
    feature_weight = 1.0 - embedding_weight

    test_scores = aggregate_scores(test_neural, test_visual, embedding_weight)
    test_metrics = operating_point(test_scores, test_labels, threshold)
    test_eer, eer_threshold = eer(test_scores, test_labels)

    return {
        "seed": seed,
        "calibration_writers": len({s.writer for s in calibration}),
        "test_writers": len({s.writer for s in test}),
        "embedding_weight": embedding_weight,
        "feature_weight": round(feature_weight, 4),
        "threshold": float(threshold),
        "calibration": {**cal_metrics, "comparisons": int(len(cal_labels))},
        "test": {
            **test_metrics,
            "roc_auc": roc_auc(test_scores, test_labels),
            "eer": test_eer,
            "eer_threshold": eer_threshold,
            "comparisons": int(len(test_scores)),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-seed writer-disjoint CEDAR validation")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--seeds", nargs="+", type=int, default=[42, 43, 44, 45, 46])
    parser.add_argument("--enrollment", type=int, default=8)
    parser.add_argument("--test-fraction", type=float, default=0.20)
    parser.add_argument("--output", type=Path, default=Path("cedar_multiseed_validation.json"))
    args = parser.parse_args()

    samples = discover(args.dataset, None, None)
    writers = {s.writer for s in samples}
    genuine = sum(s.genuine for s in samples)
    forged = sum(not s.genuine for s in samples)
    if len(writers) < 10 or genuine == 0 or forged == 0:
        raise SystemExit("Expected the native CEDAR layout with writer directories and original_/forgeries_ files.")

    print(f"CEDAR: {len(writers)} writers, {genuine} genuine, {forged} forged")
    print(f"Seeds: {', '.join(map(str, args.seeds))}")
    print(f"Embedding {len(samples)} signatures once; all seeds reuse these embeddings...")
    embeddings = embed_dataset(samples)

    results = []
    for seed in args.seeds:
        print(f"\n=== Writer-disjoint seed {seed} ===", flush=True)
        result = run_seed(samples, embeddings, seed, args.enrollment, args.test_fraction)
        results.append(result)
        print(
            f"seed {seed}: AUC={result['test']['roc_auc']:.5f} "
            f"EER={result['test']['eer']:.4f} "
            f"FAR={result['test']['far']:.4f} "
            f"FRR={result['test']['frr']:.4f} "
            f"weight={result['embedding_weight']:.2f} "
            f"threshold={result['threshold']:.6f}",
            flush=True,
        )

    def collect(path: str) -> list[float]:
        values = []
        for result in results:
            current = result
            for part in path.split("."):
                current = current[part]
            values.append(float(current))
        return values

    summary = {
        "roc_auc": mean_std(collect("test.roc_auc")),
        "eer": mean_std(collect("test.eer")),
        "far": mean_std(collect("test.far")),
        "frr": mean_std(collect("test.frr")),
        "balanced_accuracy": mean_std(collect("test.balanced_accuracy")),
        "threshold": mean_std(collect("threshold")),
        "embedding_weight": mean_std(collect("embedding_weight")),
    }

    output = {
        "dataset": "CEDAR",
        "protocol": "multi-seed writer-disjoint calibration/test validation; test writers never used to select threshold or weights",
        "seeds": args.seeds,
        "writer_count": len(writers),
        "genuine_samples": genuine,
        "forged_samples": forged,
        "enrollment_count": args.enrollment,
        "test_fraction": args.test_fraction,
        "results": results,
        "summary": summary,
        "production_calibration_updated": False,
        "note": "This validation report does not modify calibration.json. Freeze a production calibration only after reviewing cross-seed stability.",
    }

    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print("\n=== Multi-seed summary ===")
    for metric, stats in summary.items():
        print(f"{metric}: mean={stats['mean']:.6f} std={stats['std']:.6f}")
    print(f"\nSaved: {args.output}")


if __name__ == "__main__":
    main()
