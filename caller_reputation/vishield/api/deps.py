"""Dependency wiring for the API."""

from __future__ import annotations

from fastapi import Request

from vishield.services.analyzer import AnalysisService
from vishield.services.ingestion import IngestionService


def get_service(request: Request) -> AnalysisService:
    service: AnalysisService = request.app.state.service
    return service


def get_ingestion_service(request: Request) -> IngestionService:
    service: IngestionService = request.app.state.ingestion_service
    return service

