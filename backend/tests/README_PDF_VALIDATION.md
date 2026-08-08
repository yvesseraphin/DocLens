# DocLens PDF validation protocol

PDF analysis is an input-adaptation layer. It does not use a separate forgery model.

## Supported ingestion paths

1. Multi-page scanned PDFs: pages are rendered at controlled resolution and ranked.
2. PDFs containing embedded raster images: embedded images are inspected as additional candidate evidence while the selected page is rendered for document context.
3. DOCX-exported PDFs: the same embedded-image and rendered-page paths apply.
4. Mixed PDFs: each page is inspected; the strongest candidate page is selected.
5. PDF uploads whose browser MIME type is inaccurate but whose bytes begin with `%PDF-`: the backend recognizes the file by content signature.

## Safety behavior

- Empty, corrupt, encrypted/password-protected, or oversized-page-count PDFs are rejected.
- The system does not assume page 1 contains the signature.
- PDF extraction does not create a separate verification algorithm. The selected page enters the existing signature detector, preprocessing, embedding, visual evidence, calibration, and report pipeline.
- The user-facing evidence remains a contextual page crop rather than an extreme signature-only zoom.

## Local tests

From `backend/`:

```powershell
python -m pytest tests/test_pdf_processor.py -q
```

The tests cover multi-page inspection, embedded image extraction, page rendering, and candidate generation. Before production release, add a labeled corpus containing real scanned PDFs, DOCX-exported PDFs, multi-signature documents, rotated pages, low-resolution scans, and PDFs with no signature. Measure page localization and signature-region localization separately from forgery verification metrics.
