import React, { useCallback, useEffect, useRef, useState } from "react";
import Post from "./post";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";

const PAGE_SIZE = 10;

const getPostIdentifier = (item) => {
  if (!item) {
    return "";
  }

  if (item.id) {
    return item.id;
  }

  if (item._id) {
    try {
      return typeof item._id === "object" && item._id.toString ? item._id.toString() : String(item._id);
    } catch (error) {
      return String(item._id);
    }
  }

  if (item.slug) {
    return item.slug;
  }

  if (item.metadata?.id) {
    return item.metadata.id;
  }

  if (item.createdAt || item.publishedAt) {
    return `${item.title || "post"}-${item.createdAt || item.publishedAt}`;
  }

  if (item.title) {
    return item.title;
  }

  return "";
};

const getPostApiId = (item) => {
  if (!item) {
    return "";
  }

  const candidates = [item._id, item.id, item.metadata?.id];

  for (const value of candidates) {
    if (!value) {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "object" && typeof value.toString === "function") {
      const stringValue = value.toString();
      if (stringValue) {
        return stringValue;
      }
    }
  }

  return "";
};

const getPostDeletionTarget = (item) => {
  const id = getPostApiId(item);
  if (id) {
    return id;
  }

  if (item?.slug && typeof item.slug === "string") {
    return item.slug.trim();
  }

  return "";
};

const resolveScope = (selection) => {
  if (selection === "featured") {
    return "featured";
  }
  return "forYou";
};

const PostsFeed = ({ selection = "forYou" }) => {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);

  const currentPageRef = useRef(0);
  const loadingRef = useRef(false);
  const observer = useRef(null);
  const scope = resolveScope(selection);
  const handleActionFeedback = useCallback((message, type = "info") => {
    if (!message) {
      setFeedback(null);
      return;
    }
    setFeedback({ message, type });
  }, []);

  const loadPage = useCallback(
    async (pageToLoad) => {
      if (loadingRef.current) {
        return;
      }

      if (pageToLoad === 1) {
        currentPageRef.current = 0;
        setHasMore(true);
        setInitialized(false);
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", pageToLoad);
        params.set("limit", PAGE_SIZE);

        params.set("scope", scope);

        const response = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401 && scope === "featured") {
            throw new Error("Sign in to see stories from people you follow");
          }
          throw new Error(payload.error || "Failed to load stories");
        }

        const items = Array.isArray(payload?.items) ? payload.items : [];
        const limitFromResponse = Number(payload?.pagination?.limit) || PAGE_SIZE;
        const total = Number(payload?.pagination?.total);

        setPosts((current) => {
          const base = pageToLoad === 1 ? [] : [...current];
          const map = new Map();

          base.forEach((item, index) => {
            const keyCandidate = getPostIdentifier(item);
            const key = keyCandidate || `existing-${index}`;
            map.set(key, item);
          });

          let fallbackIndex = 0;
          items.forEach((item) => {
            const keyCandidate = getPostIdentifier(item);
            const key = keyCandidate || `incoming-${pageToLoad}-${fallbackIndex++}`;
            map.set(key, item);
          });

          return Array.from(map.values());
        });

        const reachedEnd =
          Number.isFinite(total) && total >= 0
            ? pageToLoad * limitFromResponse >= total
            : items.length < limitFromResponse;

        setHasMore(!reachedEnd);
        currentPageRef.current = pageToLoad;
        setInitialized(true);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          console.error(requestError);
          setError(requestError.message || "Unable to load stories");
        }

        if (pageToLoad === 1) {
          setHasMore(false);
          setInitialized(true);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [scope, token]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) {
      return;
    }

    const nextPage = currentPageRef.current + 1;
    if (nextPage <= currentPageRef.current) {
      return;
    }

    loadPage(nextPage);
  }, [hasMore, loadPage]);

  const handleToggleSave = useCallback(
    async (post) => {
      const postId = getPostApiId(post);

      if (!postId) {
        handleActionFeedback("Unable to identify this story.", "error");
        return { success: false };
      }

      if (!token) {
        handleActionFeedback("Sign in to save stories for later.", "error");
        return { success: false };
      }

      const isCurrentlySaved = savedPostIds.has(postId);
      const method = isCurrentlySaved ? "DELETE" : "POST";

      try {
        const response = await fetch(`${API_BASE_URL}/api/saved-posts/${postId}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Unable to update your reading list.");
        }

        setSavedPostIds((current) => {
          const next = new Set(current);
          if (isCurrentlySaved) {
            next.delete(postId);
          } else {
            next.add(postId);
          }
          return next;
        });

        handleActionFeedback(
          isCurrentlySaved ? "Removed from your reading list." : "Saved to your reading list.",
          "success"
        );

        return { success: true, saved: !isCurrentlySaved };
      } catch (requestError) {
        console.error(requestError);
        handleActionFeedback(
          requestError.message || "Unable to update your reading list.",
          "error"
        );
        return { success: false };
      }
    },
    [token, savedPostIds, handleActionFeedback]
  );

  const handleHidePost = useCallback(
    async (post) => {
      const postId = getPostApiId(post);

      if (!postId) {
        handleActionFeedback("Unable to identify this story.", "error");
        return { success: false };
      }

      if (!token) {
        handleActionFeedback("Sign in to tune your feed.", "error");
        return { success: false };
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/hidden-posts/${postId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Unable to update your feed preferences.");
        }

        setPosts((current) => current.filter((item) => getPostApiId(item) !== postId));
        handleActionFeedback("We'll show you fewer stories like this.", "success");

        if (hasMore && !loadingRef.current) {
          loadMore();
        }

        return { success: true };
      } catch (requestError) {
        console.error(requestError);
        handleActionFeedback(
          requestError.message || "Unable to update your feed preferences.",
          "error"
        );
        return { success: false };
      }
    },
    [token, hasMore, loadMore, handleActionFeedback]
  );

  const handleDeletePost = useCallback(
    async (post) => {
      const target = getPostDeletionTarget(post);

      if (!target) {
        const message = "Unable to identify this story.";
        handleActionFeedback(message, "error");
        return { success: false, error: message };
      }

      if (!token) {
        const message = "Sign in to manage your stories.";
        handleActionFeedback(message, "error");
        return { success: false, error: message };
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(target)}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to delete story.");
        }

        setPosts((current) => current.filter((item) => getPostDeletionTarget(item) !== target));
        setSavedPostIds((current) => {
          const next = new Set(current);
          next.delete(target);
          const canonicalId = getPostApiId(post);
          if (canonicalId && canonicalId !== target) {
            next.delete(canonicalId);
          }
          return next;
        });

        handleActionFeedback("Story deleted.", "success");

        if (hasMore && !loadingRef.current) {
          loadMore();
        }

        return { success: true };
      } catch (requestError) {
        console.error(requestError);
        const message = requestError.message || "Unable to delete story.";
        handleActionFeedback(message, "error");
        return { success: false, error: message };
      }
    },
    [token, handleActionFeedback, hasMore, loadMore]
  );

  useEffect(() => {
    if (!token) {
      setSavedPostIds(new Set());
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/saved-posts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to fetch saved stories");
        }

        const nextSet = new Set();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        items.forEach((entry) => {
          const postId = getPostApiId(entry?.post);
          if (postId) {
            nextSet.add(postId);
          }
        });

        if (!cancelled) {
          setSavedPostIds(nextSet);
        }
      } catch (requestError) {
        if (requestError.name === "AbortError" || cancelled) {
          return;
        }
        console.error(requestError);
        handleActionFeedback(requestError.message || "Unable to load saved stories.", "error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, handleActionFeedback]);

  useEffect(() => {
    loadPage(1);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [loadPage]);

  useEffect(() => {
    if (!feedback?.message) {
      return undefined;
    }

    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const sentinelRef = useCallback(
    (node) => {
      if (observer.current) {
        observer.current.disconnect();
      }

      if (!node || !hasMore) {
        return;
      }

      observer.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry || !entry.isIntersecting) {
            return;
          }

          if (loadingRef.current || !hasMore) {
            return;
          }

          loadMore();
        },
        {
          rootMargin: "200px 0px 0px 0px",
        }
      );

      observer.current.observe(node);
    },
    [hasMore, loadMore]
  );

  const showEndMessage = initialized && !loading && !hasMore && posts.length > 0;
  const showEmptyState = initialized && !loading && posts.length === 0;

  return (
    <div className="posts-feed">
      {error && (
        <p className="posts-status posts-status--error" role="alert">
          {error}
        </p>
      )}

      {feedback?.message && (
        <p
          className={`posts-status ${
            feedback.type === "error"
              ? "posts-status--error"
              : feedback.type === "success"
              ? "posts-status--success"
              : "posts-status--info"
          }`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}

      {posts.map((post, index) => {
        const key = getPostIdentifier(post) || `post-${index}`;
        const postId = getPostApiId(post);
        const saved = postId ? savedPostIds.has(postId) : false;

        return (
          <Post
            key={key}
            post={post}
            variant={selection === "featured" ? "featured" : "default"}
            isSaved={saved}
            onToggleSave={handleToggleSave}
            onShowLess={handleHidePost}
            onActionFeedback={handleActionFeedback}
            onDeletePost={handleDeletePost}
            canEdit
          />
        );
      })}

      {loading && (
        <p className="posts-status" aria-live="polite">
          Loading stories…
        </p>
      )}

      {showEmptyState && (
        <p className="posts-status" role="note">
          There are no stories to display yet. Check back soon!
        </p>
      )}

      {showEndMessage && (
        <p className="posts-status posts-status--end" role="note">
          You are all caught up for now.
        </p>
      )}

      <div ref={sentinelRef} className="posts-feed__sentinel" aria-hidden="true" />

      {!loading && hasMore && (
        <button
          type="button"
          className="posts-feed__load-more"
          onClick={loadMore}
          disabled={loading}
        >
          Load more stories
        </button>
      )}
    </div>
  );
};

export default PostsFeed;
