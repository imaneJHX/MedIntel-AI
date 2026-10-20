"""Reviewed synthetic facts only; independent of OCR, prediction and SHAP."""
from fastapi import APIRouter, Request
from app.schemas.report_explanations import ReportExplanationRequest, ReportExplanation

router = APIRouter(tags=['Synthetic medical reports'])


@router.post('/reports/explain', response_model=ReportExplanation,
             summary='Explain reviewed synthetic laboratory measurements using offline educational templates')
def explain_report(body: ReportExplanationRequest, request: Request) -> ReportExplanation:
    return request.app.state.report_explanation_engine.explain(body)
