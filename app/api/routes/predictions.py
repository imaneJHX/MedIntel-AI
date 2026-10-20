"""A single validated research classification; no patient records are logged or stored."""

from fastapi import APIRouter, Depends
from app.schemas.patient import HeartRecord
from app.schemas.prediction import PredictionResponse
from app.services.model_service import ModelService, get_model_service

router = APIRouter(prefix="/predict", tags=["Prediction"])


@router.post("/heart-disease", response_model=PredictionResponse, summary="Classify recorded disease presence (research only)")
def predict(record: HeartRecord, service: ModelService = Depends(get_model_service)) -> PredictionResponse:
    return PredictionResponse(prediction=service.predict(record))
