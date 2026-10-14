"""Upload validation: extension, MIME type, magic bytes, size and duration limits."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath

from vishield.config import Settings


class AudioValidationError(ValueError):
    """Raised for any rejected upload. ``code`` is stable for API clients."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class UploadMeta:
    filename: str
    content_type: str | None
    size_bytes: int
    extension: str


def _sniff_format(head: bytes) -> str | None:
    """Return 'wav', 'mp3' or 'm4a' from the first bytes, or None if unknown."""
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[:3] == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        return "mp3"
    if head[4:8] == b"ftyp":
        return "m4a"
    return None


def validate_upload(
    filename: str | None, content_type: str | None, data: bytes, settings: Settings
) -> UploadMeta:
    """Validate an in-memory upload and return normalised metadata.

    Raises ``AudioValidationError`` with codes: ``empty``, ``too_large``, ``bad_extension``,
    ``bad_mime``, ``bad_magic``.
    """
    if not data:
        raise AudioValidationError("empty", "Uploaded file is empty.")
    if len(data) > settings.max_file_bytes:
        raise AudioValidationError(
            "too_large",
            f"File exceeds the {settings.max_file_mb:g} MB limit.",
        )
    safe_name = PurePosixPath(filename or "upload").name
    ext = PurePosixPath(safe_name).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise AudioValidationError(
            "bad_extension",
            f"Unsupported extension {ext or '(none)'}; allowed: "
            f"{', '.join(settings.allowed_extensions)}.",
        )
    if content_type and content_type.split(";")[0].strip() not in (
        *settings.allowed_mime_types,
        "application/octet-stream",
    ):
        raise AudioValidationError("bad_mime", f"Unsupported content type {content_type}.")
    sniffed = _sniff_format(data[:16])
    if sniffed is None or f".{sniffed}" != ext:
        raise AudioValidationError(
            "bad_magic", "File content does not match its extension or is not a supported audio."
        )
    return UploadMeta(
        filename=safe_name, content_type=content_type, size_bytes=len(data), extension=ext
    )


def validate_duration(duration_seconds: float, settings: Settings) -> None:
    if duration_seconds > settings.max_duration_seconds:
        raise AudioValidationError(
            "too_long",
            f"Audio is {duration_seconds:.1f}s; limit is {settings.max_duration_seconds:g}s.",
        )
    if duration_seconds < settings.min_duration_seconds:
        raise AudioValidationError(
            "too_short",
            f"Audio is {duration_seconds:.2f}s; minimum is {settings.min_duration_seconds:g}s.",
        )
