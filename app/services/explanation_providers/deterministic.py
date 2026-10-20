"""Curated multilingual rendering; all calculations use Phase 8 comparison logic."""
from collections import Counter
from decimal import Decimal
from app.schemas.report_explanations import (
    ReportExplanationRequest, ReportExplanation, MeasurementExplanation,
    DoctorQuestion, ExplanationCounts, analyte_for_name,
)
from app.services.laboratory_parser import compare_interval
from app.services.laboratory_knowledge import TEXT, knowledge


def display_number(value: float) -> str:
    """Retain the JSON number's value without localized decimal substitutions."""
    return format(Decimal(str(value)), 'f')


def interval_text(row, missing: str) -> str:
    interval = row.reference_range
    if interval is None:
        return missing
    bounds = []
    if interval.lower is not None:
        bounds.append(('>= ' if interval.lower_inclusive else '> ') + display_number(interval.lower))
    if interval.upper is not None:
        bounds.append(('<= ' if interval.upper_inclusive else '< ') + display_number(interval.upper))
    return ' ; '.join(bounds) + (' ' + interval.unit if interval.unit else ' (' + missing + ')')


class DeterministicExplanationProvider:
    def explain(self, request: ReportExplanationRequest) -> ReportExplanation:
        """Render facts using approved strings; never infer a missing interval."""
        text = TEXT[request.language]
        rows, questions = [], []
        for row in request.measurements:
            analyte = analyte_for_name(row.name)
            name, definition, url = knowledge(analyte, request.language)
            comparison = compare_interval(row.value, row.unit, row.reference_range)
            factual = text['value'].format(value=display_number(row.value) if row.value is not None else text['unknown'],
                unit=row.unit or '(' + text['missing'] + ')', interval=interval_text(row, text['missing']))
            rows.append(MeasurementExplanation(measurement_id=row.id, analyte=analyte, name=name, source_name=row.name,
                value=row.value, unit=row.unit, reference_range=row.reference_range, comparison=comparison,
                user_corrected=row.user_corrected, definition=definition,
                explanation=' '.join([definition, factual, text[comparison], text['limit']]),
                source_measurement_ids=[row.id], source_url=url))
            questions.append(DoctorQuestion(text=text['question'].format(name=name), source_measurement_ids=[row.id]))
        counts = Counter(row.comparison for row in rows)
        totals = ExplanationCounts(reviewed=len(rows), **{key: counts[key] for key in
            ['below_reported_interval', 'within_reported_interval', 'above_reported_interval', 'not_evaluated']})
        return ReportExplanation(language=request.language, counts=totals,
            summary=text['summary'].format(**totals.model_dump()), measurement_explanations=rows,
            questions_for_doctor=questions, warnings=[text['warning']], disclaimer=text['disclaimer'])
