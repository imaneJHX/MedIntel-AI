"""Conservative line-based parser for explicitly marked synthetic report layouts."""
import math
import re
from collections import Counter
from app.schemas.medical_reports import LaboratoryMeasurement, ReferenceInterval, Comparison
from app.services.laboratory_education import CATALOG

ALIASES = {
    'hemoglobin': ['hemoglobin', 'haemoglobin', 'hgb', 'hb'],
    'glucose': ['blood glucose', 'fasting glucose', 'glucose', 'glu'],
    'total_cholesterol': ['total cholesterol', 'cholesterol total', 'cholesterol', 'tc'],
    'hdl': ['hdl cholesterol', 'hdl-c', 'hdl'], 'ldl': ['ldl cholesterol', 'ldl-c', 'ldl'],
    'triglycerides': ['triglycerides', 'triglyceride', 'tg'],
    'wbc': ['white blood cell count', 'white blood count', 'wbc'],
    'platelets': ['platelet count', 'platelets', 'plt'], 'creatinine': ['creatinine', 'creat'],
}
UNITS = {'g/dl', 'g/l', 'mg/dl', 'mmol/l', 'umol/l', '10^9/l', '10^3/ul', '10^6/ul', 'cells/ul'}
NUMBER = r'\d+(?:[.,]\d+)?'
LABELS = sorted([(alias, key) for key, aliases in ALIASES.items() for alias in aliases], key=lambda item: -len(item[0]))

def normalize_unit(unit: str) -> str:
    """Only normalize notation for comparison; never convert a numeric quantity."""
    return unit.strip().lower().replace('µ', 'u').replace('μ', 'u').replace('×', 'x')

def number(raw: str) -> float | None:
    if not re.fullmatch(NUMBER, raw):
        return None
    # 1,234 could be a grouped integer; never guess a decimal separator there.
    if ',' in raw and len(raw.rsplit(',', 1)[1]) not in (1, 2):
        return None
    value = float(raw.replace(',', '.'))
    return value if math.isfinite(value) and 0 <= value <= 1e9 else None

def compare_interval(value: float | None, unit: str | None, interval: ReferenceInterval | None) -> Comparison:
    if value is None or unit is None or not interval or not interval.unit:
        return 'not_evaluated'
    if normalize_unit(unit) != normalize_unit(interval.unit):
        return 'not_evaluated'
    lo, hi = interval.lower, interval.upper
    if lo is None and hi is None or lo is not None and hi is not None and lo > hi:
        return 'not_evaluated'
    if lo is not None and (value < lo or value == lo and not interval.lower_inclusive):
        return 'below_reported_interval'
    if hi is not None and (value > hi or value == hi and not interval.upper_inclusive):
        return 'above_reported_interval'
    return 'within_reported_interval'

def parse_interval(raw: str, row_unit: str | None) -> ReferenceInterval | None:
    raw = raw.strip()
    if not raw or raw.lower() in {'-', 'n/a', 'not provided'}:
        return None
    text = re.sub(r'^(?:ref(?:erence)?(?:\s+range)?|range)\s*[:=]?\s*', '', raw, flags=re.I)
    text = text.replace('–', '-').replace('—', '-').strip()
    pair = re.fullmatch(rf'({NUMBER})\s*-\s*({NUMBER})(?:\s+([^\s]+))?', text)
    single = re.fullmatch(rf'(<=|>=|<|>|≤|≥)\s*({NUMBER})(?:\s+([^\s]+))?', text)
    if pair:
        lower, upper = number(pair[1]), number(pair[2])
        if lower is None or upper is None or lower > upper:
            return None
        return ReferenceInterval(lower=lower, upper=upper, unit=pair[3] or row_unit, raw_text=raw[:160])
    if single:
        bound = number(single[2])
        if bound is None:
            return None
        is_lower = single[1] in {'>', '>=', '≥'}
        return ReferenceInterval(lower=bound if is_lower else None, upper=None if is_lower else bound,
                                 lower_inclusive=single[1] != '>', upper_inclusive=single[1] != '<',
                                 unit=single[3] or row_unit, raw_text=raw[:160])
    return None

def parse_laboratory_text(text: str) -> tuple[list[LaboratoryMeasurement], list[str]]:
    rows: list[LaboratoryMeasurement] = []
    warnings = ['Every result needs manual transcription review; no confidence score is estimated.']
    unsupported = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or len(line) > 240:
            if len(line) > 240:
                unsupported = True
            continue
        match = next(((re.match(r'^' + re.escape(alias) + r'(?=\s|[:|]|$)', line, re.I), key)
                      for alias, key in LABELS if re.match(r'^' + re.escape(alias) + r'(?=\s|[:|]|$)', line, re.I)), None)
        if not match:
            if re.search(r'\d', line) and not re.match(r'^(?:synthetic|test|measurement|analyte|name|page|report)', line, re.I):
                unsupported = True
            continue
        label_match, key = match
        label = label_match[0]
        rest = line[label_match.end():].strip().lstrip(':').strip()
        parts = [part.strip() for part in rest.strip('|').split('|')]
        value_raw, unit, reference = '', None, ''
        if len(parts) >= 2:
            value_raw, unit = parts[0], parts[1] or None
            reference = parts[2] if len(parts) == 3 else ''
        else:
            tokens = rest.split(maxsplit=2)
            value_raw = tokens[0] if tokens else ''
            if len(tokens) > 1 and re.search(r'[a-zA-Zµμ]', tokens[1]):
                unit = tokens[1]
                reference = tokens[2] if len(tokens) > 2 else ''
            else:
                reference = ' '.join(tokens[1:])
                if len(tokens) > 1 and tokens[1].startswith(('.', ',')):
                    value_raw = ''
        value = number(value_raw)
        notes = []
        if value is None:
            notes.append('Ambiguous numeric result; transcribe it manually without guessing.')
        if unit is None:
            notes.append('Unit missing; no unit has been guessed.')
        elif normalize_unit(unit) not in UNITS:
            notes.append('Unit notation is unsupported; comparison has not been evaluated.')
        interval = parse_interval(reference, unit)
        if not reference or reference.lower() in {'-', 'n/a', 'not provided'}:
            notes.append('Reference interval not provided.')
        elif interval is None:
            notes.append('Reference notation is ambiguous; comparison has not been evaluated.')
        if interval and unit and interval.unit and normalize_unit(unit) != normalize_unit(interval.unit):
            notes.append('Result and reference units differ; no conversion is performed.')
        status = compare_interval(value, unit, interval)
        if unit and normalize_unit(unit) not in UNITS or len(parts) > 3:
            status = 'not_evaluated'
            if len(parts) > 3:
                notes.append('Extra columns require manual review.')
        rows.append(LaboratoryMeasurement(id=f'measurement-{len(rows)+1}', analyte=key, name=CATALOG[key][0],
                    original_label=label, value=value, unit=unit, reference_range=interval, source_text=line,
                    extraction_status='ambiguous' if notes and notes != ['Reference interval not provided.'] else 'parsed',
                    status=status, warnings=notes))
        if len(rows) >= 50:
            warnings.append('Only the first 50 recognized rows are returned.')
            break
    counts = Counter(row.analyte for row in rows)
    for row in rows:
        if counts[row.analyte] > 1:
            row.warnings.append('Duplicate measurement label; each source occurrence is kept separately.')
            row.extraction_status = 'ambiguous'
    if unsupported:
        warnings.append('Some unsupported or overly long lines were not interpreted; no measurements were invented for them.')
    if not rows:
        warnings.append('No supported measurement rows were found. Use a documented synthetic layout.')
    return rows, warnings
