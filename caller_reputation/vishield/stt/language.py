"""Language identification and Hinglish detection logic.

Azure AI Speech and Whisper do not provide a dedicated 'hinglish' locale.
This module classifies chunk-level language into 'hi-IN', 'en-IN', or 'hinglish'
based on character script mixing and phrase-level language switches.
"""

from __future__ import annotations

import re

_DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")
_LATIN_PATTERN = re.compile(r"[a-zA-Z]")


def has_devanagari(text: str) -> bool:
    """Return True if text contains any Devanagari character (U+0900 to U+097F)."""
    return bool(_DEVANAGARI_PATTERN.search(text))


def has_latin(text: str) -> bool:
    """Return True if text contains any Latin character (A-Z, a-z)."""
    return bool(_LATIN_PATTERN.search(text))


def is_mixed_script(text: str) -> bool:
    """Return True if text contains both Devanagari and Latin letters."""
    return has_devanagari(text) and has_latin(text)


def normalize_language_tag(lang: str | None, default: str = "en-IN") -> str:
    """Normalize language code to 'hi-IN', 'en-IN', or 'hinglish'."""
    if not lang:
        return default
    normalized = lang.strip().lower()
    if normalized == "hinglish":
        return "hinglish"
    if normalized.startswith("hi"):
        return "hi-IN"
    if normalized.startswith("en"):
        return "en-IN"
    return default


def resolve_chunk_language(
    text: str,
    phrase_languages: list[str] | None = None,
    default_lang: str = "en-IN",
) -> str:
    """Determine the chunk language label: 'hi-IN', 'en-IN', or 'hinglish'.

    Rules:
      1. If the text mixes Devanagari (U+0900-U+097F) and Latin letters, label 'hinglish'.
      2. If distinct phrases within the chunk have differing detected languages (e.g.
         one is Hindi and one is English), label 'hinglish'.
      3. Otherwise, use the detected language of the phrase(s) normalized to 'hi-IN' or 'en-IN'.
      4. If no phrases are available, infer 'hi-IN' if Devanagari is present, otherwise fallback
         to `default_lang`.
    """
    if is_mixed_script(text):
        return "hinglish"

    if phrase_languages:
        normalized_langs = {
            normalize_language_tag(lang_item, default_lang)
            for lang_item in phrase_languages
            if lang_item
        }
        # If both hi-IN and en-IN (or hinglish) occur among phrases within the same chunk
        if len(normalized_langs) > 1:
            return "hinglish"
        if len(normalized_langs) == 1:
            return next(iter(normalized_langs))

    # Fallback heuristic based on script if phrase_languages was empty or none
    if has_devanagari(text) and not has_latin(text):
        return "hi-IN"

    return normalize_language_tag(default_lang)
