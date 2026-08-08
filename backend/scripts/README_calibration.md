# Signature calibration

DocLens now includes an offline evaluator at `scripts/calibrate_signature.py`.

## Why this exists

The production similarity threshold must not be selected because `0.75` looks reasonable. A signature verifier should be evaluated on labeled genuine/forged comparisons and the operating threshold should be selected from a calibration split.

## Evaluation protocol

The evaluator uses a **writer-disjoint split**. Writers in the calibration partition never appear in the test partition. This prevents the threshold from being tuned on the same people used for the final measurement.

For each writer:

1. Reserve a fixed number of genuine signatures as enrollment references.
2. Compare remaining genuine signatures against those references.
3. Compare known forged signatures against those references.
4. Combine neural embedding similarity with measured CV feature agreement.
5. Tune the embedding/CV weight and decision threshold on calibration writers.
6. Evaluate the selected parameters on unseen writers.

Reported metrics:

- FAR (false acceptance rate)
- FRR (false rejection rate)
- balanced accuracy
- ROC-AUC
- EER and its operating threshold

## Dataset

Do **not** commit a public or private signature dataset to this repository. Download/use the dataset separately and point the script at a local directory.

Expected structure:

```text
DATASET/
  writer_001/
    genuine_01.png
    genuine_02.png
    forged_01.png
  writer_002/
    genuine_01.png
    forged_01.png
```

The default filename rules treat names containing `forg`, `forge`, or `fake` as forged and other supported images as genuine. Override the patterns if your dataset uses another convention.

## Run

From `backend/`:

```bash
python scripts/calibrate_signature.py /path/to/DATASET --output app/cv/calibration.json
```

The default protocol uses 8 genuine enrollment samples and a 20% writer-disjoint test split. Change these only when the dataset protocol justifies it.

## Important

The script generates the calibration artifact only after it has actually evaluated a labeled dataset. Until that happens, DocLens must continue using its heuristic threshold; **do not invent or manually enter performance numbers**.

For a serious evaluation, repeat the writer-disjoint split with several seeds or use cross-validation and report confidence intervals. A single split is useful for development but is not sufficient evidence for legal or forensic deployment.
