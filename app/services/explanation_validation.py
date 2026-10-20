"""Closed approved-output validation: broad medical claim filters are insufficient."""
from app.schemas.report_explanations import ReportExplanation


def validate_explanation(candidate: object, expected: ReportExplanation) -> ReportExplanation:
    """Require exact approved facts AND text, including IDs, numbers, units and counts.

    An arbitrary paraphrase cannot be proved medically safe by a keyword scan.
    This phase therefore accepts only the curated deterministic rendering.
    """
    validated = ReportExplanation.model_validate(candidate)
    if validated.model_dump() != expected.model_dump():
        raise ValueError('Output is outside the approved educational rendering.')
    if len(validated.model_dump_json().encode('utf-8')) > 384 * 1024:
        raise ValueError('Explanation output exceeds the fixed byte bound.')
    return validated
