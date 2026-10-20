"""Versioned educational translations; sources reused from the Phase 8 catalogue.

NLM MedlinePlus pages checked 2026-10-20. Translations are project-authored,
not official MedlinePlus translations. No external ranges or diagnostic rules.
"""
from app.services.laboratory_education import CATALOG, BASE

TRANSLATIONS = {
    'fr': {
        'hemoglobin': ('Hémoglobine', "L’hémoglobine est une protéine des globules rouges qui transporte l’oxygène."),
        'glucose': ('Glucose sanguin', "Le glucose est un sucre utilisé comme source d’énergie. Le moment du prélèvement compte pour comprendre cette mesure."),
        'total_cholesterol': ('Cholestérol total', 'Le cholestérol total est une des mesures des lipides sanguins figurant dans un bilan lipidique.'),
        'hdl': ('Cholestérol HDL', 'Le HDL transporte du cholestérol vers le foie. Sa mesure doit être replacée dans le contexte du bilan complet.'),
        'ldl': ('Cholestérol LDL', 'Le LDL transporte du cholestérol dans le sang. Cette mesure seule ne fournit pas une estimation du risque individuel.'),
        'triglycerides': ('Triglycérides', 'Les triglycérides sont des graisses utilisées pour stocker de l’énergie et mesurées dans de nombreux bilans lipidiques.'),
        'wbc': ('Numération des globules blancs', 'Les globules blancs participent au système immunitaire. Leur numération mesure leur quantité dans un prélèvement sanguin.'),
        'platelets': ('Numération des plaquettes', 'Les plaquettes contribuent à la coagulation. Leur numération mesure leur quantité dans un prélèvement sanguin.'),
        'creatinine': ('Créatinine', 'La créatinine est un déchet produit par les muscles et éliminé par les reins. Le type de prélèvement et les autres résultats comptent.'),
    },
    'ar': {
        'hemoglobin': ('الهيموغلوبين', 'الهيموغلوبين بروتين في خلايا الدم الحمراء يساعد على نقل الأكسجين.'),
        'glucose': ('غلوكوز الدم', 'الغلوكوز سكر يستخدمه الجسم للحصول على الطاقة. توقيت أخذ العينة مهم لفهم هذا القياس.'),
        'total_cholesterol': ('الكوليسترول الكلي', 'الكوليسترول الكلي أحد قياسات دهون الدم التي تظهر في فحص الدهون.'),
        'hdl': ('كوليسترول HDL', 'يساعد HDL على نقل الكوليسترول إلى الكبد. يُفهم هذا القياس ضمن سياق بقية نتائج فحص الدهون.'),
        'ldl': ('كوليسترول LDL', 'ينقل LDL الكوليسترول في الدم. هذا القياس وحده لا يحدد مستوى الخطر لدى الفرد.'),
        'triglycerides': ('الدهون الثلاثية', 'الدهون الثلاثية دهون يستخدمها الجسم لتخزين الطاقة، وتُقاس في كثير من فحوص الدهون.'),
        'wbc': ('عدد خلايا الدم البيضاء', 'خلايا الدم البيضاء جزء من جهاز المناعة. يقيس هذا الفحص عددها في عينة الدم.'),
        'platelets': ('عدد الصفائح الدموية', 'تساعد الصفائح الدموية على تخثر الدم. يقيس هذا الفحص عددها في عينة الدم.'),
        'creatinine': ('الكرياتينين', 'الكرياتينين مادة ناتجة عن نشاط العضلات وتزيلها الكلى. نوع العينة وبقية المعلومات مهمان لفهم القياس.'),
    },
}

TEXT = {
    'en': {
        'summary': 'This synthetic demonstration report contains {reviewed} transcription-reviewed measurements: {below_reported_interval} below, {within_reported_interval} within, {above_reported_interval} above their printed intervals, and {not_evaluated} not evaluated. These counts are not a health assessment.',
        'value': 'Reviewed demonstration value: {value} {unit}. Printed reference interval: {interval}.',
        'below_reported_interval': 'The value is below the printed reference interval.',
        'within_reported_interval': 'The value is within the printed reference interval. This does not establish that someone is healthy.',
        'above_reported_interval': 'The value is above the printed reference interval.',
        'not_evaluated': 'No comparison is available because the value, unit or printed reference interval is missing or uncertain. No missing information has been inferred.',
        'missing': 'not provided', 'unknown': 'uncertain',
        'limit': 'A printed interval comparison alone does not establish a diagnosis. The full report and clinical context matter.',
        'question': 'What context and other information would help a healthcare professional interpret the {name} measurement in the full report?',
        'warning': 'Reviewed means the user confirmed the transcription, not that a clinician or laboratory validated it. Only reviewed measurements are included.',
        'fallback': 'The requested provider could not supply validated output. Curated deterministic explanations were used instead.',
        'disclaimer': 'Educational synthetic demonstration only. Not a medical diagnosis, health assessment, disease probability, treatment recommendation or emergency triage service.',
    },
    'fr': {
        'summary': 'Ce rapport fictif de démonstration contient {reviewed} mesures dont la transcription a été confirmée : {below_reported_interval} en dessous, {within_reported_interval} dans, {above_reported_interval} au-dessus de leur intervalle imprimé, et {not_evaluated} non évaluées. Ces nombres ne constituent pas une évaluation de santé.',
        'value': 'Valeur de démonstration relue : {value} {unit}. Intervalle de référence imprimé : {interval}.',
        'below_reported_interval': 'La valeur est en dessous de l’intervalle de référence imprimé.',
        'within_reported_interval': 'La valeur est dans l’intervalle de référence imprimé. Cela ne prouve pas qu’une personne est en bonne santé.',
        'above_reported_interval': 'La valeur est au-dessus de l’intervalle de référence imprimé.',
        'not_evaluated': 'La comparaison est indisponible car la valeur, l’unité ou l’intervalle imprimé manque ou reste incertain. Aucune information manquante n’a été déduite.',
        'missing': 'non fourni', 'unknown': 'incertaine',
        'limit': 'La comparaison à un intervalle imprimé ne suffit pas à établir un diagnostic. Le rapport complet et le contexte clinique comptent.',
        'question': 'Quel contexte et quelles autres informations aideraient un professionnel de santé à comprendre la mesure « {name} » dans le rapport complet ?',
        'warning': 'La confirmation concerne la transcription par l’utilisateur, pas une validation médicale ou du laboratoire. Seules les mesures relues sont incluses.',
        'fallback': 'Le fournisseur demandé n’a pas produit de résultat validé. Des explications déterministes prédéfinies ont été utilisées.',
        'disclaimer': 'Démonstration fictive à visée éducative uniquement. Ne fournit ni diagnostic, ni évaluation de santé, ni probabilité de maladie, ni recommandation de traitement, ni triage d’urgence.',
    },
    'ar': {
        'summary': 'يحتوي هذا التقرير الاصطناعي التجريبي على {reviewed} قياسات تمت مراجعة نسخها: {below_reported_interval} أقل من المجالات المرجعية المطبوعة، و{within_reported_interval} ضمنها، و{above_reported_interval} أعلى منها، و{not_evaluated} لم تُقيّم. هذه الأعداد ليست تقييماً صحياً.',
        'value': 'القيمة التجريبية التي تمت مراجعتها: {value} {unit}. المجال المرجعي المطبوع: {interval}.',
        'below_reported_interval': 'القيمة أقل من المجال المرجعي المطبوع.',
        'within_reported_interval': 'القيمة ضمن المجال المرجعي المطبوع. هذا لا يثبت أن الشخص يتمتع بصحة جيدة.',
        'above_reported_interval': 'القيمة أعلى من المجال المرجعي المطبوع.',
        'not_evaluated': 'المقارنة غير متاحة لأن القيمة أو الوحدة أو المجال المطبوع مفقود أو غير مؤكد. لم تُستنتج أي معلومات مفقودة.',
        'missing': 'غير متوفر', 'unknown': 'غير مؤكدة',
        'limit': 'المقارنة بالمجال المطبوع وحدها لا تثبت تشخيصاً طبياً. التقرير الكامل والسياق السريري مهمان.',
        'question': 'ما السياق والمعلومات الأخرى التي تساعد المختص الصحي على فهم قياس «{name}» ضمن التقرير الكامل؟',
        'warning': 'المراجعة تعني أن المستخدم أكد النسخ، ولا تعني اعتماداً من طبيب أو مختبر. تُدرج القياسات التي تمت مراجعتها فقط.',
        'fallback': 'لم يقدم المزوّد المطلوب مخرجات اجتازت التحقق. استُخدمت بدلاً منها تفسيرات حتمية من معلومات معدّة مسبقاً.',
        'disclaimer': 'عرض اصطناعي تجريبي للتثقيف فقط. لا يقدم تشخيصاً طبياً أو تقييماً صحياً أو احتمال مرض أو توصية علاجية أو فرزاً للحالات الطارئة.',
    },
}


def knowledge(analyte: str, language: str) -> tuple[str, str, str]:
    """Return an approved definition and its verified source, without runtime retrieval."""
    name, definition = CATALOG[analyte][:2] if language == 'en' else TRANSLATIONS[language][analyte]
    return name, definition, BASE + CATALOG[analyte][2]
