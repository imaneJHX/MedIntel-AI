"""Separate liveness from initialized inference readiness."""

from fastapi import APIRouter, Depends
from app.schemas.model import HealthResponse, ReadyResponse
from app.services.model_service import ModelService, get_model_service
from app.services.explainability_service import ExplainabilityService, get_explanation_service

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Process liveness")
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", response_model=ReadyResponse, summary="Model and SHAP readiness")
def ready(model: ModelService = Depends(get_model_service), explanation: ExplainabilityService = Depends(get_explanation_service)) -> ReadyResponse:
    return ReadyResponse()
