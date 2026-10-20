"""Bounded, strictly typed reviewed facts; review never means clinical validation."""
from typing import Annotated, Literal
from pydantic import Field, field_validator, model_validator
from pydantic_core import PydanticCustomError
from app.schemas.medical_reports import ReportModel, ReferenceInterval, Comparison
from app.services.laboratory_parser import ALIASES, UNITS, normalize_unit
from app.services.laboratory_education import CATALOG

Language = Literal['en', 'fr', 'ar']
Quantity = Annotated[float, Field(strict=True, ge=0, le=1e9, allow_inf_nan=False)]
Unit = Annotated[str, Field(strict=True, min_length=1, max_length=40)]
Identifier = Annotated[str, Field(strict=True, pattern=r'^measurement-[1-9][0-9]{0,2}$')]


def analyte_for_name(name: str) -> str | None:
    """Resolve an exact supported label, never instructions or partial matches."""
    label = name.strip().casefold()
    return next((key for key, aliases in ALIASES.items()
                 if label in [a.casefold() for a in aliases] + [CATALOG[key][0].casefold()]), None)


class ReviewedInterval(ReferenceInterval):
    lower: Quantity | None = None
    upper: Quantity | None = None
    lower_inclusive: bool = Field(default=True, strict=True)
    upper_inclusive: bool = Field(default=True, strict=True)
    unit: Unit | None = None
    raw_text: str = Field(default='User-reviewed bounds', max_length=160, strict=True)

    @model_validator(mode='after')
    def valid_interval(self):
        if self.lower is None and self.upper is None:
            raise PydanticCustomError('invalid_interval', 'Provide a bound or use null for an absent interval.')
        if self.lower is not None and self.upper is not None:
            if self.lower > self.upper or self.lower == self.upper and not (self.lower_inclusive and self.upper_inclusive):
                raise PydanticCustomError('invalid_interval', 'The printed interval must have ordered, nonempty bounds.')
        return self


class ReviewedMeasurement(ReportModel):
    id: Identifier
    name: str = Field(min_length=1, max_length=80, strict=True)
    value: Quantity | None
    unit: Unit | None
    reference_range: ReviewedInterval | None
    reviewed: Literal[True]
    user_corrected: bool = Field(default=False, strict=True)

    @field_validator('reviewed', mode='before')
    @classmethod
    def require_review(cls, value):
        if value is not True:
            raise PydanticCustomError('review_required', 'Confirm transcription before requesting an explanation.')
        return value

    @field_validator('name')
    @classmethod
    def supported_name(cls, name: str) -> str:
        if analyte_for_name(name) is None:
            raise PydanticCustomError('unsupported_analyte', 'Use a supported laboratory measurement name.')
        return name.strip()

    @model_validator(mode='after')
    def valid_units(self):
        for unit in [self.unit, self.reference_range.unit if self.reference_range else None]:
            if unit is not None and normalize_unit(unit) not in UNITS:
                raise PydanticCustomError('invalid_unit', 'Use a supported unit notation or null if unknown.')
        if self.unit and self.reference_range and self.reference_range.unit:
            if normalize_unit(self.unit) != normalize_unit(self.reference_range.unit):
                raise PydanticCustomError('incompatible_units', 'Result and printed interval units must match; no conversion is performed.')
        return self


class ReportExplanationRequest(ReportModel):
    synthetic_only: Literal[True]
    language: Language
    measurements: list[ReviewedMeasurement] = Field(min_length=1, max_length=50)

    @field_validator('synthetic_only', mode='before')
    @classmethod
    def require_synthetic(cls, value):
        if value is not True:
            raise PydanticCustomError('synthetic_required', 'Only acknowledged synthetic demonstration measurements are accepted.')
        return value

    @model_validator(mode='after')
    def unique_ids(self):
        ids = [m.id for m in self.measurements]
        if len(set(ids)) != len(ids):
            raise PydanticCustomError('duplicate_identifiers', 'Each measurement must have a unique source identifier.')
        return self


class ExplanationCounts(ReportModel):
    reviewed: int = Field(ge=1, le=50)
    below_reported_interval: int = Field(ge=0, le=50)
    within_reported_interval: int = Field(ge=0, le=50)
    above_reported_interval: int = Field(ge=0, le=50)
    not_evaluated: int = Field(ge=0, le=50)


class MeasurementExplanation(ReportModel):
    measurement_id: Identifier
    analyte: str = Field(max_length=40)
    name: str = Field(max_length=80)
    source_name: str = Field(max_length=80)
    value: Quantity | None
    unit: Unit | None
    reference_range: ReviewedInterval | None
    comparison: Comparison
    user_corrected: bool
    definition: str = Field(max_length=600)
    explanation: str = Field(max_length=2000)
    source_measurement_ids: list[Identifier] = Field(min_length=1, max_length=1)
    source_url: str = Field(max_length=160)


class DoctorQuestion(ReportModel):
    text: str = Field(max_length=500)
    source_measurement_ids: list[Identifier] = Field(min_length=1, max_length=1)


class ReportExplanation(ReportModel):
    language: Language
    generation_method: Literal['deterministic'] = 'deterministic'
    knowledge_version: Literal['lab-education-1'] = 'lab-education-1'
    fallback_used: bool = False
    counts: ExplanationCounts
    summary: str = Field(max_length=1500)
    measurement_explanations: list[MeasurementExplanation] = Field(min_length=1, max_length=50)
    questions_for_doctor: list[DoctorQuestion] = Field(min_length=1, max_length=50)
    warnings: list[Annotated[str, Field(max_length=600)]] = Field(max_length=5)
    disclaimer: str = Field(max_length=1000)
