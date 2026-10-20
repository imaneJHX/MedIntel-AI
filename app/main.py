"""FastAPI factory: initialize trusted local inference resources during lifespan only."""

from collections.abc import Callable
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from starlette.concurrency import run_in_threadpool

from app.api.routes import explanations, health, models, predictions
from app.core.config import Settings
from app.core.exceptions import ErrorResponse, register_handlers
from app.core.security import ControlledCORSMiddleware, PrivacyMiddleware
from app.services.model_service import ModelService
from app.services.explainability_service import ExplainabilityService
from app.api.routes import medical_reports
from app.services.report_processing import ReportProcessingService
from app.services.document_validation import DocumentLimits
from app.api.routes import report_explanations
from app.services.explanation_engine import ReportExplanationEngine

LOGGER = logging.getLogger("medintel.api")


def create_app(settings: Settings | None = None, *, model_loader: Callable[[Settings], ModelService] | None = None,
               explanation_builder: Callable[[ModelService], ExplainabilityService] | None = None) -> FastAPI:
    """Factory and dependencies make unavailable-resource and lifecycle testing explicit."""
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.report_explanation_engine = ReportExplanationEngine()
        application.state.report_service = ReportProcessingService(DocumentLimits(max_bytes=settings.report_max_bytes,
            max_pages=settings.report_max_pages, ocr_timeout=settings.report_ocr_timeout_seconds,
            tesseract_command=settings.tesseract_command), timeout=settings.report_timeout_seconds)
        application.state.model_service = None
        application.state.explanation_service = None
        try:
            service = await run_in_threadpool(model_loader or ModelService.load, settings)
            application.state.model_service = service
        except Exception as error:
            LOGGER.error("Prediction resources unavailable (%s); details suppressed.", type(error).__name__)
        if application.state.model_service is not None:
            try:
                application.state.explanation_service = await run_in_threadpool(explanation_builder or ExplainabilityService, application.state.model_service)
            except Exception as error:
                LOGGER.error("Explanation resources unavailable (%s); details suppressed.", type(error).__name__)
        yield
        application.state.explanation_service = None
        application.state.model_service = None

    application = FastAPI(title="MedIntel AI Research API", version="1.0.0", debug=False, lifespan=lifespan,
                          description="Local educational research API. Outputs describe recorded disease classification, not medical diagnoses or clinically calibrated risk.",
                          responses={status: {"model": ErrorResponse, "description": description} for status, description in
                                     [(400, "Malformed request"), (413, "Request too large"), (415, "Unsupported body format"),
                                      (422, "Invalid feature input"), (500, "Internal error, details suppressed"), (503, "Inference resources unavailable")]})
    application.state.settings = settings
    register_handlers(application)
    application.add_middleware(PrivacyMiddleware, max_request_bytes=settings.max_request_bytes, report_max_bytes=settings.report_max_bytes)
    # Added last so CORS also covers controlled middleware-generated errors.
    application.add_middleware(ControlledCORSMiddleware, allow_origins=settings.cors_origins,
                               allow_credentials=settings.cors_allow_credentials, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    for router in [health.router, models.router, predictions.router, explanations.router, medical_reports.router, report_explanations.router]:
        application.include_router(router, prefix="/api/v1")
    return application


app = create_app()
