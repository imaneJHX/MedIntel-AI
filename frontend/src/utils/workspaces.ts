import {
  BookOpen,
  ChartNoAxesCombined,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  Info,
  LayoutDashboard,
  Microscope,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
export type WorkspaceId = "patient" | "doctor" | "research";
export const workspaces = {
  patient: {
    id: "patient",
    base: "/patient",
    title: "Patient Workspace",
    cardTitle: "Patient Portal",
    icon: HeartHandshake,
    description:
      "Understand medical terminology, explore educational health information, and prepare for future medical report analysis.",
    action: "Enter Patient Workspace",
    note: "Educational information only",
    nav: [
      { path: "/patient", label: "Overview", icon: LayoutDashboard },
      { path: "/patient/reports", label: "Report explorer", icon: FileText },
      { path: "/patient/learn", label: "Learn about health", icon: BookOpen },
      { path: "/patient/about", label: "Privacy & information", icon: Info },
    ],
  },
  doctor: {
    id: "doctor",
    base: "/doctor",
    title: "Doctor Workspace",
    cardTitle: "Clinical Workspace",
    icon: Stethoscope,
    description:
      "Explore structured demonstration cases, clinical variables, and research-oriented analysis tools.",
    action: "Enter Clinical Workspace",
    note: "Fabricated demonstration cases only",
    nav: [
      { path: "/doctor", label: "Overview", icon: LayoutDashboard },
      {
        path: "/doctor/cases",
        label: "Demonstration case",
        icon: ClipboardList,
      },
      {
        path: "/doctor/clinical-variables",
        label: "Clinical variables",
        icon: SlidersHorizontal,
      },
      {
        path: "/doctor/explainability",
        label: "Explainability",
        icon: ChartNoAxesCombined,
      },
      { path: "/doctor/about", label: "Scope & limitations", icon: Info },
    ],
  },
  research: {
    id: "research",
    base: "/research",
    title: "Researcher Workspace",
    cardTitle: "AI Research Lab",
    icon: Microscope,
    description:
      "Explore machine learning models, experimental evaluations, and explainable AI methods.",
    action: "Enter Research Lab",
    note: "Reproducible model exploration",
    nav: [
      { path: "/research", label: "Overview", icon: LayoutDashboard },
      {
        path: "/research/predict",
        label: "Heart prediction",
        icon: HeartPulse,
      },
      {
        path: "/research/models",
        label: "Model comparison",
        icon: ChartNoAxesCombined,
      },
      {
        path: "/research/experiments",
        label: "Experiments",
        icon: FlaskConical,
      },
      {
        path: "/research/explainability",
        label: "Explainability",
        icon: ChartNoAxesCombined,
      },
      {
        path: "/research/methodology",
        label: "Model information",
        icon: BookOpen,
      },
    ],
  },
} as const;
export function getWorkspace(pathname: string) {
  if (pathname === "/patient" || pathname.startsWith("/patient/"))
    return workspaces.patient;
  if (pathname === "/doctor" || pathname.startsWith("/doctor/"))
    return workspaces.doctor;
  return workspaces.research;
}
export const predictionPath = (pathname: string) =>
  getWorkspace(pathname).id === "doctor"
    ? "/doctor/cases"
    : "/research/predict";
export const explanationPath = (pathname: string) =>
  getWorkspace(pathname).id === "doctor"
    ? "/doctor/explainability"
    : "/research/explainability";
