# DocLens

> # **Don't just get a verdict. See the evidence.**
>
> **AI-assisted forensic signature analysis with calibrated assessment, multi-reference comparison, visual evidence, and explainable reports.**

**Live application:** https://doclens.yvesseraphin.xyz  
**Source code:** https://github.com/yvesseraphin/DocLens

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [What DocLens Does](#what-doclens-does)
- [How the Analysis Works](#how-the-analysis-works)
- [Validation and Results](#validation-and-results)
- [Technical Architecture](#technical-architecture)
- [Computer Vision Pipeline](#computer-vision-pipeline)
- [PDF Processing](#pdf-processing)
- [AI-Assisted Reporting](#ai-assisted-reporting)
- [Case Management and Security](#case-management-and-security)
- [Frontend](#frontend)
- [Backend API](#backend-api)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Evaluation Reproduction](#evaluation-reproduction)
- [Reliability and Deployment](#reliability-and-deployment)
- [Limitations and Responsible Use](#limitations-and-responsible-use)
- [Future Direction](#future-direction)

---

## Overview

DocLens is a web application for **AI-assisted forensic signature analysis**. It accepts a questioned document and trusted reference specimens, automatically locates a likely signature, builds a deep visual representation, compares the questioned signature against the reference set, measures structural differences, produces visual evidence, and generates an explainable report.

The project is designed around a simple principle:

> **When an AI-assisted assessment matters, the reviewer should be able to follow the evidence behind it.**

DocLens therefore treats the assessment as the output of a complete analysis pipeline rather than an isolated model prediction.

```text
Questioned document + trusted references
                    │
                    ▼
           Document preprocessing
                    │
                    ▼
        Automatic signature localization
                    │
                    ▼
          Deep visual representation
                    │
                    ▼
        Multi-reference comparison
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 Reference consensus     Self-consistency
          │                   │
          └─────────┬─────────┘
                    ▼
          Structural measurements
                    │
                    ▼
          Calibrated assessment
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 Visual evidence          Findings
          │                   │
          └─────────┬─────────┘
                    ▼
          AI-assisted narrative
                    │
                    ▼
             PDF case report
```

---

## The Problem

Signatures are used to authorize contracts, financial transactions, insurance documents, legal paperwork, business records, and other decisions where document authenticity matters.

When a signature is questioned, the reviewer needs more than a quick visual impression. The process can involve comparing a questioned signature with trusted specimens, accounting for natural variation, identifying meaningful differences, and communicating the findings in a form another person can review.

DocLens addresses this workflow by bringing **document ingestion, signature localization, visual comparison, structural analysis, evidence visualization, and reporting** into one application.

The goal is not to claim that software can replace a qualified forensic examiner. The goal is to make AI-assisted analysis **faster to perform, easier to inspect, and easier to communicate**.

---

## What DocLens Does

A case can move through the following workflow:

1. **Create a case** with signer and document context.
2. **Upload a questioned document** and one or more trusted reference specimens.
3. **Process the document automatically**, including PDF inspection when applicable.
4. **Locate the likely signature region** without requiring manual cropping.
5. **Extract a 512-dimensional visual representation** using a pretrained ResNet18 feature extractor.
6. **Compare the questioned signature against every trusted reference** using normalized cosine similarity.
7. **Calculate reference-set evidence**, including best, median, profile, and consensus signals.
8. **Measure structural differences** in stroke width, proportions, baseline, pen lifts, and slant.
9. **Evaluate internal self-consistency** of the questioned signature.
10. **Produce a calibrated assessment** using the repository's frozen CEDAR calibration.
11. **Localize visual evidence** with Grad-CAM-based difference visualization and evidence markers.
12. **Generate an AI-assisted written explanation** grounded in the structured findings.
13. **Persist the case and results** through the application's authenticated case workflow.
14. **Export a professional PDF report**.

### Supported inputs

- JPEG / JPG
- PNG
- WebP
- BMP
- PDF

Current limits include a **10 MB maximum upload size per file** and a **40-page maximum for PDF processing**.

---

## How the Analysis Works

### 1. Document preprocessing

Uploaded images are normalized to RGB, EXIF orientation is respected, oversized images are constrained, and meaningful page skew can be corrected before analysis.

The backend protects inference resources with limits including:

- 10 MB maximum uploaded file size
- 20 million maximum decoded image pixels
- 1600 px maximum normalized image dimension

### 2. Automatic signature localization

The detector is implemented with OpenCV image processing. Candidate regions are evaluated using signals such as:

- aspect ratio
- region area
- ink density
- horizontal span
- vertical position
- compactness
- connected-component structure
- text-like penalties

The selected region is retained in document coordinates so that evidence can be shown in context, while a normalized crop is prepared for model inference.

### 3. Deep visual representation

DocLens uses **Torchvision ResNet18 pretrained on ImageNet** as a visual feature extractor.

The final classification layer is removed and the remaining representation is converted into a normalized **512-dimensional embedding**.

Inference includes RGB conversion, 224 × 224 resizing, ImageNet normalization, PyTorch `inference_mode()`, feature extraction, and L2 normalization.

The model is used as a visual representation model; the project does not claim that this ResNet18 was trained end-to-end on DocLens forensic labels.

### 4. Multi-reference comparison

The questioned signature is compared against every supplied trusted reference using cosine similarity between normalized embeddings.

The analysis retains several reference-level signals:

- best-reference similarity
- median reference similarity
- reference-profile similarity using the reference embedding centroid
- reference consensus based on score level and spread

The result is therefore informed by the behavior of the **reference set**, not just one selected comparison.

### 5. Structural feature analysis

The classical computer-vision layer compares the questioned signature with the strongest reference match across five implemented feature categories:

| Feature                             | What is measured                                       |
| ----------------------------------- | ------------------------------------------------------ |
| **Stroke Width Variation**          | Differences in estimated stroke thickness distribution |
| **Letter Proportion Inconsistency** | Differences in connected-component proportions         |
| **Baseline Deviation**              | Differences in the estimated writing baseline          |
| **Pen Lift Positions**              | Differences in likely stroke-gap locations             |
| **Slant Deviation**                 | Differences in principal-axis orientation              |

The implementation uses image masks, connected components, distance transforms, projection profiles, baseline estimation, and principal-axis analysis.

### 6. Self-consistency analysis

DocLens also calculates a self-consistency signal from the questioned signature itself using spatial embedding consistency and ink-profile regularity.

This is an additional pattern-quality signal. It is not treated as proof of authorship or intent.

### 7. Calibrated assessment

The frozen production calibration combines the deep visual signal and classical feature signal using:

- **95% embedding weight**
- **5% classical feature weight**
- **0.9271469 calibrated decision threshold**

The threshold and weights originate from the repository's writer-disjoint CEDAR calibration protocol.

### 8. Visual evidence

DocLens uses **Grad-CAM-based explainability** to localize areas associated with visual differences between the questioned signature and its strongest reference representation.

The evidence layer can expose:

- detected signature boundaries
- document context
- visual hotspots
- hotspot intensity
- numbered evidence markers
- baseline location
- pen-lift positions
- ranked structural differences

This evidence is mapped back into contextual imagery so the reviewer can inspect where the relevant visual signal appears.

### 9. Report generation

The deterministic analysis produces structured findings. When configured, Groq's `llama-3.3-70b-versatile` converts those findings into a plain-English narrative.

The report layer is instructed to preserve the calculated assessment, explain supplied evidence, avoid inventing findings, avoid claiming legal certainty or authorship, and recommend qualified review when appropriate.

If Groq is unavailable or produces an unusable response, DocLens falls back to a deterministic report template.

---

## Validation and Results

DocLens includes an explicit evaluation artifact and reproducible evaluation tooling rather than relying on an unsupported accuracy statement.

### CEDAR writer-disjoint evaluation

The frozen production calibration records a **CEDAR** experiment using:

- **55 writers total**
- **44 calibration writers**
- **11 held-out test writers**
- **1,320 genuine samples**
- **1,320 forged samples**
- **8 enrollment samples per writer**
- **1,760 calibration comparisons**
- **440 unseen test comparisons**
- **seed 42**
- pre-cropped signatures
- document-level signature localization bypassed for the benchmark

The benchmark therefore measures the **signature-comparison pipeline under a writer-disjoint protocol**, not the full document-ingestion pipeline.

### Recorded metrics

| Metric            | Calibration | Unseen test |
| ----------------- | ----------: | ----------: |
| Balanced accuracy |  **93.11%** |  **96.50%** |
| FAR               |       5.40% |   **3.03%** |
| FRR               |       8.38% |   **3.98%** |
| ROC AUC           |           — |  **99.59%** |
| EER               |           — |   **3.41%** |
| Comparisons       |       1,760 |     **440** |

The frozen calibration artifact records the result as a **baseline calibration from an actual CEDAR run** and explicitly recommends validation across additional writer-disjoint seeds before making broad accuracy claims.

### Multi-seed validation

The repository contains `backend/scripts/validate_cedar_multiseed.py` to evaluate stability across writer-disjoint splits using seeds **42, 43, 44, 45, and 46**.

For each seed, the script:

1. creates a writer-disjoint calibration/test split;
2. builds genuine and forged comparison pairs;
3. selects embedding/feature weighting using calibration writers only;
4. selects the decision threshold using calibration data;
5. evaluates the frozen choice on unseen writers;
6. calculates balanced accuracy, FAR, FRR, ROC AUC, and EER;
7. reports mean and standard deviation across seeds.

The validation script does **not** overwrite `backend/app/cv/calibration.json`. The production calibration remains frozen until cross-seed stability is reviewed.

> **Important:** the repository currently records the frozen seed-42 CEDAR results above. The presence of the multi-seed validator should not be interpreted as completed multi-seed benchmark results.

---

## Technical Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       React + Vite                          │
│                                                             │
│ Auth · Dashboard · Cases · Upload · Analysis                │
│ Evidence · Findings · Summary · PDF Export                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON / multipart form-data
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         FastAPI                             │
│                                                             │
│ Authentication · Case Management · Upload · Analysis        │
│ PDF Processing · OpenCV · PyTorch · Grad-CAM                │
│ Groq Narrative Generation · Report Services                 │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
      ┌──────────────────┐          ┌────────────────────────┐
      │  Supabase Auth   │          │  Supabase PostgreSQL   │
      │  JWT sessions    │          │  cases + results       │
      └──────────────────┘          └────────────┬───────────┘
                                                 ▼
                                      ┌────────────────────────┐
                                      │   Supabase Storage     │
                                      │   case documents       │
                                      └────────────────────────┘
```

### Main backend layers

- `api/v1/` — HTTP endpoints and request handling
- `cv/` — preprocessing, signature detection, embeddings, scoring, explainability
- `pdf/` — PDF inspection and candidate selection
- `services/` — authentication, cases, analysis, and reporting
- `db/` — Supabase data access
- `models/` — Pydantic request/response models
- `core/` — security and storage helpers
- `scripts/` — evaluation and validation tooling

---

## PDF Processing

DocLens accepts complete PDF documents and processes them through a dedicated candidate-selection stage.

For each PDF, the backend:

1. verifies that the document can be opened;
2. rejects encrypted/password-protected PDFs;
3. enforces the 40-page limit;
4. renders pages at a preferred 200 DPI within a pixel safety limit;
5. inspects page text;
6. extracts embedded images when available;
7. scores candidate page/image representations using visual quality and ink-density signals;
8. selects the strongest analyzable representation for the downstream image-based signature pipeline.

The current implementation is therefore a **PDF candidate-selection pipeline**, not a claim that every page is simultaneously analyzed as an independent forensic case.

---

## AI-Assisted Reporting

Generative AI is used as a reporting layer on top of the deterministic analysis pipeline.

### Model

**Groq — `llama-3.3-70b-versatile`**

The model receives structured findings rather than raw authority over the verdict. Its instructions require it to:

- preserve the calculated assessment;
- explain supplied feature differences;
- avoid inventing evidence;
- avoid presenting similarity as a calibrated probability;
- avoid claiming legal certainty or authorship;
- recommend qualified manual review when appropriate.

If the Groq API is unavailable, not configured, returns an unusable response, or the package cannot be used, DocLens generates a deterministic fallback narrative.

This keeps the core comparison and measurement pipeline independent of LLM availability.

---

## Case Management and Security

DocLens is a multi-case application with authenticated user workflows.

Protected operations include case creation, retrieval, updates, deletion, uploads, and analysis.

The backend verifies bearer-token authentication and scopes case operations to the authenticated user's ID. Uploaded files use user/case-specific storage paths.

Authentication flows include:

- registration
- login
- email verification
- password recovery
- password reset
- authenticated user retrieval

Secrets such as Supabase service credentials and the Groq API key are expected to be supplied through environment variables and are not part of the source code.

---

## Frontend

The frontend is built with React 18 and Vite 6.

The application includes routes and views for:

- authentication
- dashboard
- cases
- case creation
- document/reference upload
- analysis
- report summary
- evidence
- findings
- report export

The frontend uses the Supabase JavaScript client for authentication integration, HTML5 Canvas for visual evidence presentation, and jsPDF for client-side PDF report generation.

---

## Backend API

The backend is a versioned FastAPI service under `/api/v1`.

| Method   | Endpoint                         | Purpose                     |
| -------- | -------------------------------- | --------------------------- |
| `GET`    | `/api/v1/health`                 | Service health check        |
| `POST`   | `/api/v1/auth/register`          | Register an account         |
| `POST`   | `/api/v1/auth/login`             | Authenticate a user         |
| `POST`   | `/api/v1/auth/forgot-password`   | Start password recovery     |
| `POST`   | `/api/v1/auth/reset-password`    | Complete password reset     |
| `GET`    | `/api/v1/auth/me`                | Retrieve authenticated user |
| `GET`    | `/api/v1/cases`                  | List owned cases            |
| `POST`   | `/api/v1/cases`                  | Create a case               |
| `GET`    | `/api/v1/cases/{case_id}`        | Retrieve a case             |
| `PATCH`  | `/api/v1/cases/{case_id}`        | Update a case               |
| `DELETE` | `/api/v1/cases/{case_id}`        | Delete a case               |
| `POST`   | `/api/v1/cases/{case_id}/upload` | Upload case material        |
| `POST`   | `/api/v1/analyze`                | Run signature analysis      |

The analysis endpoint accepts a case ID, a questioned file, and one or more reference files as multipart form data.

---

## Technology Stack

### Frontend

React 18 · Vite 6 · JavaScript/JSX · Supabase JavaScript client · HTML5 Canvas · jsPDF · Lucide React · QRCode

### Backend

Python · FastAPI · Uvicorn · Pydantic · Supabase Python SDK · PyJWT

### AI and Computer Vision

PyTorch · Torchvision · ResNet18 · OpenCV · Pillow · NumPy · Grad-CAM · PyMuPDF

### Generative AI

Groq API · `llama-3.3-70b-versatile`

### Cloud and Infrastructure

Supabase Auth · Supabase PostgreSQL · Supabase Storage · Render-compatible deployment

---

## Repository Structure

```text
DocLens/
├── src/
│   ├── components/             # Shared UI and evidence/report components
│   ├── context/                # Frontend application state
│   ├── hooks/                  # Client-side hooks/routing helpers
│   ├── lib/                    # API, auth, and report utilities
│   ├── pages/
│   │   ├── auth/               # Authentication flows
│   │   ├── cases/              # Case creation, uploads, analysis
│   │   ├── dashboard/          # Dashboard
│   │   └── reports/            # Summary, evidence, findings, export
│   ├── App.jsx
│   └── routes.jsx
│
├── backend/
│   ├── app/
│   │   ├── api/v1/             # FastAPI endpoints
│   │   ├── core/               # Security/storage helpers
│   │   ├── cv/                 # Detection, embeddings, scoring, explainability
│   │   ├── db/                 # Supabase data access
│   │   ├── models/              # Pydantic schemas
│   │   ├── pdf/                # PDF inspection/candidate selection
│   │   ├── services/            # Auth, cases, analysis, reports
│   │   ├── config.py
│   │   └── main.py
│   ├── scripts/                # CEDAR evaluation/validation
│   └── requirements.txt
│
├── package.json
├── README.md
└── .gitignore
```

The CEDAR dataset itself is intentionally kept **outside the repository**; the evaluation scripts expect the dataset to be supplied locally.

---

## Quick Start

### Prerequisites

- Node.js and npm
- Python 3.10+
- Git
- A Supabase project for authentication, database, and storage
- A Groq API key for AI-assisted narrative generation (optional; deterministic reporting works without it)

### 1. Clone the repository

```bash
git clone https://github.com/yvesseraphin/DocLens.git
cd DocLens
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure frontend environment variables

Create `.env` in the project root using the variables listed in [Environment Variables](#environment-variables).

### 4. Install backend dependencies

Create and activate a Python virtual environment, then install:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install the backend packages:

```bash
pip install -r backend/requirements.txt
```

### 5. Configure backend environment variables

Create the backend environment configuration described below.

### 6. Start the backend

From the `backend` directory:

```bash
cd backend
uvicorn app.main:app --reload
```

### 7. Start the frontend

From the repository root in another terminal:

```bash
npm run dev
```

The Vite development server serves the frontend, while `VITE_API_URL` points it to the FastAPI service.

### Production frontend build

```bash
npm run build
npm run preview
```

---

## Environment Variables

### Frontend

```text
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Backend

```text
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
STORAGE_BUCKET=documents
ALLOWED_ORIGINS_RAW=http://localhost:5173
GROQ_API_KEY=
```

Values should be supplied through the deployment environment or local `.env` files that are excluded from version control.

**Never commit API keys, service-role credentials, JWT secrets, or other private credentials.**

---

## Evaluation Reproduction

The CEDAR dataset is not stored in this repository.

The evaluation scripts expect the native CEDAR layout:

```text
CEDAR/
├── 1/
│   ├── original_1_1.png
│   ├── original_1_2.png
│   └── forgeries_1_1.png
├── 2/
│   └── ...
└── ...
```

Signatures are already cropped in CEDAR, so document-level signature localization is intentionally bypassed for this benchmark.

### Single writer-disjoint evaluation

From the `backend` directory:

```bash
python scripts/evaluate_cedar.py /path/to/CEDAR --seed 42 --output cedar_evaluation.json
```

Useful options include:

```text
--enrollment 8
--test-fraction 0.20
--seed 42
--output cedar_evaluation.json
```

The evaluator creates a writer-disjoint calibration/test split, builds comparison pairs, calibrates the embedding/feature weighting and threshold using calibration writers, and evaluates the resulting operating point on unseen writers.

### Multi-seed validation

To evaluate stability across the repository's configured seeds:

```bash
python scripts/validate_cedar_multiseed.py /path/to/CEDAR
```

The multi-seed validator reports per-seed and aggregate statistics while intentionally leaving `app/cv/calibration.json` unchanged.

---

## Reliability and Deployment

Deep-learning inference had to operate under constrained cloud resources during deployment.

The backend was optimized with:

- single-threaded PyTorch configuration;
- `torch.inference_mode()` for inference;
- explicit model/tensor cleanup;
- garbage collection after analysis;
- bounded image dimensions;
- bounded PDF page/render processing;
- deterministic report fallback when Groq is unavailable.

These controls reduce unnecessary memory and CPU pressure and make the application more suitable for constrained hosting environments.

---

## Limitations and Responsible Use

DocLens is an **AI-assisted forensic analysis and decision-support system**. It does not independently establish authorship, intent, legal validity, or definitive forgery.

Important technical limitations include:

- ResNet18 is a pretrained ImageNet feature extractor rather than a signature-specific end-to-end authorship model.
- The frozen CEDAR benchmark uses pre-cropped signatures and bypasses document-level detection.
- The recorded CEDAR metrics should not be interpreted as universal real-world accuracy.
- The multi-seed validation tooling exists, but completed multi-seed results are not represented as production calibration results unless explicitly recorded in the repository.
- Trusted reference specimens are assumed to be genuine and representative of the signer.
- Scan quality, compression, resolution, document layout, and reference quality can affect performance.
- PDF processing currently ranks candidate representations and selects one for the downstream image-based signature pipeline.
- Encrypted/password-protected PDFs are not supported.
- Individual uploads are limited to 10 MB.
- PDF processing is limited to 40 pages.

For consequential decisions, DocLens is intended to **support rather than replace** qualified forensic document examination.

---

## Future Direction

The same evidence-oriented architecture can be extended through:

- signature-specific representation learning;
- broader multi-dataset validation;
- multi-seed calibration review and uncertainty analysis;
- multi-page and multi-signature analysis;
- stronger document-level localization;
- broader document-integrity analysis;
- examiner-oriented audit trails;
- stronger borderline-case abstention;
- reproducible benchmark tooling and confidence intervals.

The long-term direction is to make AI-assisted document analysis **more transparent, inspectable, and useful to the people responsible for reviewing important documents**.

---

## Project

### **DocLens — Don't just get a verdict. See the evidence.**

DocLens combines computer vision, deep visual representation, calibrated comparison, multi-reference analysis, structural measurements, visual explainability, AI-assisted reporting, authenticated case management, and PDF reporting in one application.

**Live application:** https://doclens.yvesseraphin.xyz  
**Source code:** https://github.com/yvesseraphin/DocLens

---

## License

See the repository for the current licensing terms.
