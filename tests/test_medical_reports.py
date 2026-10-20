"""Synthetic documents only: parsing, decoding, worker limits and additive API contracts."""
from dataclasses import replace
from io import BytesIO
import json
import logging
from pathlib import Path
import subprocess
from unittest.mock import Mock
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from app.core.config import Settings
from app.main import create_app
from app.services.document_validation import DocumentLimits, validate_envelope, decode_image
from app.services.document_extraction import extract_document, ocr_image
from app.services.report_errors import ReportError
from app.services.laboratory_parser import parse_laboratory_text, number, compare_interval
from app.services.report_processing import ReportProcessingService
from app.schemas.medical_reports import ReferenceInterval
from scripts.create_synthetic_reports import HEADER, REPORTS, pdf_bytes

ROOT = Path(__file__).resolve().parents[1]
LIMITS = DocumentLimits()

@pytest.fixture(scope='module')
def report_client():
    # The report endpoint works independently of model or SHAP initialization.
    with TestClient(create_app(Settings(_env_file=None), model_loader=lambda _: None), raise_server_exceptions=False) as client:
        yield client

def sample(name='routine_blood_count'):
    return (ROOT / f'frontend/public/samples/synthetic_{name}.pdf').read_bytes()

def upload(client, data, filename='synthetic.pdf', mime='application/pdf', acknowledged='true'):
    return client.post('/api/v1/reports/extract', files={'file': (filename, data, mime)}, data={'synthetic_only': acknowledged})

def image_bytes(format='PNG', size=(1200, 1000)):
    output = BytesIO()
    Image.new('RGB', size, 'white').save(output, format=format)
    return output.getvalue()

def test_real_text_pdf_and_bounded_worker(report_client):
    response = upload(report_client, sample())
    assert response.status_code == 200
    result = response.json()
    assert result['extraction_method'] == 'embedded_text' and result['retained'] is False
    assert [(m['value'], m['status']) for m in result['measurements']] == [(11.2, 'below_reported_interval'), (6.4, 'within_reported_interval'), (450, 'above_reported_interval')]
    assert all(m['review_required'] and m['extraction_confidence'] is None for m in result['measurements'])
    assert 'text' not in result and 'raw_text' not in result
    assert report_client.get('/api/v1/ready').status_code == 503

@pytest.mark.parametrize('name,expected', [('routine_blood_count', 3), ('lipid_panel', 4), ('glucose_kidney', 3)])
def test_all_three_identifier_free_samples(name, expected):
    result = extract_document(sample(name), 'synthetic.pdf', 'application/pdf', LIMITS)
    assert len(result.measurements) == expected
    assert HEADER in (PdfReader(BytesIO(sample(name))).pages[0].extract_text())

@pytest.mark.parametrize('format,filename,mime', [('PNG', 'synthetic.png', 'image/png'), ('JPEG', 'synthetic.jpg', 'image/jpeg')])
def test_real_image_decode_with_mocked_local_ocr(monkeypatch, format, filename, mime):
    monkeypatch.setattr('app.services.document_extraction.ocr_image', lambda image, limits: '\n'.join(REPORTS['routine_blood_count']))
    result = extract_document(image_bytes(format), filename, mime, LIMITS)
    assert len(result.measurements) == 3 and result.extraction_method == 'local_ocr'

def test_scanned_pdf_renders_and_uses_mocked_ocr(monkeypatch):
    image = Image.new('RGB', (800, 1000), 'white')
    output = BytesIO(); image.save(output, format='PDF'); image.close()
    calls = []
    def local(image, limits):
        calls.append(image.size)
        return '\n'.join(REPORTS['lipid_panel'])
    monkeypatch.setattr('app.services.document_extraction.ocr_image', local)
    result = extract_document(output.getvalue(), 'synthetic.pdf', 'application/pdf', LIMITS)
    assert result.extraction_method == 'local_ocr' and len(result.measurements) == 4 and calls

def test_missing_local_ocr_and_no_disk_files(monkeypatch, tmp_path):
    monkeypatch.setattr('app.services.document_extraction.resolve_tesseract', lambda _: None)
    monkeypatch.chdir(tmp_path)
    with pytest.raises(ReportError, match='ocr_unavailable') as error:
        extract_document(image_bytes(), 'synthetic.png', 'image/png', LIMITS)
    assert error.value.status == 503 and list(tmp_path.iterdir()) == []

def test_cli_ocr_uses_only_stdin_stdout_fixed_flags_and_timeout(monkeypatch):
    monkeypatch.setattr('app.services.document_extraction.resolve_tesseract', lambda _: 'local-tesseract')
    run = Mock(return_value=subprocess.CompletedProcess([], 0, b'SYNTHETIC TEST DOCUMENT', b''))
    monkeypatch.setattr('app.services.document_extraction.subprocess.run', run)
    image = Image.new('L', (100, 100))
    assert ocr_image(image, LIMITS) == 'SYNTHETIC TEST DOCUMENT'
    args, options = run.call_args
    assert args[0] == ['local-tesseract', 'stdin', 'stdout', '-l', 'eng', '--psm', '6']
    assert options['timeout'] == 8 and options['input'].startswith(b'\x89PNG')
    run.side_effect = subprocess.TimeoutExpired('fixed', 8)
    with pytest.raises(ReportError, match='ocr_timeout'):
        ocr_image(image, LIMITS)
    image.close()

@pytest.mark.parametrize('data,name,mime,code', [
    (b'', 'x.pdf', 'application/pdf', 'empty_document'),
    (b'%PDF-1.7', 'x.txt', 'text/plain', 'unsupported_document'),
    (b'private contents', 'x.pdf', 'application/pdf', 'invalid_signature'),
    (b'%PDF-1.7', '../x.pdf', 'application/pdf', 'invalid_filename'),
    (b'%PDF-1.7', 'x.pdf', 'image/png', 'unsupported_document'),
    (b'%PDF-1.7 garbage', 'x.pdf', 'application/pdf', 'invalid_pdf'),
    (b'\x89PNG\r\n\x1a\ncorrupt', 'x.png', 'image/png', 'invalid_image'),
])
def test_invalid_envelopes_and_corrupt_documents(data, name, mime, code):
    with pytest.raises(ReportError, match=code):
        extract_document(data, name, mime, LIMITS)

def test_max_bytes_and_image_dimensions():
    with pytest.raises(ReportError, match='file_too_large'):
        validate_envelope(b'%PDF-' + b' ' * 1100, 'x.pdf', 'application/pdf', replace(LIMITS, max_bytes=1024))
    with pytest.raises(ReportError, match='image_dimensions'):
        decode_image(image_bytes(size=(4097, 10)), 'png', LIMITS)
    with pytest.raises(ReportError, match='image_dimensions'):
        decode_image(image_bytes(size=(3000, 3000)), 'png', LIMITS)

def test_too_many_pages_and_encrypted_pdf():
    writer = PdfWriter()
    for _ in range(6): writer.add_blank_page(100, 100)
    output = BytesIO(); writer.write(output)
    with pytest.raises(ReportError, match='too_many_pages'):
        extract_document(output.getvalue(), 'x.pdf', 'application/pdf', LIMITS)
    encrypted = PdfWriter(); encrypted.append(PdfReader(BytesIO(sample()))); encrypted.encrypt('secret')
    output = BytesIO(); encrypted.write(output)
    with pytest.raises(ReportError, match='encrypted_pdf'):
        extract_document(output.getvalue(), 'x.pdf', 'application/pdf', LIMITS)

def test_empty_pdf_and_empty_ocr_text(monkeypatch):
    writer = PdfWriter(); output = BytesIO(); writer.write(output)
    with pytest.raises(ReportError, match='empty_document'):
        extract_document(output.getvalue(), 'x.pdf', 'application/pdf', LIMITS)
    monkeypatch.setattr('app.services.document_extraction.ocr_image', lambda *args: '')
    with pytest.raises(ReportError, match='empty_text'):
        extract_document(image_bytes(), 'x.png', 'image/png', LIMITS)

def test_unmarked_report_rejected_without_exposing_document(report_client):
    response = upload(report_client, pdf_bytes(['PRIVATE_PERSON', 'Hemoglobin 11.2 g/dL 12 - 16']))
    assert response.status_code == 422 and response.json()['error']['code'] == 'synthetic_marker_required'
    assert 'PRIVATE_PERSON' not in response.text

def test_no_measurements_are_invented():
    result = extract_document(pdf_bytes([HEADER, 'Unsupported sodium | 140 | mmol/L | 135 - 145']), 'x.pdf', 'application/pdf', LIMITS)
    assert result.measurements == [] and any('No supported' in warning for warning in result.warnings)

@pytest.mark.parametrize('token,expected', [('11.2', 11.2), ('105', 105), ('0.8', 0.8), ('11,2', 11.2), ('1,234', None), ('I1.2', None), ('1e309', None), ('<5', None)])
def test_numeric_tokens_never_repair_digits(token, expected):
    assert number(token) == expected

@pytest.mark.parametrize('line,status', [
    ('HGB | 11.2 | g/dL | 12 - 16', 'below_reported_interval'),
    ('GLU 105 mg/dL 70 - 110', 'within_reported_interval'),
    ('Creatinine 1,4 mg/dL 0,6 - 1,2', 'above_reported_interval'),
    ('Total cholesterol 205 mg/dL < 200', 'above_reported_interval'),
    ('HDL 40 mg/dL >= 40', 'within_reported_interval'),
    ('HDL 40 mg/dL > 40', 'below_reported_interval'),
    ('HDL 55 mg/dL', 'not_evaluated'),
    ('Hemoglobin 11.2 g/dL 120 - 160 g/L', 'not_evaluated'),
    ('Hemoglobin 11.2 12 - 16', 'not_evaluated'),
    ('Hemoglobin 11 .2 g/dL 12 - 16', 'not_evaluated'),
    ('Hemoglobin 11.2 g/dL 16 - 12', 'not_evaluated'),
])
def test_parser_units_bounds_and_ambiguity(line, status):
    rows, _ = parse_laboratory_text(line)
    assert len(rows) == 1 and rows[0].status == status and rows[0].review_required
    if line.startswith('Hemoglobin 11 .2'): assert rows[0].value is None

def test_duplicate_analytes_keep_distinct_source_rows_and_missing_units():
    rows, _ = parse_laboratory_text('HGB | 11.2 | g/dL | 12 - 16\nHemoglobin | 112 | g/L | 120 - 160\nCreatinine | 0.8 | |')
    assert len(rows) == 3 and rows[0].id != rows[1].id
    assert all(any('Duplicate' in warning for warning in row.warnings) for row in rows[:2])
    assert rows[2].unit is None and rows[2].status == 'not_evaluated'

def test_maximum_row_count_and_text_cap():
    rows, warnings = parse_laboratory_text('\n'.join(['Glucose 105 mg/dL 70 - 110'] * 60))
    assert len(rows) == 50 and any('first 50' in warning for warning in warnings)

def test_worker_busy_does_not_queue_or_persist():
    service = ReportProcessingService(LIMITS)
    service._slot.acquire()
    try:
        with pytest.raises(ReportError, match='report_busy') as error: service.process(sample(), 'x.pdf', 'application/pdf')
        assert error.value.status == 429
    finally: service._slot.release()

def test_worker_timeout_reaps_process_and_releases_slot(monkeypatch):
    process = Mock()
    process.communicate.side_effect = [subprocess.TimeoutExpired('fixed', 1), (b'', b'')]
    process.poll.return_value = None
    monkeypatch.setattr('app.services.report_processing.subprocess.Popen', Mock(return_value=process))
    job = Mock(); monkeypatch.setattr('app.services.report_processing.WindowsWorkerJob', Mock(return_value=job))
    service = ReportProcessingService(LIMITS, timeout=1)
    with pytest.raises(ReportError, match='document_timeout'): service.process(sample(), 'x.pdf', 'application/pdf')
    process.kill.assert_called_once(); job.close.assert_called_once()
    assert service._slot.acquire(blocking=False); service._slot.release()

def test_api_acknowledgement_multipart_limits_and_no_body_logging(report_client, caplog):
    caplog.set_level(logging.INFO)
    for acknowledgement in ['false', '']:
        response = upload(report_client, sample(), acknowledged=acknowledgement)
        assert response.status_code == 400
    response = report_client.post('/api/v1/reports/extract', json={'file': 'PRIVATE_MARKER'})
    assert response.status_code == 415 and 'PRIVATE_MARKER' not in caplog.text
    malformed = report_client.post('/api/v1/reports/extract', content=b'PRIVATE_MARKER', headers={'Content-Type': 'multipart/form-data; boundary=x'})
    assert malformed.status_code == 400 and 'PRIVATE_MARKER' not in malformed.text
    huge = report_client.post('/api/v1/reports/extract', content=b' ' * (5 * 1024 * 1024 + 70_000), headers={'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': '0'})
    assert huge.status_code == 413
    for header, value in [('cache-control', 'no-store'), ('x-content-type-options', 'nosniff')]: assert malformed.headers[header] == value

def test_large_json_still_rejected_and_report_cors_unchanged(report_client):
    response = report_client.post('/api/v1/predict/heart-disease', content=b' ' * 20_000, headers={'Content-Type': 'application/json'})
    assert response.status_code == 413
    response = report_client.options('/api/v1/reports/extract', headers={'Origin': 'http://127.0.0.1:3000', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 200 and response.headers['access-control-allow-origin'] == 'http://127.0.0.1:3000'

def test_original_six_openapi_contracts_preserved(report_client):
    original = json.loads((ROOT/'frontend/src/test/fixtures/openapi.json').read_text())
    current = report_client.get('/openapi.json').json()
    for path, contract in original['paths'].items(): assert current['paths'][path] == contract
    for name, contract in original['components']['schemas'].items(): assert current['components']['schemas'][name] == contract
    assert '/api/v1/reports/extract' in current['paths']

def test_memory_only_processing_has_no_spool_or_temporary_paths(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    result = extract_document(sample(), 'synthetic.pdf', 'application/pdf', LIMITS)
    assert len(result.measurements) == 3 and list(tmp_path.iterdir()) == []
    assert b'TemporaryFile' not in (ROOT/'app/services/document_extraction.py').read_bytes()
