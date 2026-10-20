import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ResearchProvider } from "./hooks/ResearchContext";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { PredictionPage } from "./pages/PredictionPage";
import { LoadingState } from "./components/ui/LoadingState";
import { ModelInfoPage } from "./pages/ModelInfoPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlatformLayout } from "./components/layout/PlatformLayout";
import { LandingPage } from "./pages/LandingPage";
import { PatientHomePage } from "./pages/patient/PatientHomePage";
import { PatientReportsPage } from "./pages/patient/PatientReportsPage";
import { PatientLearnPage } from "./pages/patient/PatientLearnPage";
import { PatientAboutPage } from "./pages/patient/PatientAboutPage";
import { DoctorHomePage } from "./pages/doctor/DoctorHomePage";
import { ClinicalVariablesPage } from "./pages/doctor/ClinicalVariablesPage";
import { DoctorAboutPage } from "./pages/doctor/DoctorAboutPage";
import { ResearchModelsPage } from "./pages/research/ResearchModelsPage";
import { ResearchExperimentsPage } from "./pages/research/ResearchExperimentsPage";
const ExplainabilityPage = lazy(() =>
  import("./pages/ExplainabilityPage").then((module) => ({
    default: module.ExplainabilityPage,
  })),
);
function AnalysisWorkspace() {
  return (
    <ResearchProvider>
      <Outlet />
    </ResearchProvider>
  );
}
function ExplanationRoute() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <LoadingState label="Loading explanation workspace…" />
        </div>
      }
    >
      <ExplainabilityPage />
    </Suspense>
  );
}
export function App() {
  return (
    <Routes>
      <Route element={<PlatformLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="patient" element={<AppLayout />}>
        <Route index element={<PatientHomePage />} />
        <Route path="reports" element={<PatientReportsPage />} />
        <Route path="learn" element={<PatientLearnPage />} />
        <Route path="about" element={<PatientAboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<AnalysisWorkspace />}>
        <Route path="doctor" element={<AppLayout />}>
          <Route index element={<DoctorHomePage />} />
          <Route path="cases" element={<PredictionPage clinical />} />
          <Route
            path="clinical-variables"
            element={<ClinicalVariablesPage />}
          />
          <Route path="explainability" element={<ExplanationRoute />} />
          <Route path="about" element={<DoctorAboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="research" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="predict" element={<PredictionPage />} />
          <Route path="models" element={<ResearchModelsPage />} />
          <Route path="experiments" element={<ResearchExperimentsPage />} />
          <Route path="explainability" element={<ExplanationRoute />} />
          <Route path="methodology" element={<ModelInfoPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route
        path="predict"
        element={<Navigate to="/research/predict" replace />}
      />
      <Route
        path="explainability"
        element={<Navigate to="/research/explainability" replace />}
      />
      <Route
        path="model"
        element={<Navigate to="/research/methodology" replace />}
      />
    </Routes>
  );
}
