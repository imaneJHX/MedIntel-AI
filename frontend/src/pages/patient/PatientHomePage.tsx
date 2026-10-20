import { ArrowRight, BookOpen, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PatientSafetyNotice } from "../../components/patient/PatientSafetyNotice";
export function PatientHomePage() {
  return (
    <div className="page patient-page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            INFORMATION YOU CAN EXPLORE AT YOUR OWN PACE
          </p>
          <h1>Patient Health Information Portal</h1>
          <p>
            Explore medical information in clear language and prepare for
            conversations with healthcare professionals.
          </p>
        </div>
      </div>
      <section className="patient-welcome">
        <div>
          <span className="tag">WELCOME TO YOUR LEARNING SPACE</span>
          <h2>
            A little understanding.
            <br />A better conversation.
          </h2>
          <p>
            Start with familiar terms, learn what a measurement describes, and
            find useful questions to bring to your next conversation.
          </p>
          <Link to="/patient/learn" className="button primary">
            Explore health information
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="patient-welcome-note">
          <BookOpen size={35} />
          <strong>Learn with context</strong>
          <p>
            A single measurement does not tell the whole story. This space
            explains concepts without interpreting your personal results.
          </p>
        </div>
      </section>
      <div className="patient-actions">
        <article className="panel">
          <FileText size={24} className="teal" />
          <h2>Explore a synthetic report</h2>
          <p>
            Explore a synthetic report, review its extracted measurements and
            learn what the terms mean. Real patient documents are prohibited.
          </p>
          <Link to="/patient/reports" className="text-link">
            Explore synthetic reports
            <ArrowRight size={16} />
          </Link>
        </article>
        <article className="panel">
          <ShieldCheck size={24} className="teal" />
          <h2>Your information stays yours</h2>
          <p>
            No patient accounts or medical history are stored. Synthetic reports
            are processed temporarily by the local backend.
          </p>
          <Link to="/patient/about" className="text-link">
            Read the privacy notice
            <ArrowRight size={16} />
          </Link>
        </article>
      </div>
      <PatientSafetyNotice />
    </div>
  );
}
