import React from 'react';
import { Link } from 'react-router-dom';
import './suggesstion.css';

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const Suggesstion = ({ user, stats, highlight }) => {
  if (!user) {
    return null;
  }

  const displayName = user.name || user.username || 'Anonymous';
  const avatar = user.avatar || buildFallbackAvatar(displayName);
  const profileLink = `/u/${user.username}`;
  const followerCount = stats?.followers ?? 0;
  const bio = user.bio || 'Premium member';
  const highlightTitle = highlight?.title;
  const highlightSlug = highlight?.slug;
  const highlightSubtitle = highlight?.subtitle;
  const highlightClaps = highlight?.clapCount ?? null;
  const highlightResponses = highlight?.responseCount ?? null;
  const hasHighlight = Boolean(highlightTitle && highlightSlug);
  const highlightLink = hasHighlight ? `/post/${highlightSlug}` : null;

  return (
    <Link to={profileLink} className="suggestion-post">
      <div className="suggestion-meta">
        <img
          src={avatar}
          alt={displayName}
          className="suggestion-logo"
        />
        <div className="suggestion-info">
          <span className="suggestion-author">{displayName}</span>
          <span className="suggestion-star" title="Premium member">&#10022;</span>
        </div>
      </div>
      <div className="suggestion-bio">
        {bio}
      </div>
      {hasHighlight && (
        <div className="suggestion-highlight">
          <Link
            to={highlightLink}
            className="suggestion-highlight__title"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {highlightTitle}
          </Link>
          {highlightSubtitle && (
            <div className="suggestion-highlight__subtitle">{highlightSubtitle}</div>
          )}
          <div className="suggestion-highlight__meta">
            {typeof highlightClaps === "number" && (
              <span>
                {highlightClaps.toLocaleString()} {highlightClaps === 1 ? "clap" : "claps"}
              </span>
            )}
            {typeof highlightResponses === "number" && highlightResponses > 0 && (
              <span>
                {highlightResponses.toLocaleString()} {highlightResponses === 1 ? "response" : "responses"}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="suggestion-footer">
        <span className="suggestion-followers">
          {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
        </span>
      </div>
    </Link>
  );
};

export default Suggesstion;