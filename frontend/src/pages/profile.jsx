import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Post from "../Components/post";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import mediaService from "../services/mediaService";
import "./profile.css";

const COVER_FALLBACK =
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1440&q=80";
const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const OWN_PERMISSIONS = Object.freeze({
  canViewProfile: true,
  canViewPosts: true,
  canViewLists: true,
  reason: null,
});

const permissionMessages = {
  blocked: "You can't view this profile because this user has blocked you.",
  "self-blocked": "Unblock this user to browse their stories.",
  private: "Stories are only visible to followers.",
};

const formatNumber = (value) => {
  const number = Number(value) || 0;
  if (number >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`;
  }
  if (number >= 1_000) {
    return `${(number / 1_000).toFixed(1)}K`;
  }
  return number.toString();
};


const parsePronounsInput = (value) => {
  if (!value) {
    return [];
  }

  return value
    .replace(/\//g, ",")
    .replace(/\n/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s+/g, ""));
};

const normalizeTopicsInput = (value) => {
  if (!value) {
    return [];
  }

  return value
      .split(/[,\n]+/)
      .map((topic) => topic.trim().replace(/^#/, ""))
    .filter(Boolean);
};

const arraysEqual = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((entry, index) => entry === second[index]);
};

const Profile = () => {
  const { user: authUser, token, updateUser: updateStoredUser } = useAuth();
  const { username: routeUsername } = useParams();

  const viewingOwnProfile = !routeUsername || routeUsername === authUser?.username;
  const profileUsername = viewingOwnProfile ? authUser?.username : routeUsername;

  const [activeTab, setActiveTab] = useState("home");
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [relationship, setRelationship] = useState(null);
  const [permissions, setPermissions] = useState(viewingOwnProfile ? OWN_PERMISSIONS : null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedFetched, setSavedFetched] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [postsError, setPostsError] = useState(null);
  const [listsError, setListsError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    pronouns: "",
    topics: "",
    avatar: "",
  });
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const initializeEditForm = useCallback(() => {
    if (!viewingOwnProfile) {
      return;
    }

    const baseName = profile?.name || profile?.username || authUser?.name || authUser?.username || "";
    const baseAvatarSeed = baseName || profileUsername || authUser?.email || "Reader";
    setEditForm({
      name: profile?.name || baseName,
      bio: profile?.bio || "",
      pronouns:
        Array.isArray(profile?.pronouns) && profile.pronouns.length > 0
          ? profile.pronouns.join(" / ")
          : "",
      topics:
        Array.isArray(profile?.topics) && profile.topics.length > 0
          ? profile.topics.join(", ")
          : "",
      avatar: profile?.avatar || buildFallbackAvatar(baseAvatarSeed),
    });
  }, [authUser?.email, authUser?.name, authUser?.username, profile, profileUsername, viewingOwnProfile]);

  const handleCloseEditModal = useCallback(() => {
    if (editSaving) {
      return;
    }
    setEditModalOpen(false);
    setEditError(null);
  }, [editSaving]);

  const handleEditProfile = useCallback(() => {
    if (!viewingOwnProfile) {
      return;
    }
    initializeEditForm();
    setEditError(null);
    setEditModalOpen(true);
  }, [initializeEditForm, viewingOwnProfile]);

  const updateEditForm = useCallback((field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleAvatarUpload = useCallback(
    async (event) => {
      const file = event?.target?.files?.[0];
      if (!file) {
        return;
      }

      if (!token) {
        setEditError("Sign in again to update your profile picture.");
        return;
      }

      setAvatarUploading(true);
      setEditError(null);

      try {
        const asset = await mediaService.uploadImage({
          file,
          token,
          purpose: "avatar",
        });

        const nextUrl = asset?.secureUrl || asset?.displayUrl || asset?.originalUrl;
        if (!nextUrl) {
          throw new Error("Upload response did not include an image URL.");
        }

        updateEditForm("avatar", nextUrl);
      } catch (error) {
        setEditError(error.message || "Failed to upload avatar.");
      } finally {
        setAvatarUploading(false);
        if (event?.target) {
          // Reset the input so the same file can be re-selected if needed.
          event.target.value = "";
        }
      }
    },
    [token, updateEditForm]
  );

  const handleEditFieldChange = useCallback(
    (field) => (event) => {
      updateEditForm(field, event.target.value);
    },
    [updateEditForm]
  );

  useEffect(() => {
    if (viewingOwnProfile) {
      setPermissions(OWN_PERMISSIONS);
    }
  }, [viewingOwnProfile]);

  useEffect(() => {
    setActiveTab((current) => (!viewingOwnProfile && current === "lists" ? "home" : current));
  }, [viewingOwnProfile]);

  useEffect(() => {
    setPosts([]);
    setPostsError(null);
    setSavedPosts([]);
    setSavedFetched(false);
    setListsError(null);
    setRelationship(null);
    setFeedback(null);
  }, [profileUsername]);

  const normalizePermissions = useCallback(
    (payloadPermissions) => {
      if (viewingOwnProfile) {
        return OWN_PERMISSIONS;
      }
      if (!payloadPermissions) {
        return {
          canViewProfile: true,
          canViewPosts: true,
          canViewLists: false,
          reason: null,
        };
      }
      return payloadPermissions;
    },
    [viewingOwnProfile]
  );

  const fetchProfile = useCallback(async () => {
    if (!token || !profileUsername) {
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);

    const endpoint = viewingOwnProfile
      ? `${API_BASE_URL}/api/users/me`
      : `${API_BASE_URL}/api/users/${profileUsername}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load profile");
      }

      setProfile(payload.user || null);
      setStats(payload.stats || { followers: 0, following: 0 });
      setRelationship(viewingOwnProfile ? null : payload.relationship || null);
      setPermissions(normalizePermissions(payload.permissions));
    } catch (error) {
      setProfile(null);
      setProfileError(error.message || "Failed to load profile");
      setPermissions(normalizePermissions(null));
    } finally {
      setLoadingProfile(false);
    }
  }, [token, profileUsername, viewingOwnProfile, normalizePermissions]);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (viewingOwnProfile && !authUser?.username) {
      return;
    }
    if (!profileUsername) {
      return;
    }
    fetchProfile();
  }, [token, authUser?.username, profileUsername, viewingOwnProfile, fetchProfile]);

  const resolvedPermissions = useMemo(() => {
    if (viewingOwnProfile) {
      return OWN_PERMISSIONS;
    }
    return permissions || normalizePermissions(null);
  }, [permissions, normalizePermissions, viewingOwnProfile]);

  const fetchPosts = useCallback(async () => {
    if (!token || !profileUsername) {
      return;
    }

    setLoadingPosts(true);
    setPostsError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/author/${profileUsername}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load stories");
      }

      setPosts(Array.isArray(payload.posts) ? payload.posts : []);
    } catch (error) {
      setPosts([]);
      setPostsError(error.message || "Failed to load stories");
    } finally {
      setLoadingPosts(false);
    }
  }, [token, profileUsername]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }
    if (!resolvedPermissions?.canViewPosts) {
      const key = resolvedPermissions?.reason;
      setPosts([]);
      setPostsError(key ? permissionMessages[key] || "Stories are hidden." : "Stories are hidden.");
      setLoadingPosts(false);
      return;
    }
    fetchPosts();
  }, [resolvedPermissions, fetchPosts, loadingProfile]);

  const fetchSavedPosts = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingLists(true);
    setListsError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/saved-posts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load reading list");
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      setSavedPosts(items);
      setSavedFetched(true);
    } catch (error) {
      setSavedPosts([]);
      setListsError(error.message || "Failed to load reading list");
    } finally {
      setLoadingLists(false);
    }
  }, [token]);

  useEffect(() => {
    if (!viewingOwnProfile) {
      return;
    }
    if (activeTab !== "lists") {
      return;
    }
    if (savedFetched) {
      return;
    }
    fetchSavedPosts();
  }, [activeTab, viewingOwnProfile, savedFetched, fetchSavedPosts]);

  const handleRetryProfile = useCallback(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleShareProfile = useCallback(async () => {
    const targetUsername = viewingOwnProfile ? authUser?.username : profileUsername;
    if (!targetUsername) {
      return;
    }
    const url = `${window.location.origin}${viewingOwnProfile ? "/profile" : `/u/${targetUsername}`}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setFeedback({ type: "success", message: "Profile link copied." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to copy link." });
    }
  }, [authUser?.username, profileUsername, viewingOwnProfile]);

  const handleEditSubmit = useCallback(
    async (event) => {
      if (event) {
        event.preventDefault();
      }

      if (!viewingOwnProfile || !profile) {
        return;
      }

      const nextName = (editForm.name || "").trim();
      if (!nextName) {
        setEditError("Your display name is required.");
        return;
      }

      const nextBio = (editForm.bio || "").trim();
      const parsedPronouns = parsePronounsInput(editForm.pronouns).slice(0, 4);

      if (parsedPronouns.some((value) => value.length > 4)) {
        setEditError("Pronouns must be 4 characters or fewer each (e.g. she/her).");
        return;
      }

      const nextTopics = normalizeTopicsInput(editForm.topics).slice(0, 12);
      const nextAvatar = (editForm.avatar || "").trim();

      const normalizedPronouns = parsedPronouns.map((value) => value.toLowerCase());

      const currentPronouns = Array.isArray(profile?.pronouns)
        ? profile.pronouns.map((value) => (value || "").toLowerCase())
        : [];
      const currentTopics = Array.isArray(profile?.topics) ? profile.topics : [];

      const payload = {};

      if (nextName !== (profile?.name || "")) {
        payload.name = nextName;
      }

      if (nextBio !== (profile?.bio || "")) {
        payload.bio = nextBio;
      }

      if (!arraysEqual(normalizedPronouns, currentPronouns)) {
        payload.pronouns = parsedPronouns;
      }

      if (!arraysEqual(nextTopics, currentTopics)) {
        payload.topics = nextTopics;
      }

      if (nextAvatar && nextAvatar !== (profile?.avatar || "")) {
        payload.avatar = nextAvatar;
      }

      if (Object.keys(payload).length === 0) {
        handleCloseEditModal();
        return;
      }

      setEditSaving(true);
      setEditError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/update`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to update profile.");
        }

        if (data.user) {
          setProfile(data.user);
          if (typeof updateStoredUser === "function") {
            updateStoredUser(data.user);
          }
        } else {
          await fetchProfile();
        }

        setFeedback({ type: "success", message: "Profile updated." });
        handleCloseEditModal();
      } catch (error) {
        setEditError(error.message || "Failed to update profile.");
      } finally {
        setEditSaving(false);
      }
    },
    [editForm, fetchProfile, handleCloseEditModal, profile, token, updateStoredUser, viewingOwnProfile]
  );

  const handleFollowToggle = useCallback(async () => {
    if (viewingOwnProfile || !profileUsername) {
      return;
    }
    const currentlyFollowing = Boolean(relationship?.isFollowing);
    const method = currentlyFollowing ? "DELETE" : "POST";

    setActionLoading("follow");
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${profileUsername}/follow`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update follow state");
      }

      setRelationship((current) => ({
        ...(current || {}),
        isFollowing: payload.isFollowing,
        hasBlockedYou: current?.hasBlockedYou || false,
      }));

      if (payload.stats) {
        setStats(payload.stats);
      }

      if (payload.isFollowing && resolvedPermissions?.reason === "private") {
        setPermissions((current) => ({
          ...(current || {}),
          canViewPosts: true,
          reason: null,
        }));
        fetchPosts();
      }

      setFeedback({
        type: "success",
        message: payload.isFollowing ? "You're now following this writer." : "Unfollowed successfully.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to update follow state." });
    } finally {
      setActionLoading(null);
    }
  }, [viewingOwnProfile, profileUsername, relationship, token, resolvedPermissions, fetchPosts]);

  const handleBlockToggle = useCallback(async () => {
    if (viewingOwnProfile || !profileUsername) {
      return;
    }

    const currentlyBlocked = Boolean(relationship?.isBlocked);
    const method = currentlyBlocked ? "DELETE" : "POST";

    setActionLoading("block");
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${profileUsername}/block`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update block state");
      }

      const nextBlocked = payload.status === "blocked";

      setRelationship((current) => ({
        ...(current || {}),
        isBlocked: nextBlocked,
        isFollowing: nextBlocked ? false : current?.isFollowing,
      }));

      if (nextBlocked) {
        setPermissions({
          canViewProfile: true,
          canViewPosts: false,
          canViewLists: false,
          reason: "self-blocked",
        });
        setPosts([]);
        setPostsError(permissionMessages["self-blocked"]);
      } else {
        fetchProfile();
      }

      setFeedback({
        type: "success",
        message: nextBlocked ? "User blocked." : "User unblocked.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to update block state." });
    } finally {
      setActionLoading(null);
    }
  }, [viewingOwnProfile, profileUsername, relationship, token, fetchProfile]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!editModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCloseEditModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editModalOpen, handleCloseEditModal]);

  const displayName = profile?.name || profile?.username || (viewingOwnProfile ? "Your profile" : "BlogsHive reader");
  const pronouns = Array.isArray(profile?.pronouns) && profile.pronouns.length > 0 ? profile.pronouns.join("/") : "—";

  const bio = profile?.bio || (viewingOwnProfile ? "Use this space to tell readers what you write about." : "This writer hasn't added a bio yet.");
  const avatar = profile?.avatar || buildFallbackAvatar(displayName);
  const coverImage = profile?.coverImage || COVER_FALLBACK;
  const topics = Array.isArray(profile?.topics) ? profile.topics : [];
  const joinedAt = profile?.createdAt ? new Date(profile.createdAt) : null;

  const followerCount = stats?.followers ?? 0;
  const followingCount = stats?.following ?? 0;

  const tabs = useMemo(() => {
    const base = [{ id: "home", label: viewingOwnProfile ? "Home" : "Stories" }];
    if (viewingOwnProfile) {
      base.push({ id: "lists", label: "Reading list" });
    }
    base.push({ id: "about", label: "About" });
    return base;
  }, [viewingOwnProfile]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  if (loadingProfile) {
    return (
      <div className="profile-page">
        <p className="profile-status" role="status">
          Loading profile…
        </p>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="profile-page">
        <div className="profile-status profile-status--error" role="alert">
          <p>{profileError}</p>
          <button type="button" className="profile-button primary" onClick={handleRetryProfile}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const blockedByUser = resolvedPermissions.reason === "blocked";
  const viewerBlockedUser = resolvedPermissions.reason === "self-blocked" || relationship?.isBlocked;
  const privateProfile = resolvedPermissions.reason === "private";

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <img src={coverImage} alt="Profile banner" />
        <div className="profile-hero__overlay" />
      </div>
      <div className="profile-shell">
        <main className="profile-main">
          <section className="profile-header-card">
            <div className="profile-header-card__grid">
              <div className="profile-header-card__primary">
                <h1>{displayName}</h1>
                <p className="profile-header-card__intro">{bio}</p>
                <div className="profile-header-card__meta">
                  <span>{pronouns}</span>
                  <span>
                    <strong>{formatNumber(followerCount)}</strong> follower{followerCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    <strong>{formatNumber(followingCount)}</strong> following
                  </span>
                  {joinedAt && <span>Joined {joinedAt.toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="profile-header-card__actions">
                {viewingOwnProfile ? (
                  <>
                    <button type="button" className="profile-button primary" onClick={handleEditProfile}>
                      Edit profile
                    </button>
                    <button type="button" className="profile-button ghost" onClick={handleShareProfile}>
                      Share profile
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="profile-button primary"
                      disabled={Boolean(actionLoading) || blockedByUser}
                      onClick={handleFollowToggle}
                    >
                      {relationship?.isFollowing ? "Following" : "Follow"}
                    </button>
                    <button
                      type="button"
                      className="profile-button ghost"
                      disabled={Boolean(actionLoading)}
                      onClick={handleBlockToggle}
                    >
                      {relationship?.isBlocked ? "Unblock" : "Block"}
                    </button>
                    <button type="button" className="profile-button ghost" onClick={handleShareProfile}>
                      Share profile
                    </button>
                  </>
                )}
              </div>
            </div>
            <nav className="profile-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`profile-tab${activeTab === tab.id ? " profile-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            {feedback && (
              <div
                className={`profile-status profile-status--${feedback.type === "error" ? "error" : "info"}`}
                role={feedback.type === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </div>
            )}
            {blockedByUser && (
              <div className="profile-status profile-status--warning" role="alert">
                {permissionMessages.blocked}
              </div>
            )}
            {viewerBlockedUser && !blockedByUser && (
              <div className="profile-status profile-status--warning" role="status">
                {permissionMessages["self-blocked"]}
              </div>
            )}
            {privateProfile && !viewingOwnProfile && !blockedByUser && !viewerBlockedUser && (
              <div className="profile-status profile-status--info" role="status">
                {permissionMessages.private}
              </div>
            )}
          </section>

          <section className="profile-feed" aria-live="polite">
            {activeTab === "home" && (
              <>
                {loadingPosts && <p className="profile-status">Loading stories…</p>}
                {postsError && !loadingPosts && (
                  <p className="profile-status profile-status--muted">{postsError}</p>
                )}
                {!loadingPosts && !postsError && posts.length === 0 && (
                  <p className="profile-status profile-status--muted">
                    {viewingOwnProfile
                      ? "Publish your first story to see it here."
                      : "No public stories yet."}
                  </p>
                )}
                {posts.map((post) => (
                  <Post key={post.id || post.slug} post={post} variant="profile" />
                ))}
              </>
            )}

            {activeTab === "lists" && viewingOwnProfile && (
              <>
                {loadingLists && <p className="profile-status">Loading saved stories…</p>}
                {listsError && !loadingLists && (
                  <p className="profile-status profile-status--error">{listsError}</p>
                )}
                {!loadingLists && !listsError && savedPosts.length === 0 && (
                  <p className="profile-status profile-status--muted">
                    Save stories from around BlogsHive to build your reading list.
                  </p>
                )}
                {savedPosts.map((item) => (
                  <Post
                    key={item.id || item.post?.id}
                    post={item.post}
                    variant="profile"
                    isSaved
                  />
                ))}
              </>
            )}

            {activeTab === "about" && (
              <div className="profile-about">
                <section>
                  <h3>About</h3>
                  <p>{bio}</p>
                </section>
                <section>
                  <h3>Pronouns</h3>
                  <p>{pronouns}</p>
                </section>
                <section>
                  <h3>Topics</h3>
                  {topics.length > 0 ? (
                    <div className="profile-topics">
                      {topics.map((topic) => (
                        <span key={topic}>#{topic}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="profile-status profile-status--muted">
                      {viewingOwnProfile ? "Add topics you frequently cover." : "No topics shared yet."}
                    </p>
                  )}
                </section>
              </div>
            )}
          </section>
        </main>

        <aside className="profile-aside">
          <div className="profile-card">
            <img src={avatar} alt={displayName} className="profile-card__avatar" />
            <div className="profile-card__details">
              <h2>{displayName}</h2>
              <p className="profile-card__role">{pronouns}</p>
              <p className="profile-card__bio">{bio}</p>
            </div>
            {viewingOwnProfile ? (
              <button type="button" className="profile-button full" onClick={handleEditProfile}>
                Edit profile
              </button>
            ) : (
              <button type="button" className="profile-button ghost full" onClick={handleShareProfile}>
                Share profile
              </button>
            )}
          </div>

          <div className="profile-links">
            {["Help", "About", "Blog", "Privacy", "Terms", "Text to speech"].map((link) => (
              <button key={link} type="button">
                {link}
              </button>
            ))}
          </div>
        </aside>
      </div>
      {editModalOpen && viewingOwnProfile && (
        <div
          className="profile-edit-modal"
          role="presentation"
          onClick={handleCloseEditModal}
        >
          <form
            className="profile-edit-modal__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-edit-heading"
            onSubmit={handleEditSubmit}
          >
            <header className="profile-edit-modal__header">
              <div>
                <h3 id="profile-edit-heading">Edit your profile</h3>
                <p>Update how readers see you across BlogsHive.</p>
              </div>
              <button
                type="button"
                className="profile-edit-modal__close"
                onClick={handleCloseEditModal}
                aria-label="Close edit profile"
              >
                ×
              </button>
            </header>
            <div className="profile-edit-modal__body">
              {editError && (
                <div className="profile-edit-modal__error" role="alert">
                  {editError}
                </div>
              )}
              <div className="profile-edit-modal__grid">
                <div className="profile-edit-modal__avatar">
                  <img src={editForm.avatar || avatar} alt="Profile preview" />
                  <label className="profile-edit-modal__upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={avatarUploading || editSaving}
                    />
                    {avatarUploading ? "Uploading…" : "Change photo"}
                  </label>
                </div>
                <div className="profile-edit-modal__fields">
                  <label className="profile-edit-modal__field">
                    <span className="profile-edit-modal__label">Display name</span>
                    <input
                      type="text"
                      className="profile-edit-modal__input"
                      value={editForm.name}
                      onChange={handleEditFieldChange("name")}
                      maxLength={60}
                      disabled={editSaving}
                      required
                    />
                  </label>
                  <label className="profile-edit-modal__field">
                    <span className="profile-edit-modal__label">Pronouns</span>
                    <input
                      type="text"
                      className="profile-edit-modal__input"
                      placeholder="she / her"
                      value={editForm.pronouns}
                      onChange={handleEditFieldChange("pronouns")}
                      maxLength={24}
                      disabled={editSaving}
                    />
                    <span className="profile-edit-modal__help">Separate with "/" or commas. Four characters max each.</span>
                  </label>
                  <label className="profile-edit-modal__field">
                    <span className="profile-edit-modal__label">Bio</span>
                    <textarea
                      className="profile-edit-modal__textarea"
                      rows={4}
                      maxLength={240}
                      value={editForm.bio}
                      onChange={handleEditFieldChange("bio")}
                      disabled={editSaving}
                    ></textarea>
                    <span className="profile-edit-modal__help">Share what you publish or what readers can expect.</span>
                  </label>
                  <label className="profile-edit-modal__field">
                    <span className="profile-edit-modal__label">Topics</span>
                    <input
                      type="text"
                      className="profile-edit-modal__input"
                      placeholder="productivity, startups, design"
                      value={editForm.topics}
                      onChange={handleEditFieldChange("topics")}
                      maxLength={160}
                      disabled={editSaving}
                    />
                    <span className="profile-edit-modal__help">Add up to 12 topics separated by commas.</span>
                  </label>
                </div>
              </div>
            </div>
            <footer className="profile-edit-modal__actions">
              <button
                type="button"
                className="profile-edit-modal__button profile-edit-modal__button--ghost"
                onClick={handleCloseEditModal}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="profile-edit-modal__button profile-edit-modal__button--primary"
                disabled={editSaving || avatarUploading}
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
