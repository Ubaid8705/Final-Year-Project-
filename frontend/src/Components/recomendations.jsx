import React, { useCallback, useMemo, useState } from "react";
import "./recomendations.css";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import {
  DEFAULT_FEED_TOPICS,
  RECOMMENDED_TOPICS,
  formatTopicLabel,
  normalizeTopicSlug,
  sortTopicsAlphabetically,
} from "../resources/topics";

const MAX_TOPIC_SELECTION = 12;

const Recomendations = () => {
  const { user, token, updateUser } = useAuth();
  const [updatingSlug, setUpdatingSlug] = useState("");
  const [error, setError] = useState("");

  const activeTopics = useMemo(() => {
    if (Array.isArray(user?.topics) && user.topics.length > 0) {
      return sortTopicsAlphabetically(user.topics);
    }

    return sortTopicsAlphabetically(DEFAULT_FEED_TOPICS);
  }, [user?.topics]);

  const isTopicSelected = useCallback(
    (slug) => {
      if (!Array.isArray(user?.topics)) {
        return false;
      }
      const normalized = normalizeTopicSlug(slug);
      return normalized ? user.topics.includes(normalized) : false;
    },
    [user?.topics]
  );

  const handleToggle = useCallback(
    async (rawSlug) => {
      const normalized = normalizeTopicSlug(rawSlug);
      if (!normalized) {
        return;
      }

      if (!token) {
        setError("Sign in to personalize your interests.");
        return;
      }

      if (updatingSlug) {
        return;
      }

      const currentTopics = Array.isArray(user?.topics) ? [...user.topics] : [];
      const alreadySelected = currentTopics.includes(normalized);
      let nextTopics = currentTopics;

      if (alreadySelected) {
        nextTopics = currentTopics.filter((topic) => topic !== normalized);
      } else {
        if (currentTopics.length >= MAX_TOPIC_SELECTION) {
          setError(`You can follow up to ${MAX_TOPIC_SELECTION} topics.`);
          return;
        }
        nextTopics = [...currentTopics, normalized];
      }

      setUpdatingSlug(normalized);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/topics`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ topics: nextTopics }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to update topics");
        }

        if (payload?.user) {
          updateUser(payload.user);
        }
      } catch (requestError) {
        setError(requestError.message || "Unable to update topics");
      } finally {
        setUpdatingSlug("");
      }
    },
    [token, updateUser, updatingSlug, user?.topics]
  );

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
              onClick={() => handleToggle(topicSlug)}
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