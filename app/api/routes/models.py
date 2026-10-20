"""Safe model metadata and the centralized future-form contract."""

from fastapi import APIRouter, Depends
from app.schemas.model import InputSchemaResponse, ModelMetadata
from app.schemas.patient import schema_fields
from app.schemas.prediction import MODEL_ID
from app.services.model_service import ModelService, get_model_service

router = APIRouter(prefix="/models/heart-disease", tags=["Model"])


@router.get("", response_model=ModelMetadata, summary="Frozen model provenance and experimental metrics")
def model_info(service: ModelService = Depends(get_model_service)) -> dict:
    return service.metadata()


@router.get("/schema", response_model=InputSchemaResponse, summary="Required field names, support limits, and category options")
def input_schema(service: ModelService = Depends(get_model_service)) -> InputSchemaResponse:
    return InputSchemaResponse(model=MODEL_ID, fields=schema_fields(),
                               numeric_range_semantics="Observed training minima/maxima define this prototype's supported inputs; they are not medical normality thresholds.",
                               missing_value_policy="All 13 keys required; explicit nulls use training-fitted imputation. An entirely null record is rejected.")
