"""Thin client: talk to the REST API if reachable, otherwise run the service in-process."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import requests

from vishield.config import Settings
from vishield.domain.models import (
    AnalysisResult,
    BatchEvaluateResponse,
    BatchItem,
    ModelInfo,
    SafetyPolicy,
)
from vishield.domain.safety import get_policy
from vishield.infra.db import Database
from vishield.infra.repository import AnalysisRepository
from vishield.services.analyzer import AnalysisService


class ClientError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ApiClient:
    base_url: str
    timeout: float = 60.0

    def _raise(self, response: requests.Response) -> None:
        try:
            err = response.json().get("error", {})
        except (ValueError, json.JSONDecodeError):
            err = {}
        raise ClientError(
            err.get("code", f"http_{response.status_code}"), err.get("message", response.text[:200])
        )

    def analyze_transcript(self, text: str) -> AnalysisResult:
        r = requests.post(
            f"{self.base_url}/analyze/transcript", json={"transcript": text}, timeout=self.timeout
        )
        if r.status_code != 200:
            self._raise(r)
        return AnalysisResult.model_validate(r.json())

    def analyze_audio(self, data: bytes, filename: str, content_type: str | None) -> AnalysisResult:
        r = requests.post(
            f"{self.base_url}/analyze/audio",
            files={"file": (filename, data, content_type or "application/octet-stream")},
            data={"consent_confirmed": "true"},
            timeout=self.timeout,
        )
        if r.status_code != 200:
            self._raise(r)
        return AnalysisResult.model_validate(r.json())

    def evaluate_batch(self, items: list[BatchItem]) -> BatchEvaluateResponse:
        payload = {"items": [i.model_dump(exclude_none=True) for i in items]}
        r = requests.post(f"{self.base_url}/evaluate/batch", json=payload, timeout=self.timeout * 4)
        if r.status_code != 200:
            self._raise(r)
        return BatchEvaluateResponse.model_validate(r.json())

    def model_info(self) -> ModelInfo:
        r = requests.get(f"{self.base_url}/models/info", timeout=5)
        if r.status_code != 200:
            self._raise(r)
        return ModelInfo.model_validate(r.json())

    def safety_policy(self) -> SafetyPolicy:
        r = requests.get(f"{self.base_url}/safety/policy", timeout=5)
        if r.status_code != 200:
            self._raise(r)
        return SafetyPolicy.model_validate(r.json())

    @property
    def mode(self) -> str:
        return f"REST API at {self.base_url}"


class LocalClient:
    def __init__(self, settings: Settings) -> None:
        repo = AnalysisRepository(Database(settings.database_url))
        self.service = AnalysisService(settings, repository=repo)

    def analyze_transcript(self, text: str) -> AnalysisResult:
        return self._wrap(lambda: self.service.analyze_transcript(text))

    def analyze_audio(self, data: bytes, filename: str, content_type: str | None) -> AnalysisResult:
        return self._wrap(lambda: self.service.analyze_audio(data, filename, content_type))

    def evaluate_batch(self, items: list[BatchItem]) -> BatchEvaluateResponse:
        return self.service.evaluate_batch(items)

    def model_info(self) -> ModelInfo:
        return self.service.model_info()

    def safety_policy(self) -> SafetyPolicy:
        return get_policy()

    @property
    def mode(self) -> str:
        return "in-process service (API not reachable)"

    @staticmethod
    def _wrap(fn: Any) -> Any:
        from vishield.audio.validation import AudioValidationError
        from vishield.services.analyzer import EmptyTranscriptError
        from vishield.stt import STTUnavailableError

        try:
            return fn()
        except AudioValidationError as exc:
            raise ClientError(f"audio_{exc.code}", exc.message) from exc
        except EmptyTranscriptError as exc:
            raise ClientError("empty_transcript", str(exc)) from exc
        except STTUnavailableError as exc:
            raise ClientError("stt_unavailable", str(exc)) from exc


def build_client(settings: Settings) -> ApiClient | LocalClient:
    try:
        r = requests.get(f"{settings.api_base_url}/health", timeout=1.5)
        if r.status_code == 200:
            return ApiClient(settings.api_base_url)
    except requests.RequestException:
        pass
    return LocalClient(settings)
