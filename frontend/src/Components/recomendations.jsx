import React, { useMemo } from "react";
import "./recomendations.css";
import { useTopicPreferences } from "../hooks/useTopicPreferences";
import {
  RECOMMENDED_TOPICS,
  formatTopicLabel,
  normalizeTopicSlug,
} from "../resources/topics";

const Recomendations = () => {
  const {
    activeTopics,
    isTopicSelected,
    toggleTopic,
    updatingSlug,
    error,
  } = useTopicPreferences();

  const recommended = useMemo(() => {
    const curated = [];
    const pushUnique = (slug, label) => {
      const normalized = normalizeTopicSlug(slug);
      if (!normalized) {
        return;
      }
      if (curated.some((topic) => topic.slug === normalized)) {
        return;
      }
      curated.push({ slug: normalized, label: label || formatTopicLabel(normalized) });
    };

    activeTopics.forEach((topicSlug) => {
      pushUnique(topicSlug, formatTopicLabel(topicSlug));
    });

    RECOMMENDED_TOPICS.forEach((topic) => {
      pushUnique(topic.slug, topic.label);
    });

    return curated;
  }, [activeTopics]);

  return (
    <div className="recomendations-section">
      <div className="recomendations-title">Recommended topics</div>
      {error && <p className="recomendations-feedback" role="alert">{error}</p>}
      <div className="recomendations-list">
        {recommended.map((topic) => {
          const topicLabel = topic.label || formatTopicLabel(topic.slug);
          const topicSlug = topic.slug;
          const active = isTopicSelected(topicSlug);
          const busy = updatingSlug === topicSlug;

          return (
            <button
              key={topicSlug}
              type="button"
              className={`recomendation-chip${active ? " recomendation-chip--active" : ""}`}
              onClick={() => toggleTopic(topicSlug)}
              aria-pressed={active}
              disabled={busy}
            >
              {topicLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Recomendations;