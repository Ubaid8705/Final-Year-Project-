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

const PostsFeed = () => {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const currentPageRef = useRef(0);
  const loadingRef = useRef(false);
  const observer = useRef(null);

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

        const response = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
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
    [token]
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

  useEffect(() => {
    loadPage(1);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [loadPage]);

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

      {posts.map((post, index) => (
        <Post key={getPostIdentifier(post) || `post-${index}`} post={post} />
      ))}

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
