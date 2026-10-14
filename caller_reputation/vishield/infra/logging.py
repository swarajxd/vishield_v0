"""Logging that never emits raw audio or unredacted sensitive text."""

from __future__ import annotations

import logging
import sys

from vishield.domain.redaction import redact


class RedactingFilter(logging.Filter):
    """Redacts the formatted message of every record passing through."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except (TypeError, ValueError):
            return True
        redacted = redact(message).text
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if any(isinstance(f, RedactingFilter) for h in root.handlers for f in h.filters):
        return
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(RedactingFilter())
    root.handlers = [handler]
    root.setLevel(level.upper())
    logging.getLogger("uvicorn.access").addFilter(RedactingFilter())
