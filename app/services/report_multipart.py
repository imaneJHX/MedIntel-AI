"""Parse one upload and one acknowledgement directly into bounded RAM, never a spool file."""
from python_multipart import MultipartParser
from python_multipart.multipart import parse_options_header
from app.services.report_errors import ReportError

def parse_report_form(body: bytes, content_type: str, max_bytes: int) -> tuple[bytes, str, str]:
    _, options = parse_options_header(content_type)
    boundary = options.get(b'boundary', b'')
    if not boundary or len(boundary) > 200:
        raise ReportError('invalid_multipart', 'A valid multipart boundary is required.', 400)
    state = {'headers': {}, 'header_name': bytearray(), 'header_value': bytearray(), 'data': bytearray(), 'parts': 0, 'complete': False}
    fields: dict[bytes, tuple[bytes, dict]] = {}
    def begin():
        state['parts'] += 1
        if state['parts'] > 2:
            raise ReportError('invalid_multipart', 'Send exactly file and synthetic_only fields.', 400)
        state.update(headers={}, header_name=bytearray(), header_value=bytearray(), data=bytearray())
    def header_field(data, start, end):
        state['header_name'].extend(data[start:end])
        if len(state['header_name']) > 100:
            raise ReportError('invalid_multipart', 'Multipart headers exceed their supported length.', 400)
    def header_value(data, start, end):
        state['header_value'].extend(data[start:end])
        if len(state['header_value']) > 1024:
            raise ReportError('invalid_multipart', 'Multipart headers exceed their supported length.', 400)
    def header_end():
        if len(state['headers']) >= 5:
            raise ReportError('invalid_multipart', 'Too many multipart headers.', 400)
        state['headers'][bytes(state['header_name']).lower()] = bytes(state['header_value'])
        state['header_name'], state['header_value'] = bytearray(), bytearray()
    def part_data(data, start, end):
        state['data'].extend(data[start:end])
        if len(state['data']) > max_bytes:
            raise ReportError('file_too_large', 'The upload exceeds the configured file size limit.', 413)
    def end_part():
        disposition, metadata = parse_options_header(state['headers'].get(b'content-disposition', b''))
        name = metadata.get(b'name')
        if disposition != b'form-data' or name not in {b'file', b'synthetic_only'} or name in fields:
            raise ReportError('invalid_multipart', 'Send one file and one synthetic_only acknowledgement.', 400)
        fields[name] = (bytes(state['data']), {**state['headers'], **metadata})
    def end():
        state['complete'] = True
    parser = MultipartParser(boundary, {'on_part_begin': begin, 'on_header_field': header_field,
        'on_header_value': header_value, 'on_header_end': header_end, 'on_part_data': part_data,
        'on_part_end': end_part, 'on_end': end}, max_size=max_bytes + 65_536)
    try:
        parser.write(body)
        parser.finalize()
    except ReportError:
        raise
    except Exception:
        raise ReportError('invalid_multipart', 'The multipart form is malformed.', 400) from None
    if not state['complete'] or set(fields) != {b'file', b'synthetic_only'}:
        raise ReportError('invalid_multipart', 'Send a complete form with file and synthetic_only fields.', 400)
    if fields[b'synthetic_only'][0] != b'true':
        raise ReportError('synthetic_ack_required', 'Explicitly acknowledge that this is a synthetic document with no real personal or patient information.', 400)
    data, headers = fields[b'file']
    try:
        return data, headers.get(b'filename', b'').decode('utf-8'), headers.get(b'content-type', b'').decode('ascii')
    except UnicodeError:
        raise ReportError('invalid_multipart', 'Use a supported filename and MIME encoding.', 400) from None
