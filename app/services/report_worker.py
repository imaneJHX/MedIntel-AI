"""Short-lived, memory-limited document worker. Only bounded JSON leaves stdout."""
import json
import logging
import os
import sys

def main() -> None:
    logging.disable(logging.CRITICAL)
    if os.name != 'nt':
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    from app.services.document_validation import DocumentLimits
    from app.services.document_extraction import extract_document
    from app.services.report_errors import ReportError
    options = json.loads(sys.argv[1])
    limits = DocumentLimits(**options['limits'])
    try:
        data = sys.stdin.buffer.read(limits.max_bytes + 1)
        result = extract_document(data, options['filename'], options['mime'], limits)
        output = {'ok': True, 'result': result.model_dump()}
    except ReportError as error:
        output = {'ok': False, 'code': error.code, 'message': error.message, 'status': error.status}
    except Exception:
        output = {'ok': False, 'code': 'document_processing_failed', 'message': 'The synthetic document could not be processed safely.', 'status': 422}
    sys.stdout.write(json.dumps(output, allow_nan=False))

if __name__ == '__main__':
    main()
