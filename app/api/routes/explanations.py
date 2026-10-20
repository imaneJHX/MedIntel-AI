"""Return one additive explanation, never an expensive global recomputation."""

from fastapi import APIRouter, Depends
from app.schemas.explanation import ExplanationResponse
from app.schemas.patient import HeartRecord
from app.services.explainability_service import ExplainabilityService, get_explanation_service

router = APIRouter(prefix="/explain", tags=["Explanation"])


@router.post("/heart-disease", response_model=ExplanationResponse, summary="Explain one frozen-model output in log-odds")
def explain(record: HeartRecord, service: ExplainabilityService = Depends(get_explanation_service)) -> ExplanationResponse:
    return service.explain(record)
