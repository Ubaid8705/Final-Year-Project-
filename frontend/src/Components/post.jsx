import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./post.css";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";

const BookmarkIcon = ({ active }) => (
  <svg
    className="post-card__action-icon"
    viewBox="0 0 24 24"
    role="presentation"
  >
    <path
      d="M6 3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-8-3.6L6 21V3z"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const MinusCircleIcon = () => (
  <svg className="post-card__action-icon" viewBox="0 0 24 24" role="presentation">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const EllipsisIcon = () => (
  <svg className="post-card__action-icon" viewBox="0 0 24 24" role="presentation">
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const FALLBACK_COVER_IMAGE =
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80";
const PREMIUM_BADGE = "\u2726"; // &#10022;
const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;
const formatPublishedDate = (value) => {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const pickSummary = (post = {}) => {
  const summaryFields = ["subtitle", "excerpt", "summary", "description", "bodyPreview"];
  for (const field of summaryFields) {
    if (typeof post[field] === "string" && post[field].trim().length > 0) {
      return post[field];
    }
  }
  return "This story is still being crafted.";
};

const classList = (...values) => values.filter(Boolean).join(" ");

const resolvePostId = (candidate = {}) => {
  const candidates = [candidate._id, candidate.id, candidate.metadata?.id];
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

const toComparableId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const stringValue = value.toString().trim();
    return stringValue ? stringValue : null;
  }

  if (typeof value === "object" && typeof value.toString === "function") {
    const stringValue = value.toString();
    if (stringValue && stringValue !== "[object Object]") {
      return stringValue.trim();
    }
  }

  return null;
};

const toComparableUsername = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

const Post = ({
  post,
  variant = "default",
  isSaved = false,
  onToggleSave,
  onShowLess,
  onActionFeedback,
  canEdit = false,
  onDeletePost,
}) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);

  const safePost = useMemo(() => post || {}, [post]);
  const author = useMemo(() => safePost.author || {}, [safePost]);

  const displayTitle = safePost.title || "Untitled story";
  const displaySummary = pickSummary(safePost);
  const displayAuthor = author.name || author.username || "Anonymous";
  const displayTag = Array.isArray(safePost.tags) && safePost.tags.length > 0 ? safePost.tags[0] : null;
  const coverImage = safePost.coverImage || safePost.image || FALLBACK_COVER_IMAGE;
  const publishedLabel = formatPublishedDate(safePost.publishedAt || safePost.createdAt);
  const readingTimeLabel = safePost.readingTime ? `${safePost.readingTime} min read` : null;
  const clapCount = safePost.clapCount ?? safePost.likes ?? 0;
  const responseCount = safePost.responseCount ?? safePost.comments ?? 0;
  const hasImage = Boolean(coverImage);
  const isPremiumAuthor = Boolean(author.isPremium);
  const postId = resolvePostId(safePost);
  const postSlug = safePost.slug || postId;
  const targetPath = postSlug ? `/post/${postSlug}` : "";

  const authorAvatar = useMemo(
    () => author.avatar || buildFallbackAvatar(displayAuthor),
    [author.avatar, displayAuthor]
  );

  const postUrl = useMemo(() => {
    if (!targetPath) {
      return "";
    }

    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${targetPath}`;
    }

    return targetPath;
  }, [targetPath]);

  const canNavigate = Boolean(targetPath);
  const viewerIsPremium = Boolean(user?.membershipStatus);

  const viewerOwnsPost = useMemo(() => {
    if (!user) {
      return false;
    }

    const viewerIds = [user.id, user._id, user.userId, user.uid]
      .map(toComparableId)
      .filter(Boolean);

    const authorIds = [safePost.authorId, author?.id, author?._id]
      .map(toComparableId)
      .filter(Boolean);

    if (viewerIds.length > 0 && authorIds.length > 0) {
      const matches = authorIds.some((id) => viewerIds.includes(id));
      if (matches) {
        return true;
      }
    }

    const viewerUsername =
      toComparableUsername(user.username) ||
      toComparableUsername(user.name) ||
      toComparableUsername(user.email);
    const authorUsername =
      toComparableUsername(author.username) ||
      toComparableUsername(author.name) ||
      toComparableUsername(author.email);

    if (viewerUsername && authorUsername && viewerUsername === authorUsername) {
      return true;
    }

    return false;
  }, [author, safePost, user]);

  const allowEdit = Boolean(canEdit || viewerOwnsPost);
  const isPremiumContent = Boolean(safePost.isPremiumContent);
  const isLockedForViewer = isPremiumContent && !viewerOwnsPost && !viewerIsPremium;
  const cardLabel = canNavigate
    ? isLockedForViewer
      ? `Unlock premium story ${displayTitle}`
      : `Open story ${displayTitle}`
    : undefined;

  const handleCardNavigate = useCallback(
    (event) => {
      if (!canNavigate) {
        return;
      }

      if (event?.defaultPrevented) {
        return;
      }

      if (typeof event?.button === "number" && event.button !== 0) {
        return;
      }

      setMenuOpen(false);

      if (isLockedForViewer) {
        navigate("/plans", {
          state: targetPath ? { from: targetPath } : undefined,
        });
        return;
      }

      if (event?.metaKey || event?.ctrlKey) {
        if (typeof window !== "undefined") {
          window.open(targetPath, "_blank", "noopener,noreferrer");
        } else {
          navigate(targetPath);
        }
        return;
      }

      navigate(targetPath);
    },
    [canNavigate, isLockedForViewer, navigate, targetPath]
  );

  const handleCardKeyDown = useCallback(
    (event) => {
      if (!canNavigate) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setMenuOpen(false);
        if (isLockedForViewer) {
          navigate("/plans", {
            state: targetPath ? { from: targetPath } : undefined,
          });
        } else {
          navigate(targetPath);
        }
      }
    },
    [canNavigate, isLockedForViewer, navigate, targetPath]
  );

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleSaveClick = useCallback(
    (event) => {
      event?.stopPropagation();

      if (!onToggleSave || saving) {
        return;
      }

      setSaving(true);
      Promise.resolve(onToggleSave(safePost))
        .catch(() => {})
        .finally(() => setSaving(false));
    },
    [onToggleSave, safePost, saving]
  );

  const handleShowLessClick = useCallback(
    (event) => {
      event?.stopPropagation();

      if (!onShowLess || hiding) {
        return;
      }

      setHiding(true);
      Promise.resolve(onShowLess(safePost))
        .catch(() => {})
        .finally(() => {
          setHiding(false);
          setMenuOpen(false);
        });
    },
    [onShowLess, safePost, hiding]
  );

  const handleCopyLink = useCallback(async (event) => {
    event?.stopPropagation();

    if (!postUrl) {
      onActionFeedback?.("Unable to copy link for this story.", "error");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postUrl);
      } else if (typeof document !== "undefined") {
        const temporary = document.createElement("textarea");
        temporary.value = postUrl;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "absolute";
        temporary.style.left = "-9999px";
        document.body.appendChild(temporary);
        temporary.select();
        document.execCommand("copy");
        document.body.removeChild(temporary);
      }

      onActionFeedback?.("Link copied to clipboard.", "success");
    } catch (error) {
      console.error(error);
      onActionFeedback?.("Unable to copy link for this story.", "error");
    } finally {
      setMenuOpen(false);
    }
  }, [postUrl, onActionFeedback]);

  const handleShare = useCallback(async (event) => {
    event?.stopPropagation();

    if (!postUrl) {
      onActionFeedback?.("Unable to share this story right now.", "error");
      setMenuOpen(false);
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: displayTitle,
          text: `${displayTitle} — ${displayAuthor}`,
          url: postUrl,
        });
        onActionFeedback?.("Story ready to share!", "info");
      } else {
        await handleCopyLink();
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      console.error(error);
      onActionFeedback?.("Unable to share this story right now.", "error");
    } finally {
      setMenuOpen(false);
    }
  }, [postUrl, displayTitle, displayAuthor, handleCopyLink, onActionFeedback]);

  const handleEditPost = useCallback(
    (event) => {
      event?.stopPropagation();
      event?.preventDefault();

      if (!allowEdit) {
        setMenuOpen(false);
        return;
      }

      if (!postId && !postSlug) {
        onActionFeedback?.("Unable to open this story for editing.", "error");
        setMenuOpen(false);
        return;
      }

      setMenuOpen(false);
      navigate("/write", {
        state: {
          mode: "edit",
          postId: postId || postSlug,
          postSlug,
        },
      });
    },
    [allowEdit, navigate, onActionFeedback, postId, postSlug]
  );

  const handleDeletePost = useCallback(
    (event) => {
      event?.stopPropagation();
      event?.preventDefault();

      if (deleting) {
        return;
      }

      if (!allowEdit) {
        setMenuOpen(false);
        return;
      }

      if (!postId && !postSlug) {
        onActionFeedback?.("Unable to identify this story for deletion.", "error");
        setMenuOpen(false);
        return;
      }

      const confirmed = typeof window !== "undefined" ? window.confirm("Delete this story?") : true;
      if (!confirmed) {
        return;
      }

      if (typeof onDeletePost !== "function") {
        onActionFeedback?.("Deletion is not available right now.", "error");
        setMenuOpen(false);
        return;
      }

      setDeleting(true);
      Promise.resolve(onDeletePost(safePost))
        .then((result) => {
          if (result && result.error) {
            onActionFeedback?.(result.error, "error");
          }
        })
        .catch((error) => {
          console.error(error);
          onActionFeedback?.("Unable to delete this story.", "error");
        })
        .finally(() => {
          setDeleting(false);
          setMenuOpen(false);
        });
    },
    [allowEdit, deleting, onActionFeedback, onDeletePost, postId, postSlug, safePost]
  );

  return (
    <article
      className={classList(
        "post-card",
        `post-card--${variant}`,
        hasImage ? "" : "post-card--no-image",
        canNavigate ? "post-card--interactive" : "",
        isLockedForViewer ? "post-card--locked" : ""
      )}
      onClick={canNavigate ? handleCardNavigate : undefined}
      onKeyDown={canNavigate ? handleCardKeyDown : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      role={canNavigate ? "link" : undefined}
      aria-label={cardLabel}
    >
      <div className="post-card__body">
        {isPremiumContent && (
          <div
            className={classList(
              "post-card__premium-chip",
              isLockedForViewer
                ? "post-card__premium-chip--locked"
                : "post-card__premium-chip--access"
            )}
          >
            <span className="post-card__premium-chip-icon" aria-hidden="true">
              {isLockedForViewer ? "🔒" : PREMIUM_BADGE}
            </span>
            <span>{isLockedForViewer ? "Premium — Upgrade to read" : "Premium story"}</span>
          </div>
        )}
        <header className="post-card__meta">
          <img src={authorAvatar} alt={displayAuthor} className="post-card__author" />
          <div className="post-card__byline">
            <span className="post-card__author-name">
              {isPremiumAuthor && (
                <span className="post-card__premium-star" aria-hidden="true">
                  {PREMIUM_BADGE}
                </span>
              )}
              {displayAuthor}
            </span>
            {displayTag && <span className="post-card__tag">in {displayTag}</span>}
          </div>
        </header>
        <h2 className="post-card__title">{displayTitle}</h2>
        <p className="post-card__summary">{displaySummary}</p>
        <footer className="post-card__footer">
          <div className="post-card__stats">
            <span className="post-card__stat post-card__stat--accent">
              {isPremiumAuthor && (
                <span className="post-card__premium-star" aria-hidden="true">
                  {PREMIUM_BADGE}
                </span>
              )}
              {publishedLabel}
            </span>
            {readingTimeLabel && <span className="post-card__stat">{readingTimeLabel}</span>}
            <span className="post-card__stat">&#128079; {clapCount}</span>
            <span className="post-card__stat">&#128172; {responseCount}</span>
          </div>
          <div className="post-card__actions" ref={menuRef}>
            <button
              type="button"
              className={classList(
                "post-card__action-btn",
                isSaved ? "post-card__action-btn--active" : ""
              )}
              onClick={handleSaveClick}
              aria-pressed={isSaved}
              disabled={saving}
              title={isSaved ? "Remove from reading list" : "Save to reading list"}
            >
              <BookmarkIcon active={isSaved} />
              <span className="post-card__action-text">{isSaved ? "Saved" : "Save"}</span>
            </button>
            <button
              type="button"
              className="post-card__action-btn"
              onClick={handleShowLessClick}
              disabled={hiding}
              title="Show fewer stories like this"
            >
              <MinusCircleIcon />
              <span className="post-card__action-text">Show less</span>
            </button>
            <div className="post-card__actions-overflow">
              <button
                type="button"
                className="post-card__action-btn post-card__action-btn--menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                title="More options"
              >
                <EllipsisIcon />
                <span className="sr-only">More options</span>
              </button>
              {menuOpen && (
                <ul
                  className="post-card__actions-menu"
                  role="menu"
                  onClick={(event) => event.stopPropagation()}
                >
                  {allowEdit && (
                    <>
                      <li role="presentation">
                        <button type="button" role="menuitem" onClick={handleEditPost}>
                          Edit story
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleDeletePost}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting…" : "Delete story"}
                        </button>
                      </li>
                      <li className="post-card__actions-menu-divider" role="separator" aria-hidden="true" />
                    </>
                  )}
                  <li role="presentation">
                    <button type="button" role="menuitem" onClick={handleCopyLink}>
                      Copy link
                    </button>
                  </li>
                  <li role="presentation">
                    <button type="button" role="menuitem" onClick={handleShare}>
                      Share story
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </footer>
      </div>
      {hasImage && (
        <div className="post-card__media">
          <img src={coverImage} alt={displayTitle} loading="lazy" />
          {isLockedForViewer && (
            <div className="post-card__media-lock" aria-hidden="true">
              🔒
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default Post;
