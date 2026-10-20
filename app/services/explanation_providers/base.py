"""Provider boundary accepts only reviewed facts, never document text."""
from typing import Protocol
from app.schemas.report_explanations import ReportExplanationRequest, ReportExplanation


class ExplanationProvider(Protocol):
    def explain(self, request: ReportExplanationRequest) -> ReportExplanation:
        """Produce bounded educational output from structured reviewed facts."""
        ...
