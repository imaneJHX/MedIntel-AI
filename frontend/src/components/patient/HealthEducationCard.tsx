import { ArrowUpRight, BookOpen } from "lucide-react";
import type { healthEducation } from "../../data/healthEducation";
export function HealthEducationCard({
  topic,
}: {
  topic: (typeof healthEducation)[number];
}) {
  return (
    <article className="panel education-card" id={topic.id}>
      <span className="topic-icon">
        <BookOpen size={21} />
      </span>
      <h2>{topic.title}</h2>
      <p className="topic-subtitle">{topic.subtitle}</p>
      <p>{topic.description}</p>
      <div className="conversation-prompt">
        <strong>A question you could ask</strong>
        <p>“{topic.question}”</p>
      </div>
      <a
        href={topic.source}
        target="_blank"
        rel="noreferrer"
        className="text-link"
      >
        Read about {topic.title.toLowerCase()} on MedlinePlus
        <ArrowUpRight size={14} />
      </a>
    </article>
  );
}
