import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import "./topics.css";
import { EXPLORE_TOPIC_SECTIONS, formatTopicLabel } from "../resources/topics";
import { useTopicPreferences } from "../hooks/useTopicPreferences";

const TopicsPage = () => {
  const {
    selectedTopics,
    isTopicSelected,
    toggleTopic,
    updatingSlug,
    error,
    setError,
    maxSelectableTopics,
  } = useTopicPreferences();

  const navigation = useMemo(
    () =>
      EXPLORE_TOPIC_SECTIONS.map((section) => ({
        id: section.id,
        title: section.title,
      })),
    []
  );

  const followedCount = selectedTopics.length;
  const remainingSlots = Math.max(maxSelectableTopics - followedCount, 0);

  return (
    <div className="topics-page">
      <header className="topics-hero">
        <Link to="/" className="topics-hero__back">
          ← Back to stories
        </Link>
        <h1 className="topics-hero__title">Explore topics</h1>
        <p className="topics-hero__subtitle">
          Discover new ideas to follow and tailor the stories you see across BlogsHive.
        </p>
        <p className="topics-hero__meta" role="status">
          <span>{followedCount} of {maxSelectableTopics} topics followed</span>
          <span>{remainingSlots} open {remainingSlots === 1 ? "spot" : "spots"} left</span>
        </p>
        {error && (
          <div className="topics-feedback" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="topics-feedback__close"
              onClick={() => setError("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}
      </header>

      <nav className="topics-nav" aria-label="Topic categories">
        <ul className="topics-nav__list">
          {navigation.map((item) => (
            <li key={item.id} className="topics-nav__item">
              <a className="topics-nav__link" href={`#topics-${item.id}`}>
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="topics-content">
        {EXPLORE_TOPIC_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={`topics-${section.id}`}
            className="topics-section"
            aria-labelledby={`topics-title-${section.id}`}
          >
            <div className="topics-section__header">
              <h2 id={`topics-title-${section.id}`} className="topics-section__title">
                {section.title}
              </h2>
              {section.description && (
                <p className="topics-section__description">{section.description}</p>
              )}
            </div>
            <div className="topics-section__grid">
              {section.topics.map((topic) => {
                const label = topic.label || formatTopicLabel(topic.slug);
                const description = topic.shortDescription || topic.description;
                const active = isTopicSelected(topic.slug);
                const busy = updatingSlug === topic.slug;

                return (
                  <article
                    key={`${section.id}-${topic.slug}`}
                    className={`topic-card${active ? " topic-card--active" : ""}`}
                  >
                    <div className="topic-card__body">
                      <h3 className="topic-card__title">{label}</h3>
                      {description && (
                        <p className="topic-card__description">{description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="topic-card__action"
                      onClick={() => toggleTopic(topic.slug)}
                      disabled={busy}
                      aria-pressed={active}
                    >
                      {busy ? "Saving…" : active ? "Following" : "Follow"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default TopicsPage;
