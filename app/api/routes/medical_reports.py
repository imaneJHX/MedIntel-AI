"""Synthetic reports stay independent of the heart disease prediction service."""
from fastapi import APIRouter, Request
from starlette.concurrency import run_in_threadpool
from app.schemas.medical_reports import ReportExtraction
from app.services.report_errors import ReportError
from app.core.exceptions import ServiceError
from app.services.report_multipart import parse_report_form

router = APIRouter(tags=['Synthetic medical reports'])

@router.post('/reports/extract', response_model=ReportExtraction,
    summary='Extract a synthetic laboratory report for manual transcription review',
    responses={408: {'description': 'Bounded processing timeout'}, 429: {'description': 'One document is already being processed'}},
    openapi_extra={'requestBody': {'required': True, 'content': {'multipart/form-data': {'schema': {
        'type': 'object', 'required': ['file', 'synthetic_only'], 'properties': {
            'file': {'type': 'string', 'format': 'binary'},
            'synthetic_only': {'type': 'boolean', 'description': 'Must be true; no real personal or patient information.'}}}}}}})
async def extract_report(request: Request) -> ReportExtraction:
    try:
        data, filename, mime = parse_report_form(await request.body(), request.headers.get('content-type', ''),
                                                request.app.state.settings.report_max_bytes)
        return await run_in_threadpool(request.app.state.report_service.process, data, filename, mime)
    except ReportError as error:
        raise ServiceError(error.status, error.code, error.message) from None
