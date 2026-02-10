"""Braille translation API — UEB digital display mockup."""

from fastapi import APIRouter, Query

from app.services.braille_ueb import (
    DEFAULT_CELLS_PER_LINE,
    format_display_output,
    paragraphs_to_braille_display,
)

router = APIRouter(prefix="/braille", tags=["Braille"])


@router.get("/display")
def braille_display(
    text: str = Query(..., description="Text to convert to braille"),
    cells_per_line: int = Query(
        DEFAULT_CELLS_PER_LINE,
        ge=20,
        le=60,
        description="Max braille cells per line",
    ),
):
    """
    Convert text to UEB braille and return digital display format.
    Response is plain text: [ORIGINAL TEXT] and [DIGITAL BRAILLE DISPLAY].
    """
    body = format_display_output(text, cells_per_line=cells_per_line)
    return {"original": text, "display": body, "braille_only": paragraphs_to_braille_display(text, cells_per_line)}


@router.get("/braille-only")
def braille_only(
    text: str = Query(..., description="Text to convert"),
    cells_per_line: int = Query(DEFAULT_CELLS_PER_LINE, ge=20, le=60),
):
    """Return only the braille lines (no original text), for display embedding."""
    braille = paragraphs_to_braille_display(text, cells_per_line=cells_per_line)
    return {"braille": braille, "lines": [s for s in braille.split("\n") if s.strip()]}
