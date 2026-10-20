/** Short educational summaries checked against linked NLM MedlinePlus pages, 2026-10-20. */
export const healthEducation = [
  {
    id: "hemoglobin",
    title: "Hemoglobin",
    subtitle: "An oxygen-carrying protein",
    description:
      "Hemoglobin is a protein inside red blood cells that transports oxygen around the body. A hemoglobin test measures how much is in a blood sample.",
    question:
      "What does this measurement mean in the context of my other results?",
    source: "https://medlineplus.gov/lab-tests/hemoglobin-test/",
  },
  {
    id: "glucose",
    title: "Blood glucose",
    subtitle: "Sugar measured in the blood",
    description:
      "Glucose is a sugar that the body uses for energy. A blood glucose test measures the amount in the blood; the type and timing of the test matter when discussing a result.",
    question:
      "Was this a fasting test, and how does that affect its interpretation?",
    source: "https://medlineplus.gov/lab-tests/blood-glucose-test/",
  },
  {
    id: "cholesterol",
    title: "Cholesterol",
    subtitle: "Different fats, different measurements",
    description:
      "A cholesterol test measures cholesterol and triglycerides in blood. A lipid panel can report several measurements, including LDL and HDL cholesterol.",
    question:
      "Which measurements are included in this report, and what context do they need?",
    source: "https://medlineplus.gov/lab-tests/cholesterol-levels/",
  },
  {
    id: "blood-pressure",
    title: "Blood pressure",
    subtitle: "Pressure within the arteries",
    description:
      "Blood pressure describes the force of blood against artery walls. The first number is pressure during a heartbeat; the second is pressure between beats.",
    question:
      "How and when was the measurement taken, and should it be discussed alongside other readings?",
    source: "https://medlineplus.gov/lab-tests/measuring-blood-pressure/",
  },
] as const;
