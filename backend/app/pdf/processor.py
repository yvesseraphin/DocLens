from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Iterable

import fitz
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

MAX_PAGES = 40
MAX_RENDER_PIXELS = 18_000_000
PREFERRED_DPI = 200
MAX_EMBEDDED_IMAGES_PER_PAGE = 30


@dataclass(frozen=True)
class PDFImageCandidate:
    page: int
    image_index: int
    image: Image.Image
    source: str
    bbox: tuple[float, float, float, float] | None


@dataclass(frozen=True)
class PDFPage:
    page_number: int
    image: Image.Image
    has_text: bool
    embedded_image_count: int


@dataclass(frozen=True)
class PDFDocument:
    page_count: int
    pages: tuple[PDFPage, ...]
    embedded_images: tuple[PDFImageCandidate, ...]
    encrypted: bool


def _safe_image_from_bytes(data: bytes) -> Image.Image | None:
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            return image.convert("RGB")
    except Exception:
        return None


def _render_page(page: fitz.Page, dpi: int = PREFERRED_DPI) -> Image.Image:
    scale = dpi / 72.0
    rect = page.rect
    pixels = max(rect.width * scale * rect.height * scale, 1.0)
    if pixels > MAX_RENDER_PIXELS:
        scale *= (MAX_RENDER_PIXELS / pixels) ** 0.5
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def _image_bbox(page: fitz.Page, xref: int) -> tuple[float, float, float, float] | None:
    try:
        rects = page.get_image_rects(xref)
        if rects:
            rect = rects[0]
            return float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)
    except Exception:
        pass
    return None


def inspect_pdf(data: bytes) -> PDFDocument:
    if not data:
        raise ValueError("PDF is empty")

    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("Invalid or unreadable PDF") from exc

    try:
        if document.is_encrypted:
            raise ValueError("Encrypted/password-protected PDFs are not supported")
        if document.page_count < 1:
            raise ValueError("PDF has no pages")
        if document.page_count > MAX_PAGES:
            raise ValueError(f"PDF exceeds the {MAX_PAGES}-page analysis limit")

        pages: list[PDFPage] = []
        embedded: list[PDFImageCandidate] = []

        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            images = page.get_images(full=True)
            text = page.get_text("text")
            pages.append(
                PDFPage(
                    page_number=page_index + 1,
                    image=_render_page(page),
                    has_text=bool(text.strip()),
                    embedded_image_count=min(len(images), MAX_EMBEDDED_IMAGES_PER_PAGE),
                )
            )

            for image_index, info in enumerate(images[:MAX_EMBEDDED_IMAGES_PER_PAGE], start=1):
                xref = int(info[0])
                try:
                    extracted = document.extract_image(xref)
                    image = _safe_image_from_bytes(extracted.get("image", b""))
                    if image is None or image.width < 32 or image.height < 16:
                        continue
                    embedded.append(
                        PDFImageCandidate(
                            page=page_index + 1,
                            image_index=image_index,
                            image=image,
                            source="embedded",
                            bbox=_image_bbox(page, xref),
                        )
                    )
                except Exception as exc:
                    logger.debug("Could not extract PDF image xref=%s: %s", xref, exc)

        return PDFDocument(
            page_count=document.page_count,
            pages=tuple(pages),
            embedded_images=tuple(embedded),
            encrypted=False,
        )
    finally:
        document.close()


def render_pages(data: bytes, dpi: int = PREFERRED_DPI) -> tuple[Image.Image, ...]:
    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("Invalid or unreadable PDF") from exc
    try:
        if document.is_encrypted:
            raise ValueError("Encrypted/password-protected PDFs are not supported")
        if document.page_count > MAX_PAGES:
            raise ValueError(f"PDF exceeds the {MAX_PAGES}-page analysis limit")
        return tuple(_render_page(document.load_page(i), dpi=dpi) for i in range(document.page_count))
    finally:
        document.close()


def document_profile(document: PDFDocument) -> dict:
    return {
        "page_count": document.page_count,
        "embedded_image_count": len(document.embedded_images),
        "pages_with_text": sum(p.has_text for p in document.pages),
        "pages_with_embedded_images": sum(p.embedded_image_count > 0 for p in document.pages),
        "processing": "embedded-image-first-with-rendered-page-fallback",
    }
