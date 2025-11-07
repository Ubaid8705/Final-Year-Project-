import React, { useMemo } from "react";
import "./post.css";

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

const Post = ({ post, variant = "default" }) => {
  const safePost = post || {};
  const author = safePost.author || {};

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

  const authorAvatar = useMemo(
    () => author.avatar || buildFallbackAvatar(displayAuthor),
    [author.avatar, displayAuthor]
  );

  return (
    <article className={classList("post-card", `post-card--${variant}`, hasImage ? "" : "post-card--no-image")}> 
      <div className="post-card__body">
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
          <div className="post-card__actions">
            <span className="post-card__action">&#9711;</span>
            <span className="post-card__action">&#43;</span>
            <span className="post-card__action">&#8942;</span>
          </div>
        </footer>
      </div>
      {hasImage && (
        <div className="post-card__media">
          <img src={coverImage} alt={displayTitle} loading="lazy" />
        </div>
      )}
    </article>
  );
};

export default Post;
