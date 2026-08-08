from __future__ import annotations

import io

import fitz
from PIL import Image

from app.pdf.processor import inspect_pdf
from app.pdf.signature_candidates import rank_candidates


def _make_pdf(page_count: int = 3, with_embedded_image: bool = False) -> bytes:
    document = fitz.open()
    for index in range(page_count):
        page = document.new_page(width=595, height=842)
        page.insert_text((72, 100), f"Page {index + 1}")
        if index == page_count - 1:
            page.insert_text((72, 700), "Signature:")
            page.draw_line((72, 735), (360, 735), color=(0, 0, 0), width=1)
            if with_embedded_image:
                image = Image.new("RGB", (500, 180), "white")
                # Deliberately simple synthetic ink-like strokes for ingestion testing.
                from PIL import ImageDraw
                draw = ImageDraw.Draw(image)
                draw.line((30, 110, 120, 70, 180, 115, 250, 55, 340, 105, 460, 60), fill="black", width=5)
                buf = io.BytesIO()
                image.save(buf, format="PNG")
                page.insert_image(fitz.Rect(72, 500, 360, 620), stream=buf.getvalue())
    result = document.tobytes()
    document.close()
    return result


def test_inspect_pdf_handles_multiple_pages_and_embedded_images() -> None:
    data = _make_pdf(with_embedded_image=True)
    document = inspect_pdf(data)
    assert document.page_count == 3
    assert len(document.pages) == 3
    assert len(document.embedded_images) >= 1
    assert all(page.image.width > 0 and page.image.height > 0 for page in document.pages)


def test_candidate_ranking_returns_candidates_for_each_page() -> None:
    data = _make_pdf()
    document = inspect_pdf(data)
    candidates = rank_candidates(document)
    assert candidates
    assert {candidate.page for candidate in candidates} == {1, 2, 3}
    assert all(0.0 <= candidate.score <= 1.0 for candidate in candidates)
