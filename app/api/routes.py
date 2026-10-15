"""FastAPI routes for the Risk Fusion Engine.

Implements /health, /config, /api/v1/risk/evaluate, /api/v1/risk/evaluate-batch,
and /api/v1/risk/evaluate-mock.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.mocks.scenarios import (
    MOCK_SCENARIOS,
    get_mock_scenario,
    list_mock_scenarios,
)
from app.schemas.risk import (
    BatchRiskEvaluationRequest,
    BatchRiskEvaluationResponse,
    EngineConfigResponse,
    HealthResponse,
    MockEvaluationRequest,
    RiskEvaluationRequest,
    RiskEvaluationResponse,
    RiskWeights,
    ThresholdsConfig,
)
from app.services.fusion_engine import RiskFusionEngine

router = APIRouter()


def get_engine(settings: Settings = Depends(get_settings)) -> RiskFusionEngine:
    """Dependency injection provider for the Risk Fusion Engine."""
    return RiskFusionEngine(settings=settings)


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Check",
    description="Returns operational status and engine version.",
    tags=["System"],
)
def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
    )


@router.get(
    "/config",
    response_model=EngineConfigResponse,
    summary="Active Configuration and Policies",
    description="Returns active fusion weights, classification thresholds, and operational policies.",
    tags=["System"],
)
def get_engine_config(settings: Settings = Depends(get_settings)) -> EngineConfigResponse:
    return EngineConfigResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        weights=RiskWeights(
            conversation=settings.weight_conversation,
            voice_authenticity=settings.weight_voice_spoof,
            caller_reputation=settings.weight_caller_reputation,
        ),
        thresholds=ThresholdsConfig(
            safe_max=settings.threshold_safe_max,
            suspicious_min=settings.threshold_suspicious_min,
            suspicious_max=settings.threshold_suspicious_max,
            high_risk_min=settings.threshold_high_risk_min,
        ),
        missing_signal_policy=settings.missing_signal_policy,
        policy_description=(
            "By default, incomplete fusion requests are strictly rejected with HTTP 422. "
            "All three independent normalized scores (conversation_scam_score, voice_spoof_score, "
            "and caller_reputation_score) are required to calculate a valid fused score."
        ),
    )


@router.post(
    "/api/v1/risk/evaluate",
    response_model=RiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Single Call Risk",
    description="Accepts three normalized scores [0.0 - 1.0] and returns the transparent fused risk score and classification.",
    tags=["Risk Evaluation"],
)
def evaluate_call(
    request: RiskEvaluationRequest,
    engine: RiskFusionEngine = Depends(get_engine),
) -> RiskEvaluationResponse:
    return engine.evaluate(request)


@router.post(
    "/api/v1/risk/evaluate-batch",
    response_model=BatchRiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Multiple Calls in Batch",
    description="Evaluates a batch of independent calls with batch-size validation.",
    tags=["Risk Evaluation"],
)
def evaluate_batch(
    request: BatchRiskEvaluationRequest,
    engine: RiskFusionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> BatchRiskEvaluationResponse:
    if len(request.calls) > settings.max_batch_size:
        raise HTTPException(
            status_code=422,
            detail=f"Batch size {len(request.calls)} exceeds maximum permitted size of {settings.max_batch_size}.",
        )

    results = engine.evaluate_batch(request.calls)
    return BatchRiskEvaluationResponse(
        total=len(results),
        results=results,
    )


@router.get(
    "/api/v1/risk/mock-scenarios",
    summary="List Predefined Mock Scenarios",
    description="Returns catalogue of predefined deterministic mock scenarios available for development testing.",
    tags=["Development & Mocks"],
)
def get_mock_catalog() -> Dict[str, Any]:
    return list_mock_scenarios()


@router.post(
    "/api/v1/risk/evaluate-mock",
    response_model=RiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate Mock Scenario or Custom Mock Scores",
    description=(
        "Development-only endpoint that accepts either a named mock scenario "
        "('safe_call', 'suspicious_call', 'high_risk_scam', 'synthetic_voice_scam') "
        "or arbitrary mock scores for isolated testing."
    ),
    tags=["Development & Mocks"],
)
def evaluate_mock(
    request: MockEvaluationRequest,
    engine: RiskFusionEngine = Depends(get_engine),
) -> RiskEvaluationResponse:
    # 1. If scenario name provided, load baseline scenario
    if request.scenario:
        scenario_req = get_mock_scenario(request.scenario)

        # Apply any overrides supplied by the client
        if request.call_id is not None:
            scenario_req.call_id = request.call_id
        if request.conversation_scam_score is not None:
            scenario_req.conversation_scam_score = request.conversation_scam_score
        if request.voice_spoof_score is not None:
            scenario_req.voice_spoof_score = request.voice_spoof_score
        if request.caller_reputation_score is not None:
            scenario_req.caller_reputation_score = request.caller_reputation_score
        if request.metadata is not None:
            scenario_req.metadata = request.metadata
        if request.evidence is not None:
            scenario_req.evidence = request.evidence

        return engine.evaluate(scenario_req)

    # 2. If no scenario name, client must provide all three scores explicitly
    if (
        request.conversation_scam_score is not None
        and request.voice_spoof_score is not None
        and request.caller_reputation_score is not None
    ):
        custom_req = RiskEvaluationRequest(
            call_id=request.call_id or "custom-mock-001",
            conversation_scam_score=request.conversation_scam_score,
            voice_spoof_score=request.voice_spoof_score,
            caller_reputation_score=request.caller_reputation_score,
            source="mock_custom",
            metadata=request.metadata,
            evidence=request.evidence,
        )
        return engine.evaluate(custom_req)

    raise HTTPException(
        status_code=422,
        detail=(
            "Mock request must specify either a valid 'scenario' "
            "('safe_call', 'suspicious_call', 'high_risk_scam', 'synthetic_voice_scam') "
            "or all three explicit mock scores (conversation_scam_score, voice_spoof_score, caller_reputation_score)."
        ),
    )
