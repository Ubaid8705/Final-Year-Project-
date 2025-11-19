import { useCallback, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import {
  DEFAULT_FEED_TOPICS,
  normalizeTopicSlug,
  sortTopicsAlphabetically,
} from "../resources/topics";

export const MAX_TOPIC_SELECTION = 12;

export const useTopicPreferences = () => {
  const { user, token, updateUser } = useAuth();
  const [updatingSlug, setUpdatingSlug] = useState("");
  const [error, setError] = useState("");

  const selectedTopics = useMemo(() => {
    if (!Array.isArray(user?.topics)) {
      return [];
    }

    return sortTopicsAlphabetically(user.topics);
  }, [user?.topics]);

  const activeTopics = useMemo(() => {
    if (selectedTopics.length > 0) {
      return selectedTopics;
    }

    return sortTopicsAlphabetically(DEFAULT_FEED_TOPICS);
  }, [selectedTopics]);

  const isTopicSelected = useCallback(
    (slug) => {
      const normalized = normalizeTopicSlug(slug);
      if (!normalized) {
        return false;
      }

      return selectedTopics.includes(normalized);
    },
    [selectedTopics]
  );

  const toggleTopic = useCallback(
    async (rawSlug) => {
      const normalized = normalizeTopicSlug(rawSlug);
      if (!normalized) {
        return false;
      }

      if (!token) {
        setError("Sign in to personalize your interests.");
        return false;
      }

      if (updatingSlug) {
        return false;
      }

      const currentTopics = Array.isArray(user?.topics) ? [...user.topics] : [];
      const alreadySelected = currentTopics.includes(normalized);

      if (!alreadySelected && currentTopics.length >= MAX_TOPIC_SELECTION) {
        setError(`You can follow up to ${MAX_TOPIC_SELECTION} topics.`);
        return false;
      }

      const nextTopics = alreadySelected
        ? currentTopics.filter((topic) => topic !== normalized)
        : [...currentTopics, normalized];

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

        return true;
      } catch (requestError) {
        setError(requestError?.message || "Unable to update topics");
        return false;
      } finally {
        setUpdatingSlug("");
      }
    },
    [token, updateUser, updatingSlug, user?.topics]
  );

  return {
    activeTopics,
    selectedTopics,
    isTopicSelected,
    toggleTopic,
    updatingSlug,
    error,
    setError,
    maxSelectableTopics: MAX_TOPIC_SELECTION,
  };
};
