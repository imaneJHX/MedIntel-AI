"""Fixed general explanations, with verified NLM sources; no value interpretation."""
from app.schemas.medical_reports import LaboratoryEducation

BASE = 'https://medlineplus.gov/lab-tests/'
CATALOG = {
    'hemoglobin': ('Hemoglobin', 'Hemoglobin is an oxygen-carrying protein in red blood cells. This explanation does not interpret an individual result.', 'hemoglobin-test/'),
    'glucose': ('Blood glucose', 'Glucose is a sugar used for energy. Test timing and sample context matter when discussing a measurement.', 'blood-glucose-test/'),
    'total_cholesterol': ('Total cholesterol', 'A lipid panel reports several blood fat measurements. Total cholesterol is one part of that panel.', 'cholesterol-levels/'),
    'hdl': ('HDL cholesterol', 'HDL is one cholesterol measurement in a lipid panel. Its meaning needs context alongside other measurements.', 'cholesterol-levels/'),
    'ldl': ('LDL cholesterol', 'LDL is another cholesterol measurement in a lipid panel. This tool does not evaluate personal cardiovascular risk.', 'cholesterol-levels/'),
    'triglycerides': ('Triglycerides', 'Triglycerides are fats measured as part of many lipid panels. A reported interval is specific to its document and context.', 'cholesterol-levels/'),
    'wbc': ('White blood cell count', 'This count measures white blood cells, which are part of the immune system. It cannot identify a condition on its own.', 'white-blood-count-wbc/'),
    'platelets': ('Platelet count', 'Platelets help blood clot. A platelet count measures how many are in a blood sample.', 'platelet-tests/'),
    'creatinine': ('Creatinine', 'Creatinine is a waste product measured in blood or urine tests. The sample type and other information matter for interpretation.', 'creatinine-test/'),
}

def education_catalog() -> list[LaboratoryEducation]:
    return [LaboratoryEducation(analyte=key, name=name, explanation=text, source_url=BASE + source)
            for key, (name, text, source) in CATALOG.items()]
