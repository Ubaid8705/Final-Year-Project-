import React from 'react';
import { Link } from 'react-router-dom';
import './followsuggestions.css';

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const FollowSuggestions = ({ loading, suggestions, onRetry, onFollowToggle, pendingMap }) => {
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;

  return (
    <div className="follow-section">
      <div className="follow-title">Recommended for you</div>
      {loading ? (
        <div className="follow-loading">Finding writers tailored to your interests…</div>
      ) : hasSuggestions ? (
        <ul className="follow-list">
          {suggestions.map((entry) => {
            const { user, sharedTopics = [], isFollowing } = entry || {};
            if (!user) {
              return null;
            }

            const displayName = user.name || user.username || 'BlogsHive reader';
            const avatar = user.avatar || buildFallbackAvatar(displayName);
            const profileLink = user.username ? `/u/${user.username}` : '#';
            const suggestionKey = user.id || user._id || user.username;
            const isPending = Boolean(suggestionKey && pendingMap && pendingMap[suggestionKey]);
            const sharedTopicsLabel = sharedTopics.length
              ? sharedTopics
                  .map((topic) => `#${topic}`)
                  .slice(0, 3)
                  .join(' · ')
              : null;
            const buttonDisabled = isFollowing || isPending;
            const buttonLabel = isPending
              ? isFollowing
                ? 'Updating…'
                : 'Following…'
              : isFollowing
              ? 'Following'
              : 'Follow';
            const handleFollowClick = () => {
              if (typeof onFollowToggle === 'function' && !isFollowing && !isPending) {
                onFollowToggle(user, { isFollowing, entry });
              }
            };
            const buttonClassNames = [
              'follow-btn',
              isFollowing ? 'follow-btn--following' : '',
              isPending ? 'follow-btn--loading' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li key={suggestionKey || user.id} className="follow-item">
                <Link to={profileLink} className="follow-avatar-link">
                  <img src={avatar} alt={displayName} className="follow-avatar" />
                </Link>
                <div className="follow-item__body">
                  <div className="follow-details">
                    <Link to={profileLink} className="follow-name">
                      {displayName}
                    </Link>
                    {sharedTopicsLabel && (
                      <div
                        className="follow-info"
                        title={`Shared interests: ${sharedTopics.join(', ')}`}
                      >
                        {sharedTopicsLabel}
                      </div>
                    )}
                    {entry.stats?.followers != null && (
                      <div className="follow-desc">
                        {entry.stats.followers.toLocaleString()} followers
                      </div>
                    )}
                  </div>
                  <div className="follow-actions">
                    <button
                      className={buttonClassNames}
                      type="button"
                      disabled={buttonDisabled}
                      onClick={handleFollowClick}
                      aria-busy={isPending ? 'true' : undefined}
                    >
                      {buttonLabel}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="follow-empty">
          We couldn’t find personalized suggestions yet.
          {typeof onRetry === 'function' && (
            <button type="button" className="follow-retry" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FollowSuggestions;