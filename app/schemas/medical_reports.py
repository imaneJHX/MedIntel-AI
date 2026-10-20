"""Finite, bounded transcriptions and document-relative comparisons."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Comparison = Literal['below_reported_interval', 'within_reported_interval', 'above_reported_interval', 'not_evaluated']

class ReportModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)

class ReferenceInterval(ReportModel):
    lower: float | None = None
    upper: float | None = None
    lower_inclusive: bool = True
    upper_inclusive: bool = True
    unit: str | None = None
    raw_text: str = Field(max_length=160)

class LaboratoryMeasurement(ReportModel):
    id: str
    analyte: str
    name: str
    original_label: str = Field(max_length=80)
    value: float | None
    unit: str | None = Field(max_length=40)
    reference_range: ReferenceInterval | None
    source_text: str = Field(max_length=240)
    extraction_confidence: None = None
    extraction_status: Literal['parsed', 'ambiguous']
    status: Comparison = 'not_evaluated'
    review_required: Literal[True] = True
    warnings: list[str] = Field(max_length=10)

class LaboratoryEducation(ReportModel):
    analyte: str
    name: str
    explanation: str
    source_url: str

class ReportExtraction(ReportModel):
    document_type: Literal['synthetic_laboratory_report'] = 'synthetic_laboratory_report'
    filename: str
    page_count: int = Field(ge=1, le=5)
    extraction_method: Literal['embedded_text', 'local_ocr', 'mixed']
    measurements: list[LaboratoryMeasurement] = Field(max_length=50)
    education: list[LaboratoryEducation]
    warnings: list[str] = Field(max_length=20)
    retained: Literal[False] = False
    disclaimer: str = 'Educational extraction only. Review the transcription. Not a medical diagnosis.'
