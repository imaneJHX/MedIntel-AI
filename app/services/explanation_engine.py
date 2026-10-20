"""Independent report explanations with deterministic validation and fallback."""
from app.schemas.report_explanations import ReportExplanationRequest, ReportExplanation
from app.services.explanation_providers.base import ExplanationProvider
from app.services.explanation_providers.deterministic import DeterministicExplanationProvider
from app.services.explanation_validation import validate_explanation
from app.services.laboratory_knowledge import TEXT
from app.core.exceptions import ServiceError


class ReportExplanationEngine:
    def __init__(self, provider: ExplanationProvider | None = None):
        self.deterministic = DeterministicExplanationProvider()
        self.provider = provider

    def explain(self, request: ReportExplanationRequest) -> ReportExplanation:
        """Revalidate at the service boundary; fail closed if even templates fail.

        No optional provider is configured in the application. The injected seam
        tests failure/contradiction fallback; it is not an LLM integration.
        """
        request = ReportExplanationRequest.model_validate(request.model_dump())
        try:
            expected = self.deterministic.explain(request)
            expected = validate_explanation(expected, expected)
        except Exception:
            raise ServiceError(503, 'report_explanation_unavailable', 'Report explanations are temporarily unavailable.') from None
        if self.provider is None:
            return expected
        try:
            return validate_explanation(self.provider.explain(request.model_copy(deep=True)), expected)
        except Exception:
            expected.fallback_used = True
            expected.warnings.append(TEXT[request.language]['fallback'])
            return expected
