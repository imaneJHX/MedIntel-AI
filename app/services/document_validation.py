"""Validate declared format against signatures and actual decoders in a bounded worker."""
from dataclasses import dataclass
from io import BytesIO
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
from app.services.report_errors import ReportError

@dataclass(frozen=True)
class DocumentLimits:
    max_bytes: int = 5 * 1024 * 1024
    max_pages: int = 5
    max_dimension: int = 4096
    max_pixels: int = 8_000_000
    max_text_chars: int = 50_000
    ocr_timeout: int = 8
    tesseract_command: str = ''

FORMATS = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}

def validate_envelope(data: bytes, filename: str, mime: str, limits: DocumentLimits) -> str:
    if not data:
        raise ReportError('empty_document', 'Select a non-empty synthetic report.')
    if len(data) > limits.max_bytes:
        raise ReportError('file_too_large', 'The file exceeds the configured 5 MiB upload limit.', 413)
    if not filename or len(filename) > 128 or '/' in filename or '\\' in filename or any(ord(c) < 32 for c in filename):
        raise ReportError('invalid_filename', 'Use a short filename without paths or control characters.')
    extension = '.' + filename.rsplit('.', 1)[-1].lower()
    if extension not in FORMATS or mime.lower() != FORMATS[extension]:
        raise ReportError('unsupported_document', 'Use a PDF, PNG or JPEG with matching file type and extension.', 415)
    expected = 'pdf' if extension == '.pdf' else 'png' if extension == '.png' else 'jpeg'
    detected = 'pdf' if data.startswith(b'%PDF-') else 'png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'jpeg' if data.startswith(b'\xff\xd8\xff') else None
    if detected != expected:
        raise ReportError('invalid_signature', 'File contents do not match the declared document format.', 415)
    return expected

def check_dimensions(width: float, height: float, limits: DocumentLimits) -> None:
    if width <= 0 or height <= 0 or width > limits.max_dimension or height > limits.max_dimension or width * height > limits.max_pixels:
        raise ReportError('image_dimensions', 'Image dimensions exceed 4096 per side or 8 million pixels.', 413)

def decode_image(data: bytes, expected: str, limits: DocumentLimits) -> Image.Image:
    Image.MAX_IMAGE_PIXELS = limits.max_pixels
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format != expected.upper() or getattr(image, 'n_frames', 1) != 1:
                    raise ReportError('unsupported_image', 'Use a single-frame PNG or JPEG image.', 415)
                check_dimensions(*image.size, limits)
                image.verify()
            with Image.open(BytesIO(data)) as image:
                image.load()
                # Orientation and grayscale only: never repair digits, punctuation or units.
                return ImageOps.exif_transpose(image).convert('L')
    except ReportError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ReportError('image_dimensions', 'Image exceeds the safe decoding limits.', 413) from None
    except (UnidentifiedImageError, OSError, ValueError):
        raise ReportError('invalid_image', 'The image is malformed or cannot be decoded.') from None
