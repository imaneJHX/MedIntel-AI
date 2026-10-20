"""In-memory PDF text and optional local Tesseract OCR; no cloud calls or disk files."""
from io import BytesIO
from pathlib import Path
import logging
import math
import shutil
import subprocess
import re
from PIL import Image
from pypdf import PdfReader, apply_configuration
import pypdfium2 as pdfium
from app.schemas.medical_reports import ReportExtraction
from app.services.document_validation import DocumentLimits, check_dimensions, decode_image, validate_envelope
from app.services.report_errors import ReportError
from app.services.laboratory_parser import parse_laboratory_text
from app.services.laboratory_education import education_catalog

def resolve_tesseract(configured: str = '') -> str | None:
    if configured:
        candidate = Path(configured)
        return str(candidate) if candidate.is_absolute() and candidate.is_file() else None
    found = shutil.which('tesseract')
    if found:
        return found
    for candidate in [Path('C:/Program Files/Tesseract-OCR/tesseract.exe'), Path('C:/Program Files (x86)/Tesseract-OCR/tesseract.exe')]:
        if candidate.is_file():
            return str(candidate)
    return None

def ocr_image(image: Image.Image, limits: DocumentLimits) -> str:
    executable = resolve_tesseract(limits.tesseract_command)
    if not executable:
        raise ReportError('ocr_unavailable', 'Local Tesseract with English language data is not installed. Use a text-based PDF or follow the Windows OCR setup guide.', 503)
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    try:
        result = subprocess.run([executable, 'stdin', 'stdout', '-l', 'eng', '--psm', '6'], input=buffer.getvalue(),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=limits.ocr_timeout,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        raise ReportError('ocr_timeout', 'Local OCR exceeded its time limit. Try a smaller, clearer synthetic document.', 408) from None
    except OSError:
        raise ReportError('ocr_unavailable', 'Local Tesseract could not start. Verify the OCR installation and English language data.', 503) from None
    if result.returncode:
        raise ReportError('ocr_failed', 'Local OCR could not read the image. Check the English language data and use a clearer synthetic report.')
    if len(result.stdout) > limits.max_text_chars * 4:
        raise ReportError('text_too_large', 'Extracted text exceeds the document processing limit.', 413)
    return result.stdout.decode('utf-8', errors='replace')

@apply_configuration(zlib_maximum_output_length=8 * 1024 * 1024, jbig2_maximum_output_length=8 * 1024 * 1024,
    lzw_maximum_output_length=8 * 1024 * 1024, run_length_maximum_output_length=8 * 1024 * 1024,
    array_based_stream_maximum_output_length=8 * 1024 * 1024, maximum_declared_stream_length=8 * 1024 * 1024,
    stream_decoding_work_maximum_length=16 * 1024 * 1024, page_tree_maximum_entries=1000,
    page_tree_maximum_depth=20, xform_maximum_invocations_per_extraction=500, disable_legacy_handling=True)
def extract_pdf(data: bytes, limits: DocumentLimits) -> tuple[str, int, str]:
    logging.getLogger('pypdf').setLevel(logging.CRITICAL)
    try:
        reader = PdfReader(BytesIO(data), strict=True, root_object_recovery_limit=1000)
        if reader.is_encrypted:
            raise ReportError('encrypted_pdf', 'Encrypted PDFs are not supported, even with an empty password.')
        pages = len(reader.pages)
        if pages < 1:
            raise ReportError('empty_document', 'The PDF contains no pages.')
        if pages > limits.max_pages:
            raise ReportError('too_many_pages', 'Use a synthetic PDF with at most five pages.', 413)
        catalog = reader.trailer['/Root']
        names = catalog.get('/Names', {})
        if hasattr(names, 'get_object'):
            names = names.get_object()
        if any(key in catalog for key in ['/OpenAction', '/AA', '/AcroForm']) or any(key in names for key in ['/JavaScript', '/EmbeddedFiles']):
            raise ReportError('active_pdf', 'Interactive PDFs and embedded files are not supported.')
        texts, methods, count = [], set(), 0
        for index, page in enumerate(reader.pages):
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            if not math.isfinite(width + height) or width <= 0 or height <= 0 or width > 1440 or height > 1440:
                raise ReportError('pdf_dimensions', 'PDF page dimensions exceed the supported demonstration layout.', 413)
            content = page.get_contents()
            if content and len(content.get_data()) > 2 * 1024 * 1024:
                raise ReportError('pdf_content_limit', 'PDF page content exceeds the safe extraction limit.', 413)
            text = page.extract_text(extraction_mode='layout') or ''
            # OCR blank or text-poor pages; never repair recognized numeric tokens.
            if len(text.strip()) < 20:
                with pdfium.PdfDocument(data) as rendered:
                    pdf_page = rendered[index]
                    scale = min(2.0, limits.max_dimension / width, limits.max_dimension / height,
                                math.sqrt(limits.max_pixels / (width * height)))
                    check_dimensions(math.ceil(width * scale), math.ceil(height * scale), limits)
                    bitmap = pdf_page.render(scale=scale, may_draw_forms=False, draw_annots=False)
                    try:
                        image = bitmap.to_pil().convert('L')
                        try:
                            text = ocr_image(image, limits)
                        finally:
                            image.close()
                    finally:
                        bitmap.close()
                        pdf_page.close()
                methods.add('local_ocr')
            else:
                methods.add('embedded_text')
            count += len(text)
            if count > limits.max_text_chars:
                raise ReportError('text_too_large', 'Extracted text exceeds the document processing limit.', 413)
            texts.append(text)
        return '\n'.join(texts), pages, next(iter(methods)) if len(methods) == 1 else 'mixed'
    except ReportError:
        raise
    except Exception:
        raise ReportError('invalid_pdf', 'The PDF is malformed or exceeds safe extraction limits.') from None

def extract_document(data: bytes, filename: str, mime: str, limits: DocumentLimits) -> ReportExtraction:
    kind = validate_envelope(data, filename, mime, limits)
    if kind == 'pdf':
        text, pages, method = extract_pdf(data, limits)
    else:
        image = decode_image(data, kind, limits)
        try:
            text = ocr_image(image, limits)
        finally:
            image.close()
        pages, method = 1, 'local_ocr'
    if not text.strip():
        raise ReportError('empty_text', 'No readable text was extracted. Use a clearer synthetic demonstration report.')
    if len(text) > limits.max_text_chars:
        raise ReportError('text_too_large', 'Extracted text exceeds the document processing limit.', 413)
    if not re.search(r'SYNTHETIC\s+TEST\s+DOCUMENT', text, re.I):
        raise ReportError('synthetic_marker_required', 'The document must visibly contain SYNTHETIC TEST DOCUMENT. Real patient reports are prohibited.')
    measurements, warnings = parse_laboratory_text(text)
    if method != 'embedded_text':
        warnings.insert(0, 'OCR can alter digits, decimal separators and units. Review every source line against the synthetic original.')
    warnings.append('A synthetic marker and acknowledgement cannot prove that a document contains no personal information.')
    return ReportExtraction(filename=f'synthetic-report.{kind if kind != "jpeg" else "jpg"}', page_count=pages,
                            extraction_method=method, measurements=measurements, warnings=warnings, education=education_catalog())
