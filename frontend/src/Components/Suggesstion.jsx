import React from 'react';
import { Link } from 'react-router-dom';
import './suggesstion.css';

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const Suggesstion = ({ user, stats }) => {
  if (!user) {
    return null;
  }

  const displayName = user.name || user.username || 'Anonymous';
  const avatar = user.avatar || buildFallbackAvatar(displayName);
  const profileLink = `/u/${user.username}`;
  const followerCount = stats?.followers ?? 0;
  const bio = user.bio || 'Premium member';

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
      <div className="suggestion-footer">
        <span className="suggestion-followers">
          {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
        </span>
      </div>
    </Link>
  );
};

export default Suggesstion;