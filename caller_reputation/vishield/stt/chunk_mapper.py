"""Mapping recognized phrases with audio offsets to contiguous TranscriptChunks."""

from __future__ import annotations

from collections import defaultdict

from vishield.domain.models import TranscriptChunk
from vishield.stt.language import resolve_chunk_language
from vishield.stt.streaming import RecognizedPhrase


class PhraseToChunkMapper:
    """Maps recognized phrases with ms offsets to contiguous fixed-duration chunks.

    - Azure reports offsets in 100-ns ticks (converted to ms).
    - chunk_id = offset_ms // chunk_ms.
    - If a phrase straddles a boundary, it is assigned to the chunk where it begins.
    - Multiple phrases in the same chunk are concatenated with spaces.
    - Silent chunks emit nothing by default, or an empty chunk if emit_empty_chunks=True.
    - Language is labeled 'hinglish' if scripts are mixed or language flips.
    """

    def __init__(
        self,
        call_id: str,
        chunk_seconds: float = 8.0,
        emit_empty_chunks: bool = False,
    ) -> None:
        self.call_id = call_id
        self.chunk_seconds = chunk_seconds
        self.chunk_ms = round(chunk_seconds * 1000.0)
        self.emit_empty_chunks = emit_empty_chunks
        self._phrases_by_chunk: dict[int, list[RecognizedPhrase]] = defaultdict(list)
        self._highest_chunk_pushed = -1

    def note_chunk_pushed(self, chunk_id: int) -> None:
        """Record that an audio chunk was pushed into the recognizer."""
        if chunk_id > self._highest_chunk_pushed:
            self._highest_chunk_pushed = chunk_id

    def add_phrase(self, phrase: RecognizedPhrase) -> int:
        """Add a recognized phrase, mapping it to its starting chunk_id. Returns the chunk_id."""
        chunk_id = max(0, phrase.offset_ms // self.chunk_ms)
        self._phrases_by_chunk[chunk_id].append(phrase)
        return chunk_id

    def build_chunk(self, chunk_id: int) -> TranscriptChunk | None:
        """Build a TranscriptChunk for chunk_id, or None if silent and emit_empty is False."""


        phrases = self._phrases_by_chunk.get(chunk_id, [])
        timestamp = round((chunk_id * self.chunk_ms) / 1000.0, 3)

        if not phrases:
            if self.emit_empty_chunks:
                return TranscriptChunk(
                    call_id=self.call_id,
                    chunk_id=chunk_id,
                    text="",
                    language="en-IN",
                    timestamp=timestamp,
                )
            return None

        # Concatenate phrases in arrival order
        joined_text = " ".join(p.text.strip() for p in phrases if p.text.strip()).strip()
        if not joined_text and not self.emit_empty_chunks:
            return None

        phrase_langs = [p.language for p in phrases if p.language]
        lang = resolve_chunk_language(joined_text, phrase_langs)

        return TranscriptChunk(
            call_id=self.call_id,
            chunk_id=chunk_id,
            text=joined_text,
            language=lang,
            timestamp=timestamp,
        )

    def build_all_chunks(self) -> list[TranscriptChunk]:
        """Build all chunks from 0 up to the highest chunk pushed or observed."""
        max_chunk = self._highest_chunk_pushed
        if self._phrases_by_chunk:
            max_chunk = max(max_chunk, max(self._phrases_by_chunk.keys()))

        results: list[TranscriptChunk] = []
        for c_id in range(max(0, max_chunk + 1)):
            chunk = self.build_chunk(c_id)
            if chunk is not None:
                results.append(chunk)
        return results
