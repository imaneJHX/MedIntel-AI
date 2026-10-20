"""Generate small, identifier-free demonstration PDFs and raster OCR fixtures."""
from pathlib import Path
import json
from io import BytesIO
from pypdf import PdfWriter
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject
import pypdfium2 as pdfium

HEADER = 'SYNTHETIC TEST DOCUMENT — NOT A REAL PATIENT REPORT'
REPORTS = {
    'routine_blood_count': [HEADER, 'Synthetic routine blood count', '', 'Measurement | Value | Unit | Reference interval',
        'Hemoglobin | 11.2 | g/dL | 12.0 - 16.0', 'WBC | 6.4 | 10^9/L | 4.0 - 11.0', 'Platelet count | 450 | 10^9/L | 150 - 400'],
    'lipid_panel': [HEADER, 'Synthetic lipid panel', '', 'Measurement | Value | Unit | Reference interval',
        'Total cholesterol | 205 | mg/dL | < 200', 'HDL cholesterol | 55 | mg/dL | >= 40',
        'LDL cholesterol | 90 | mg/dL | 70 - 130', 'Triglycerides | 140 | mg/dL | Not provided'],
    'glucose_kidney': [HEADER, 'Synthetic glucose and kidney function report', '',
        'Glucose    105    mg/dL    70 - 110', 'Creatinine    1,4    mg/dL    0,6 - 1,2',
        'Creatinine | 0.8 | mg/dL | 0.6 - 1.2', 'Unsupported sodium | 140 | mmol/L | 135 - 145'],
}

def pdf_bytes(lines: list[str]) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
                             NameObject('/BaseFont'): NameObject('/Helvetica'), NameObject('/Encoding'): NameObject('/WinAnsiEncoding')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    commands = ['BT /F1 10 Tf 40 740 Td 22 TL']
    for line in lines:
        escaped = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        commands.append(f'({escaped}) Tj T*')
    commands.append('ET')
    stream = DecodedStreamObject()
    stream.set_data('\n'.join(commands).encode('cp1252'))
    page[NameObject('/Contents')] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()

def main() -> None:
    destination = Path(__file__).resolve().parents[1] / 'frontend/public/samples'
    destination.mkdir(parents=True, exist_ok=True)
    for name, lines in REPORTS.items():
        path = destination / f'synthetic_{name}.pdf'
        if path.exists():
            continue
        path.write_bytes(pdf_bytes(lines))
    with pdfium.PdfDocument((destination/'synthetic_lipid_panel.pdf').read_bytes()) as document:
        page = document[0]
        bitmap = page.render(scale=2)
        image = bitmap.to_pil()
        try:
            for extension, kind in [('png', 'PNG'), ('jpg', 'JPEG')]:
                path = destination / f'synthetic_lipid_panel.{extension}'
                if not path.exists():
                    image.convert('RGB').save(path, format=kind)
        finally:
            image.close()
            bitmap.close()
            page.close()
    print('Synthetic sample reports available in frontend/public/samples; no patient identifiers included.')

if __name__ == '__main__':
    main()
