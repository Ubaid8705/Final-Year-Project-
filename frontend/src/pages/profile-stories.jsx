import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Post from "../Components/post";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import "./profile-stories.css";

const PAGE_SIZE = 10;

const getDeletionTarget = (post) => {
  if (!post) {
    return "";
  }

  const candidates = [post._id, post.id, post.metadata?.id, post.slug];
  for (const value of candidates) {
    if (!value) {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "object" && typeof value.toString === "function") {
      const asString = value.toString();
      if (asString && asString !== "[object Object]") {
        return asString;
      }
    }
  }

  return "";
};

const ProfileStories = () => {
  const { user, token } = useAuth();
  const { username: routeUsername } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewingOwnProfile = !routeUsername || routeUsername === user?.username;
  const profileUsername = viewingOwnProfile ? user?.username : routeUsername;
  const canViewDrafts = viewingOwnProfile;

  const requestedTab = searchParams.get("tab");
  const normalizedTab = canViewDrafts && requestedTab === "drafts" ? "drafts" : "posts";
  const [activeTab, setActiveTab] = useState(normalizedTab);

  useEffect(() => {
    setActiveTab(normalizedTab);
  }, [normalizedTab]);

  const heading = viewingOwnProfile
    ? "Your stories"
    : profileUsername
    ? `${profileUsername}'s stories`
    : "Stories";
  const profileLink = viewingOwnProfile
    ? "/profile"
    : profileUsername
    ? `/u/${profileUsername}`
    : "/profile";

  const postsLoadingRef = useRef(false);
  const draftsLoadingRef = useRef(false);

  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(0);
  const [postsHasMore, setPostsHasMore] = useState(true);

  const [drafts, setDrafts] = useState([]);
  const [draftsError, setDraftsError] = useState(null);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsPage, setDraftsPage] = useState(0);
  const [draftsHasMore, setDraftsHasMore] = useState(true);

  const [feedback, setFeedback] = useState(null);

  const postsSentinelRef = useRef(null);
  const draftsSentinelRef = useRef(null);

  const handleActionFeedback = useCallback((message, type = "info") => {
    if (!message) {
      setFeedback(null);
      return;
    }
    setFeedback({ message, type });
  }, []);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const loadPostsPage = useCallback(
    async (pageToLoad = 1) => {
      if (!profileUsername || postsLoadingRef.current) {
        return;
      }

      postsLoadingRef.current = true;
      setPostsLoading(true);
      setPostsError(null);

      const params = new URLSearchParams();
      params.set("page", pageToLoad);
      params.set("limit", PAGE_SIZE.toString());

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/posts/author/${encodeURIComponent(profileUsername)}?${params.toString()}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : undefined,
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load stories");
        }

        const items = Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload.posts)
          ? payload.posts
          : [];

        setPosts((current) => (pageToLoad === 1 ? items : [...current, ...items]));

        const pagination = payload.pagination || {};
        const hasMore =
          typeof pagination.hasMore === "boolean"
            ? pagination.hasMore
            : items.length === PAGE_SIZE;
        setPostsHasMore(hasMore);
        setPostsPage(pageToLoad);
      } catch (error) {
        if (pageToLoad === 1) {
          setPosts([]);
        }
        setPostsError(error.message || "Failed to load stories");
        setPostsHasMore(false);
      } finally {
        postsLoadingRef.current = false;
        setPostsLoading(false);
      }
    },
    [profileUsername, token]
  );

  const loadDraftsPage = useCallback(
    async (pageToLoad = 1) => {
      if (!canViewDrafts || !token || draftsLoadingRef.current) {
        return;
      }

      draftsLoadingRef.current = true;
      setDraftsLoading(true);
      setDraftsError(null);

      const params = new URLSearchParams();
      params.set("page", pageToLoad);
      params.set("limit", PAGE_SIZE.toString());

      try {
        const response = await fetch(`${API_BASE_URL}/api/posts/drafts?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load drafts");
        }

        const items = Array.isArray(payload.items) ? payload.items : [];
        setDrafts((current) => (pageToLoad === 1 ? items : [...current, ...items]));

        const pagination = payload.pagination || {};
        const hasMore =
          typeof pagination.hasMore === "boolean"
            ? pagination.hasMore
            : items.length === PAGE_SIZE;
        setDraftsHasMore(hasMore);
        setDraftsPage(pageToLoad);
      } catch (error) {
        if (pageToLoad === 1) {
          setDrafts([]);
        }
        setDraftsError(error.message || "Failed to load drafts");
        setDraftsHasMore(false);
      } finally {
        draftsLoadingRef.current = false;
        setDraftsLoading(false);
      }
    },
    [canViewDrafts, token]
  );

  useEffect(() => {
    setPosts([]);
    setPostsPage(0);
    setPostsHasMore(true);
    setPostsError(null);
  }, [profileUsername]);

  useEffect(() => {
    setDrafts([]);
    setDraftsPage(0);
    setDraftsHasMore(true);
    setDraftsError(null);
  }, [canViewDrafts]);

  useEffect(() => {
    if (activeTab !== "posts") {
      return;
    }
    if (!profileUsername) {
      return;
    }
    if (postsPage === 0 && !postsLoadingRef.current && postsHasMore) {
      loadPostsPage(1);
    }
  }, [activeTab, profileUsername, postsPage, postsHasMore, loadPostsPage]);

  useEffect(() => {
    if (!canViewDrafts || activeTab !== "drafts") {
      return;
    }
    if (draftsPage === 0 && !draftsLoadingRef.current && draftsHasMore) {
      loadDraftsPage(1);
    }
  }, [activeTab, canViewDrafts, draftsPage, draftsHasMore, loadDraftsPage]);

  useEffect(() => {
    if (activeTab !== "posts" || !postsHasMore) {
      return undefined;
    }
    const sentinel = postsSentinelRef.current;
    if (!sentinel) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !postsLoadingRef.current) {
          loadPostsPage((postsPage || 0) + 1);
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, postsHasMore, postsPage, loadPostsPage]);

  useEffect(() => {
    if (activeTab !== "drafts" || !draftsHasMore) {
      return undefined;
    }
    const sentinel = draftsSentinelRef.current;
    if (!sentinel) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !draftsLoadingRef.current) {
          loadDraftsPage((draftsPage || 0) + 1);
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, draftsHasMore, draftsPage, loadDraftsPage]);

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) {
        return;
      }
      if (tab === "drafts" && !canViewDrafts) {
        return;
      }
      if (tab === "drafts") {
        setSearchParams({ tab: "drafts" });
      } else {
        setSearchParams({});
      }
      setActiveTab(tab);
    },
    [activeTab, canViewDrafts, setSearchParams]
  );

  const refreshVisibleTab = useCallback(() => {
    if (activeTab === "posts") {
      loadPostsPage(1);
    } else if (activeTab === "drafts") {
      loadDraftsPage(1);
    }
  }, [activeTab, loadDraftsPage, loadPostsPage]);

  const handleDeletePost = useCallback(
    async (post) => {
      const target = getDeletionTarget(post);
      if (!target) {
        handleActionFeedback("Unable to identify this story.", "error");
        return { success: false };
      }

      if (!token) {
        handleActionFeedback("Sign in to manage your stories.", "error");
        return { success: false };
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
          throw new Error(payload.error || "Unable to delete story.");
        }

        handleActionFeedback("Story deleted.", "success");
        setPosts((current) => current.filter((item) => getDeletionTarget(item) !== target));
        setDrafts((current) => current.filter((item) => getDeletionTarget(item) !== target));
        refreshVisibleTab();

        return { success: true };
      } catch (error) {
        handleActionFeedback(error.message || "Unable to delete story.", "error");
        return { success: false };
      }
    },
    [handleActionFeedback, refreshVisibleTab, token]
  );

  const postsEmptyMessage = viewingOwnProfile
    ? "Publish your first story to see it here."
    : "No public stories yet.";

  const draftsEmptyMessage = "Start a draft to keep your ideas close.";

  if (!profileUsername) {
    return (
      <div className="profile-stories-page">
        <p className="profile-stories-status">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="profile-stories-page">
      <header className="profile-stories-header">
        <div className="profile-stories-header__titles">
          <Link to={profileLink} className="profile-stories-back">
            ← Back to profile
          </Link>
          <h1 className="profile-stories-title">{heading}</h1>
        </div>
        <div className="profile-stories-tabs">
          <button
            type="button"
            className={`profile-stories-tab${activeTab === "posts" ? " profile-stories-tab--active" : ""}`}
            onClick={() => handleTabChange("posts")}
          >
            Stories
          </button>
          {canViewDrafts && (
            <button
              type="button"
              className={`profile-stories-tab${activeTab === "drafts" ? " profile-stories-tab--active" : ""}`}
              onClick={() => handleTabChange("drafts")}
            >
              Drafts
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <div
          className={`profile-stories-status profile-stories-status--${feedback.type === "error" ? "error" : "info"}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}

      <section className="profile-stories-feed" aria-live="polite">
        {activeTab === "posts" && (
          <>
            {postsLoading && posts.length === 0 && (
              <p className="profile-stories-status">Loading stories…</p>
            )}
            {postsError && !postsLoading && (
              <p className="profile-stories-status profile-stories-status--error">{postsError}</p>
            )}
            {!postsLoading && !postsError && posts.length === 0 && (
              <p className="profile-stories-status profile-stories-status--muted">{postsEmptyMessage}</p>
            )}
            {posts.map((post) => (
              <Post
                key={post.id || post.slug}
                post={post}
                variant="profile"
                canEdit={viewingOwnProfile}
                onActionFeedback={handleActionFeedback}
                onDeletePost={viewingOwnProfile ? handleDeletePost : undefined}
              />
            ))}
            {postsHasMore && (
              <p className="profile-stories-status profile-stories-status--muted" role="status">
                {postsLoading && posts.length > 0 ? "Loading more stories…" : "Scroll to load more stories."}
              </p>
            )}
            <div ref={postsSentinelRef} className="profile-stories-sentinel" aria-hidden="true" />
          </>
        )}

        {activeTab === "drafts" && canViewDrafts && (
          <>
            {draftsLoading && drafts.length === 0 && (
              <p className="profile-stories-status">Loading drafts…</p>
            )}
            {draftsError && !draftsLoading && (
              <p className="profile-stories-status profile-stories-status--error">{draftsError}</p>
            )}
            {!draftsLoading && !draftsError && drafts.length === 0 && (
              <p className="profile-stories-status profile-stories-status--muted">{draftsEmptyMessage}</p>
            )}
            {drafts.map((post) => (
              <Post
                key={post.id || post.slug || post.metadata?.id}
                post={post}
                variant="profile"
                canEdit
                onActionFeedback={handleActionFeedback}
                onDeletePost={handleDeletePost}
              />
            ))}
            {draftsHasMore && (
              <p className="profile-stories-status profile-stories-status--muted" role="status">
                {draftsLoading && drafts.length > 0 ? "Loading more drafts…" : "Scroll to load more drafts."}
              </p>
            )}
            <div ref={draftsSentinelRef} className="profile-stories-sentinel" aria-hidden="true" />
          </>
        )}
      </section>
    </div>
  );
};

export default ProfileStories;
