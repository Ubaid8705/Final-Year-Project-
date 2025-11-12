import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import "./connections.css";

const FALLBACK_AVATAR_BASE = "https://api.dicebear.com/7.x/initials/svg?seed=";
const PAGE_LIMIT = 20;

const buildFallbackAvatar = (seed) => {
  const source = seed || "Reader";
  return `${FALLBACK_AVATAR_BASE}${encodeURIComponent(source)}`;
};

const formatCount = (value) => {
  const number = Number(value) || 0;
  if (number >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`;
  }
  if (number >= 1_000) {
    return `${(number / 1_000).toFixed(1)}K`;
  }
  return number.toString();
};

const resolvePronouns = (value) => {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).join("/");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

const ConnectionCard = ({ entry, currentUsername, onToggleFollow, busy }) => {
  if (!entry) {
    return null;
  }

  const {
    username,
    name,
    avatar,
    bio,
    pronouns,
    membershipStatus,
    isFollowedByViewer,
    followsViewer,
  } = entry;

  const displayName = name || username || "Reader";
  const profilePath = username ? `/u/${username}` : "/profile";
  const avatarUrl = avatar || buildFallbackAvatar(displayName);
  const pronounLabel = resolvePronouns(pronouns);
  const showFollowButton = Boolean(username) && username !== currentUsername;
  const isFollowing = Boolean(isFollowedByViewer);

  return (
    <li className="connections-item">
      <Link to={profilePath} className="connections-avatar" aria-label={`View ${displayName}'s profile`}>
        <img src={avatarUrl} alt="User avatar" />
      </Link>
      <div className="connections-item-body">
        <div className="connections-item-title">
          <Link to={profilePath} className="connections-item-name">
            {displayName}
          </Link>
          {pronounLabel && <span className="connections-item-pronouns">{pronounLabel}</span>}
        </div>
        {username && <p className="connections-item-handle">@{username}</p>}
        {bio && <p className="connections-item-bio">{bio}</p>}
        <div className="connections-item-meta">
          {membershipStatus && <span className="connections-tag">Member</span>}
          {followsViewer && <span className="connections-tag">Follows you</span>}
        </div>
      </div>
      {showFollowButton && (
        <button
          type="button"
          className={`connections-action-button${isFollowing ? " connections-action-button--ghost" : " connections-action-button--primary"}`}
          onClick={() => onToggleFollow(entry)}
          disabled={busy}
        >
          {busy ? "Updating…" : isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </li>
  );
};

const ConnectionsPage = ({ mode }) => {
  const listKey = mode === "followers" ? "followers" : "following";
  const title = mode === "followers" ? "Followers" : "Following";

  const { username: routeUsername } = useParams();
  const navigate = useNavigate();
  const { user: authUser, token, loading: authLoading } = useAuth();

  const viewingOwnList = !routeUsername || routeUsername === authUser?.username;
  const targetUsername = routeUsername || authUser?.username || "";
  const ownerProfilePath = viewingOwnList ? "/profile" : `/u/${routeUsername}`;

  const [connections, setConnections] = useState([]);
  const [targetProfile, setTargetProfile] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [busyMap, setBusyMap] = useState({});

  const ownerName = useMemo(() => {
    if (targetProfile?.name) {
      return targetProfile.name;
    }
    if (targetProfile?.username) {
      return targetProfile.username;
    }
    if (viewingOwnList && authUser?.name) {
      return authUser.name;
    }
    return viewingOwnList && authUser?.username ? authUser.username : "This writer";
  }, [authUser?.name, authUser?.username, targetProfile?.name, targetProfile?.username, viewingOwnList]);

  const ownerAvatar = useMemo(() => {
    if (targetProfile?.avatar) {
      return targetProfile.avatar;
    }
    if (viewingOwnList && authUser?.avatar) {
      return authUser.avatar;
    }
    return buildFallbackAvatar(ownerName);
  }, [authUser?.avatar, ownerName, targetProfile?.avatar, viewingOwnList]);

  const setEntryBusy = useCallback((entryId, value) => {
    setBusyMap((current) => {
      const next = { ...current };
      if (value) {
        next[entryId] = true;
      } else {
        delete next[entryId];
      }
      return next;
    });
  }, []);

  const fetchConnections = useCallback(
    async (pageToFetch = 1, { append = false } = {}) => {
      if (!targetUsername) {
        return;
      }

      if (pageToFetch === 1) {
        setLoading(true);
        setConnections([]);
        setPagination({ page: 0, total: 0, hasMore: false });
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const endpoint = `${API_BASE_URL}/api/users/${encodeURIComponent(targetUsername)}/${listKey}?page=${pageToFetch}&limit=${PAGE_LIMIT}`;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const response = await fetch(endpoint, { headers });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load connections.");
        }

        const list = Array.isArray(payload[listKey]) ? payload[listKey] : [];
        setConnections((current) => (append ? [...current, ...list] : list));
        setTargetProfile(payload.user || null);

        const reported = payload.pagination || {};
        const hasMore = Boolean(reported.hasMore);
        const total = typeof reported.total === "number" ? reported.total : undefined;

        setPagination((current) => ({
          page: pageToFetch,
          total:
            typeof total === "number"
              ? total
              : append
              ? current.total + list.length
              : list.length,
          hasMore,
        }));
      } catch (requestError) {
        setError(requestError.message || "Unable to load connections.");
        if (!append) {
          setConnections([]);
          setTargetProfile(null);
          setPagination({ page: 0, total: 0, hasMore: false });
        }
      } finally {
        if (pageToFetch === 1) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [listKey, targetUsername, token]
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!targetUsername) {
      setLoading(false);
      setError("We couldn't find that profile.");
      return;
    }
    fetchConnections(1, { append: false });
  }, [authLoading, fetchConnections, targetUsername]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !pagination.hasMore) {
      return;
    }
    fetchConnections(pagination.page + 1, { append: true });
  }, [fetchConnections, loadingMore, pagination.hasMore, pagination.page]);

  const handleFollowToggle = useCallback(
    async (entry) => {
      if (!entry?.username || !token) {
        setError("Sign in to manage follow actions.");
        return;
      }

      const entryId = entry.id || entry.username;
      const currentlyFollowing = Boolean(entry.isFollowedByViewer);
      const method = currentlyFollowing ? "DELETE" : "POST";

      setEntryBusy(entryId, true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(entry.username)}/follow`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to update follow state.");
        }

        const nextFollowing = Boolean(payload.isFollowing);

        setConnections((current) => {
          if (mode === "following" && viewingOwnList && !nextFollowing) {
            return current.filter((item) => (item.id || item.username) !== entryId);
          }
          return current.map((item) => {
            if ((item.id || item.username) !== entryId) {
              return item;
            }
            return {
              ...item,
              isFollowedByViewer: nextFollowing,
            };
          });
        });

        if (mode === "following" && viewingOwnList) {
          setPagination((current) => ({
            ...current,
            total: Math.max(0, current.total + (nextFollowing ? (currentlyFollowing ? 0 : 1) : -1)),
          }));
        }
      } catch (requestError) {
        setError(requestError.message || "Unable to update follow state.");
      } finally {
        setEntryBusy(entryId, false);
      }
    },
    [mode, setEntryBusy, token, viewingOwnList]
  );

  const goBackToProfile = useCallback(() => {
    if (viewingOwnList) {
      navigate("/profile", { replace: false });
    } else if (routeUsername) {
      navigate(`/u/${routeUsername}`, { replace: false });
    } else {
      navigate(-1);
    }
  }, [navigate, routeUsername, viewingOwnList]);

  const emptyMessage = useMemo(() => {
    if (loading) {
      return "";
    }
    if (mode === "followers") {
      return viewingOwnList
        ? "No one is following you yet. When someone follows you, they'll appear here."
        : `${ownerName} doesn't have any followers yet.`;
    }
    return viewingOwnList
      ? "You aren't following anyone yet. Explore stories and follow writers you enjoy."
      : `${ownerName} isn't following anyone yet.`;
  }, [loading, mode, ownerName, viewingOwnList]);

  return (
    <div className="connections-page">
      <header className="connections-header">
        <div className="connections-header-top">
          <button type="button" className="connections-back" onClick={goBackToProfile}>
            ← Back
          </button>
          <span className="connections-count">{formatCount(pagination.total)} {title.toLowerCase()}</span>
        </div>
        <div className="connections-owner">
          <Link to={ownerProfilePath} className="connections-owner-avatar" aria-label="View profile">
            <img src={ownerAvatar} alt="Profile avatar" />
          </Link>
          <div className="connections-owner-info">
            <h1>{title}</h1>
            <p>
              Showing {title.toLowerCase()} for <strong>{ownerName}</strong>.
            </p>
          </div>
        </div>
      </header>

      {error && !loading && (
        <div className="connections-status connections-status--error" role="alert">
          {error}
        </div>
      )}

      {loading && connections.length === 0 ? (
        <p className="connections-status" role="status">
          Loading {title.toLowerCase()}…
        </p>
      ) : connections.length > 0 ? (
        <ul className="connections-list">
          {connections.map((entry) => (
            <ConnectionCard
              key={entry.id || entry.username}
              entry={entry}
              currentUsername={authUser?.username}
              onToggleFollow={handleFollowToggle}
              busy={Boolean(busyMap[entry.id || entry.username])}
            />
          ))}
        </ul>
      ) : (
        <p className="connections-empty">{emptyMessage}</p>
      )}

      {pagination.hasMore && (
        <button
          type="button"
          className="connections-load-more"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
};

export const FollowersPage = () => <ConnectionsPage mode="followers" />;
export const FollowingPage = () => <ConnectionsPage mode="following" />;
