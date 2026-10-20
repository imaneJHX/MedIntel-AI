import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquareText } from "lucide-react";
import { api, ApiError, safeError } from "../../services/api";
import type {
  ReportExplanation as Explanation,
  ReportLanguage,
  ReviewedMeasurement,
} from "../../types/reportExplanations";
import { ErrorMessage } from "../ui/ErrorMessage";

const labels = {
  en: {
    overview: "Report overview",
    summary: "Plain-language summary",
    measurements: "Measurement explanations",
    questions: "Questions for a healthcare professional",
    limitations: "Important limitations",
    reviewed: "Reviewed",
    below_reported_interval: "Below reported interval",
    within_reported_interval: "Within reported interval",
    above_reported_interval: "Above reported interval",
    not_evaluated: "Not evaluated",
    source: "Reviewed source",
    interval: "Printed reference interval",
    missing: "Not provided",
    uncertain: "Uncertain",
    corrected: "User-corrected transcription",
    original: "Original extraction, transcription reviewed",
    education: "Education source: NLM MedlinePlus",
  },
  fr: {
    overview: "Vue d’ensemble du rapport",
    summary: "Résumé en langage clair",
    measurements: "Explication des mesures",
    questions: "Questions pour un professionnel de santé",
    limitations: "Limites importantes",
    reviewed: "Relues",
    below_reported_interval: "En dessous de l’intervalle imprimé",
    within_reported_interval: "Dans l’intervalle imprimé",
    above_reported_interval: "Au-dessus de l’intervalle imprimé",
    not_evaluated: "Non évaluées",
    source: "Source relue",
    interval: "Intervalle de référence imprimé",
    missing: "Non fourni",
    uncertain: "Incertaine",
    corrected: "Transcription corrigée par l’utilisateur",
    original: "Extraction d’origine, transcription relue",
    education: "Source éducative : NLM MedlinePlus",
  },
  ar: {
    overview: "نظرة عامة على التقرير",
    summary: "ملخص بلغة مبسطة",
    measurements: "تفسير القياسات",
    questions: "أسئلة للمختص الصحي",
    limitations: "حدود مهمة",
    reviewed: "تمت مراجعتها",
    below_reported_interval: "أقل من المجال المطبوع",
    within_reported_interval: "ضمن المجال المطبوع",
    above_reported_interval: "أعلى من المجال المطبوع",
    not_evaluated: "لم تُقيّم",
    source: "المصدر الذي تمت مراجعته",
    interval: "المجال المرجعي المطبوع",
    missing: "غير متوفر",
    uncertain: "غير مؤكدة",
    corrected: "نسخ صححه المستخدم",
    original: "الاستخراج الأصلي بعد مراجعة النسخ",
    education: "المصدر التثقيفي: NLM MedlinePlus",
  },
};

/** Remounted on any review change: old explanations and in-flight replies are discarded. */
export function ReportExplanation({
  measurements,
  total,
}: {
  measurements: ReviewedMeasurement[];
  total: number;
}) {
  const [language, setLanguage] = useState<ReportLanguage>("en");
  const [result, setResult] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const version = useRef(0);
  const generated = useRef(false);
  useEffect(
    () => () => {
      version.current++;
      active.current?.abort();
    },
    [],
  );

  const generate = async (selected: ReportLanguage) => {
    if (!measurements.length) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const current = ++version.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await api.explainReport(
        { synthetic_only: true, language: selected, measurements },
        controller.signal,
      );
      if (current !== version.current) return;
      setResult(response);
      generated.current = true;
    } catch (cause) {
      if (
        current === version.current &&
        !(cause instanceof ApiError && cause.code === "cancelled")
      )
        setError(safeError(cause));
    } finally {
      if (current === version.current) setBusy(false);
    }
  };
  const text = labels[result?.language ?? language];
  return (
    <section
      className="panel report-explanation"
      aria-labelledby="report-explanation-title"
    >
      <p className="eyebrow">STEP 4 · EXPLAIN REVIEWED MEASUREMENTS</p>
      <h2 id="report-explanation-title">AI-Assisted Report Explanation</h2>
      <p>
        Educational explanations generated from reviewed measurements and
        predefined medical information.
      </p>
      <p className="small">
        Offline templates · No language model used. Confirmation means
        transcription review, not clinical validation. Any edit, reset or
        confirmation change clears the previous explanation.
      </p>
      <div className="explanation-controls">
        <label htmlFor="report-language">
          Explanation language
          <select
            id="report-language"
            value={language}
            onChange={(event) => {
              const next = event.target.value as ReportLanguage;
              setLanguage(next);
              setResult(null);
              setError("");
              if (generated.current || busy) void generate(next);
            }}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button
          type="button"
          className="button primary"
          disabled={!measurements.length || busy}
          onClick={() => {
            void generate(language);
          }}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <MessageSquareText size={17} />
          )}
          {busy ? "Explaining reviewed measurements…" : "Explain My Report"}
        </button>
        {busy && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              version.current++;
              active.current?.abort();
              setBusy(false);
              setResult(null);
            }}
          >
            Cancel explanation
          </button>
        )}
      </div>
      <p className="small" role="status">
        {measurements.length
          ? `${measurements.length} of ${total} measurements reviewed. Unreviewed measurements will be excluded.`
          : "Confirm a transcription above to enable Explain My Report. Unreviewed measurements are excluded."}
      </p>
      {busy && (
        <p role="status">
          Generating educational explanations locally. No document is uploaded
          again.
        </p>
      )}
      {error && <ErrorMessage message={error} />}
      {result && (
        <div
          className="explanation-output"
          lang={result.language}
          dir={result.language === "ar" ? "rtl" : "ltr"}
        >
          <h3>{text.overview}</h3>
          <dl className="explanation-counts">
            {(
              [
                "reviewed",
                "within_reported_interval",
                "below_reported_interval",
                "above_reported_interval",
                "not_evaluated",
              ] as const
            ).map((key) => (
              <div key={key}>
                <dt>{text[key]}</dt>
                <dd>
                  <bdi dir="ltr">{result.counts[key]}</bdi>
                </dd>
              </div>
            ))}
          </dl>
          <h3>{text.summary}</h3>
          <p>{result.summary}</p>
          <h3>{text.measurements}</h3>
          <div className="explanation-card-grid">
            {result.measurement_explanations.map((row) => (
              <article className="explanation-card" key={row.measurement_id}>
                <h4>{row.name}</h4>
                <p className="explanation-value">
                  <bdi dir="ltr">
                    {row.value ?? text.uncertain} {row.unit ?? text.missing}
                  </bdi>
                </p>
                <p>
                  {text.interval}:{" "}
                  <bdi dir="ltr">
                    {row.reference_range
                      ? [
                          row.reference_range.lower === null
                            ? null
                            : `${row.reference_range.lower_inclusive ? ">=" : ">"} ${row.reference_range.lower}`,
                          row.reference_range.upper === null
                            ? null
                            : `${row.reference_range.upper_inclusive ? "<=" : "<"} ${row.reference_range.upper}`,
                        ]
                          .filter(Boolean)
                          .join(" ; ") +
                        " " +
                        (row.reference_range.unit ?? text.missing)
                      : text.missing}
                  </bdi>
                </p>
                <span className="tag neutral">{text[row.comparison]}</span>
                <p>{row.explanation}</p>
                <p className="small">
                  {row.user_corrected ? text.corrected : text.original}
                </p>
                <a
                  className="text-link source-measurement-link"
                  href={`#review-${row.measurement_id}`}
                >
                  {text.source}: <bdi dir="ltr">{row.measurement_id}</bdi>
                </a>
                <a
                  className="text-link"
                  href={row.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text.education}
                </a>
              </article>
            ))}
          </div>
          <h3>{text.questions}</h3>
          <ul>
            {result.questions_for_doctor.map((question) => (
              <li key={question.source_measurement_ids[0]}>
                {question.text}{" "}
                <a
                  className="text-link"
                  href={`#review-${question.source_measurement_ids[0]}`}
                >
                  <bdi dir="ltr">{question.source_measurement_ids[0]}</bdi>
                </a>
              </li>
            ))}
          </ul>
          <aside className="explanation-limitations">
            <h3>{text.limitations}</h3>
            <p>{result.disclaimer}</p>
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </aside>
        </div>
      )}
    </section>
  );
}
