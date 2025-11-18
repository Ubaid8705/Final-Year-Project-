import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Post from "../Components/post";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import mediaService from "../services/mediaService";
import "./profile.css";

const COVER_FALLBACK =
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1440&q=80";
const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const sanitizeUrlCandidate = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const resolveCoverDetails = (cover) => {
  if (!cover) {
    return { url: null, placeholder: null, publicId: null };
  }

  if (typeof cover === "string") {
    const url = sanitizeUrlCandidate(cover);
    return { url, placeholder: null, publicId: null };
  }

  if (typeof cover === "object") {
    const url = [cover.secureUrl, cover.url, cover.originalUrl, cover.thumbnailUrl]
      .map(sanitizeUrlCandidate)
      .find(Boolean) || null;

    return {
      url,
      placeholder: sanitizeUrlCandidate(cover.placeholderUrl),
      publicId: sanitizeUrlCandidate(cover.publicId),
    };
  }

  return { url: null, placeholder: null, publicId: null };
};

const buildCoverUpdatePayload = (asset) => {
  if (!asset || typeof asset !== "object") {
    return null;
  }

  const displayUrl = sanitizeUrlCandidate(asset.displayUrl || asset.url);
  const secureUrl = sanitizeUrlCandidate(asset.secureUrl);
  const originalUrl = sanitizeUrlCandidate(asset.originalUrl);
  const thumbnailUrl = sanitizeUrlCandidate(asset.thumbnailUrl);
  const placeholderUrl = sanitizeUrlCandidate(asset.placeholderUrl);
  const publicId = sanitizeUrlCandidate(asset.publicId);

  const primary = secureUrl || displayUrl || originalUrl || thumbnailUrl;

  if (!primary) {
    return null;
  }

  const payload = {
    url: displayUrl || secureUrl || originalUrl || thumbnailUrl,
    secureUrl: secureUrl || displayUrl || originalUrl || thumbnailUrl,
    originalUrl: originalUrl || secureUrl || displayUrl || thumbnailUrl,
  };

  if (thumbnailUrl) {
    payload.thumbnailUrl = thumbnailUrl;
  }
  if (placeholderUrl) {
    payload.placeholderUrl = placeholderUrl;
  }
  if (publicId) {
    payload.publicId = publicId;
  }

  const uploadedAt = asset.uploadedAt ? new Date(asset.uploadedAt) : null;
  if (uploadedAt && !Number.isNaN(uploadedAt.getTime())) {
    payload.uploadedAt = uploadedAt.toISOString();
  }

  return payload;
};

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

const BIO_WORD_LIMIT = 200;

const sanitizePronounValue = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const collapsedSlash = trimmed.replace(/\s*\/\s*/g, "/");
  const normalizedWhitespace = collapsedSlash.replace(/\s{2,}/g, " ");
  return normalizedWhitespace;
};

const normalizePronounsList = (value) => {
  if (!value) {
    return [];
  }

  const source = Array.isArray(value)
    ? value
    : value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

  return source
    .map(sanitizePronounValue)
    .filter((entry) => Boolean(entry))
    .slice(0, 4);
};

const countWords = (text = "") => {
  if (!text) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
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

const POSTS_PREVIEW_LIMIT = 5;
const DRAFTS_PREVIEW_LIMIT = 5;

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
  const [postPreview, setPostPreview] = useState([]);
  const [postPreviewMeta, setPostPreviewMeta] = useState({ total: 0, hasMore: false });
  const [draftPreview, setDraftPreview] = useState([]);
  const [draftPreviewMeta, setDraftPreviewMeta] = useState({ total: 0, hasMore: false });
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedFetched, setSavedFetched] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPostPreview, setLoadingPostPreview] = useState(false);
  const [loadingDraftPreview, setLoadingDraftPreview] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [postsError, setPostsError] = useState(null);
  const [draftsError, setDraftsError] = useState(null);
  const [listsError, setListsError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    pronouns: [],
    pronounInput: "",
    topics: "",
    avatar: "",
  });
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUpdating, setCoverUpdating] = useState(false);
  const [bioWordCount, setBioWordCount] = useState(0);
  const [bioLimitReached, setBioLimitReached] = useState(false);

  const handleCardFeedback = useCallback((message, type = "info") => {
    if (!message) {
      setFeedback(null);
      return;
    }
    setFeedback({ type, message });
  }, []);

  const resolvePostDeletionTarget = useCallback((post) => {
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
        const stringValue = value.toString();
        if (stringValue && stringValue !== "[object Object]") {
          return stringValue;
        }
      }
    }

    return "";
  }, []);

  const fetchPostPreview = useCallback(async () => {
    if (!profileUsername) {
      return;
    }

    setLoadingPostPreview(true);
    setPostsError(null);

    const params = new URLSearchParams();
    params.set("limit", POSTS_PREVIEW_LIMIT.toString());
    params.set("page", "1");

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

      const pagination = payload.pagination || {};
      const totalCandidate = Number(pagination.total);
      const total = Number.isFinite(totalCandidate) ? totalCandidate : items.length;
      const hasMore =
        typeof pagination.hasMore === "boolean"
          ? pagination.hasMore
          : total > POSTS_PREVIEW_LIMIT;

      setPostPreview(items.slice(0, POSTS_PREVIEW_LIMIT));
      setPostPreviewMeta({ total, hasMore });
    } catch (error) {
      setPostPreview([]);
      setPostPreviewMeta({ total: 0, hasMore: false });
      setPostsError(error.message || "Failed to load stories");
    } finally {
      setLoadingPostPreview(false);
    }
  }, [profileUsername, token]);

  const fetchDraftPreview = useCallback(async () => {
    if (!viewingOwnProfile || !token) {
      return;
    }

    setLoadingDraftPreview(true);
    setDraftsError(null);

    const params = new URLSearchParams();
    params.set("limit", DRAFTS_PREVIEW_LIMIT.toString());
    params.set("page", "1");

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
      const pagination = payload.pagination || {};
      const totalCandidate = Number(pagination.total);
      const total = Number.isFinite(totalCandidate) ? totalCandidate : items.length;
      const hasMore =
        typeof pagination.hasMore === "boolean" ? pagination.hasMore : total > DRAFTS_PREVIEW_LIMIT;

      setDraftPreview(items.slice(0, DRAFTS_PREVIEW_LIMIT));
      setDraftPreviewMeta({ total, hasMore });
    } catch (error) {
      setDraftPreview([]);
      setDraftPreviewMeta({ total: 0, hasMore: false });
      setDraftsError(error.message || "Failed to load drafts");
    } finally {
      setLoadingDraftPreview(false);
    }
  }, [token, viewingOwnProfile]);

  const handleDeleteOwnPost = useCallback(
    async (post) => {
      const target = resolvePostDeletionTarget(post);

      if (!target) {
        const message = "Unable to identify this story.";
        handleCardFeedback(message, "error");
        return { success: false, error: message };
      }

      if (!token) {
        const message = "Sign in to manage your stories.";
        handleCardFeedback(message, "error");
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

        handleCardFeedback("Story deleted.", "success");

        fetchPostPreview();
        if (viewingOwnProfile) {
          fetchDraftPreview();
        }

        return { success: true };
      } catch (requestError) {
        console.error(requestError);
        const message = requestError.message || "Unable to delete story.";
        handleCardFeedback(message, "error");
        return { success: false, error: message };
      }
    },
    [fetchDraftPreview, fetchPostPreview, handleCardFeedback, resolvePostDeletionTarget, token, viewingOwnProfile]
  );

  const initializeEditForm = useCallback(() => {
    if (!viewingOwnProfile) {
      return;
    }

    const baseName = profile?.name || profile?.username || authUser?.name || authUser?.username || "";
    const baseAvatarSeed = baseName || profileUsername || authUser?.email || "Reader";
    const existingPronouns = normalizePronounsList(profile?.pronouns);
    const initialBio = profile?.bio || "";
    setBioWordCount(countWords(initialBio));
    setBioLimitReached(false);
    setEditForm({
      name: profile?.name || baseName,
      bio: initialBio,
      pronouns: existingPronouns,
      pronounInput: "",
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

  const addPronoun = useCallback(
    (rawValue) => {
      const sanitized = sanitizePronounValue(rawValue);
      if (!sanitized) {
        setEditForm((current) => ({ ...current, pronounInput: "" }));
        return false;
      }

      if (sanitized.length > 24) {
        setEditError("Pronouns should be 24 characters or fewer.");
        return false;
      }

      let added = false;
      let limitReached = false;
      let duplicate = false;

      setEditForm((current) => {
        const pronouns = Array.isArray(current.pronouns) ? current.pronouns : [];
        if (pronouns.length >= 4) {
          limitReached = true;
          return { ...current, pronounInput: "" };
        }

        if (pronouns.some((value) => value.toLowerCase() === sanitized.toLowerCase())) {
          duplicate = true;
          return { ...current, pronounInput: "" };
        }

        added = true;
        const nextPronouns = [...pronouns, sanitized];
        return {
          ...current,
          pronouns: nextPronouns,
          pronounInput: "",
        };
      });

      if (limitReached) {
        setEditError("You can add up to four pronouns.");
        return false;
      }

      if (duplicate) {
        return false;
      }

      if (added) {
        setEditError(null);
      }

      return added;
    },
    [setEditError]
  );

  const removePronoun = useCallback((target) => {
    if (!target) {
      return;
    }

    setEditForm((current) => {
      const pronouns = Array.isArray(current.pronouns) ? current.pronouns : [];
      const nextPronouns = pronouns.filter(
        (entry) => entry.toLowerCase() !== target.toLowerCase()
      );
      if (nextPronouns.length === pronouns.length) {
        return current;
      }
      return { ...current, pronouns: nextPronouns };
    });
    setEditError(null);
  }, [setEditError]);

  const handlePronounInputChange = useCallback(
    (event) => {
      updateEditForm("pronounInput", event.target.value);
    },
    [updateEditForm]
  );

  const handlePronounKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
        event.preventDefault();
        addPronoun(event.currentTarget.value);
        return;
      }

      if (event.key === "Backspace" && !event.currentTarget.value) {
        event.preventDefault();
        setEditForm((current) => {
          const pronouns = Array.isArray(current.pronouns) ? current.pronouns : [];
          if (!pronouns.length) {
            return current;
          }
          const nextPronouns = pronouns.slice(0, -1);
          return { ...current, pronouns: nextPronouns, pronounInput: "" };
        });
        setEditError(null);
      }
    },
    [addPronoun, setEditError]
  );

  const handlePronounBlur = useCallback(
    (event) => {
      const value = event?.currentTarget?.value || "";
      if (!value.trim()) {
        updateEditForm("pronounInput", "");
        return;
      }
      addPronoun(value);
    },
    [addPronoun, updateEditForm]
  );

  const handleBioChange = useCallback(
    (event) => {
      const { value } = event.target;
      const words = countWords(value);

      if (words > BIO_WORD_LIMIT) {
        setBioLimitReached(true);
        return;
      }

      setBioLimitReached(false);
      setBioWordCount(words);
      updateEditForm("bio", value);
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
    setPostPreview([]);
    setPostPreviewMeta({ total: 0, hasMore: false });
    setDraftPreview([]);
    setDraftPreviewMeta({ total: 0, hasMore: false });
    setPostsError(null);
    setDraftsError(null);
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

  const handleCoverUpload = useCallback(
    async (event) => {
      const file = event?.target?.files?.[0];
      if (!file) {
        return;
      }

      if (!viewingOwnProfile) {
        return;
      }

      if (!token) {
        handleCardFeedback("Sign in to update your cover image.", "error");
        return;
      }

      setCoverUpdating(true);

      try {
        const asset = await mediaService.uploadImage({
          file,
          token,
          purpose: "cover",
        });

        const coverPayload = buildCoverUpdatePayload(asset);
        if (!coverPayload) {
          throw new Error("Upload response is missing cover metadata.");
        }

        const response = await fetch(`${API_BASE_URL}/api/users/update`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ coverImage: coverPayload }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to update cover image.");
        }

        if (data.user) {
          setProfile(data.user);
          if (typeof updateStoredUser === "function") {
            updateStoredUser(data.user);
          }
        } else {
          await fetchProfile();
        }

        handleCardFeedback("Cover image updated.", "success");
      } catch (error) {
        console.error(error);
        handleCardFeedback(error.message || "Failed to update cover image.", "error");
      } finally {
        setCoverUpdating(false);
        if (event?.target) {
          event.target.value = "";
        }
      }
    },
    [fetchProfile, handleCardFeedback, setProfile, token, updateStoredUser, viewingOwnProfile]
  );

  const handleCoverRemove = useCallback(async () => {
    if (!viewingOwnProfile || coverUpdating) {
      return;
    }

    const ownsCustomCover = Boolean(resolveCoverDetails(profile?.coverImage).url);

    if (!ownsCustomCover) {
      handleCardFeedback("You haven't added a cover image yet.", "info");
      return;
    }

    if (!token) {
      handleCardFeedback("Sign in to update your cover image.", "error");
      return;
    }

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Remove your cover image?")
        : true;

    if (!confirmed) {
      return;
    }

    setCoverUpdating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ coverImage: null }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove cover image.");
      }

      if (data.user) {
        setProfile(data.user);
        if (typeof updateStoredUser === "function") {
          updateStoredUser(data.user);
        }
      } else {
        await fetchProfile();
      }

      handleCardFeedback("Cover image removed.", "success");
    } catch (error) {
      console.error(error);
      handleCardFeedback(error.message || "Failed to remove cover image.", "error");
    } finally {
      setCoverUpdating(false);
    }
  }, [coverUpdating, fetchProfile, handleCardFeedback, profile, setProfile, token, updateStoredUser, viewingOwnProfile]);

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

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    if (!resolvedPermissions?.canViewPosts) {
      const key = resolvedPermissions?.reason;
      setPostPreview([]);
      setPostPreviewMeta({ total: 0, hasMore: false });
      setPostsError(key ? permissionMessages[key] || "Stories are hidden." : "Stories are hidden.");
      setLoadingPostPreview(false);
      return;
    }

    fetchPostPreview();
  }, [resolvedPermissions, fetchPostPreview, loadingProfile]);

  useEffect(() => {
    if (!viewingOwnProfile || loadingProfile) {
      return;
    }

    fetchDraftPreview();
  }, [fetchDraftPreview, loadingProfile, viewingOwnProfile]);

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

      if (bioLimitReached || bioWordCount > BIO_WORD_LIMIT) {
        setEditError(`Your bio can include up to ${BIO_WORD_LIMIT} words.`);
        return;
      }

  const nextBioRaw = editForm.bio || "";
  const nextBio = nextBioRaw.trim();

      const currentPronounsList = normalizePronounsList(profile?.pronouns);
      const pendingPronoun = sanitizePronounValue(editForm.pronounInput);
      let pronounCandidates = Array.isArray(editForm.pronouns) ? [...editForm.pronouns] : [];
      let pronounAddedFromInput = false;

      if (pendingPronoun) {
        const hasDuplicate = pronounCandidates.some(
          (value) => value.toLowerCase() === pendingPronoun.toLowerCase()
        );

        if (pronounCandidates.length >= 4 && !hasDuplicate) {
          setEditError("You can add up to four pronouns.");
          return;
        }

        if (!hasDuplicate) {
          pronounCandidates.push(pendingPronoun);
          pronounAddedFromInput = true;
        }
      }

      pronounCandidates = pronounCandidates
        .map((value) => sanitizePronounValue(value))
        .filter(Boolean)
        .slice(0, 4);

      if (pronounCandidates.some((value) => value.length > 24)) {
        setEditError("Pronouns should be 24 characters or fewer.");
        return;
      }

      if (pronounAddedFromInput) {
        setEditForm((current) => ({
          ...current,
          pronouns: [...pronounCandidates],
          pronounInput: "",
        }));
      }

      const nextTopics = normalizeTopicsInput(editForm.topics).slice(0, 12);
      const nextAvatar = (editForm.avatar || "").trim();

      const normalizedPronouns = pronounCandidates.map((value) => value.toLowerCase());

      const currentPronouns = currentPronounsList.map((value) => value.toLowerCase());
      const currentTopics = Array.isArray(profile?.topics) ? profile.topics : [];

      const payload = {};

      if (nextName !== (profile?.name || "")) {
        payload.name = nextName;
      }

      if (nextBio !== (profile?.bio || "")) {
        payload.bio = nextBioRaw.trim();
      }

      if (!arraysEqual(normalizedPronouns, currentPronouns)) {
        payload.pronouns = pronounCandidates;
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
    [bioLimitReached, bioWordCount, editForm, fetchProfile, handleCloseEditModal, profile, token, updateStoredUser, viewingOwnProfile]
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
        fetchPostPreview();
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
  }, [viewingOwnProfile, profileUsername, relationship, token, resolvedPermissions, fetchPostPreview]);

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
        setPostPreview([]);
        setPostPreviewMeta({ total: 0, hasMore: false });
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
  const coverDetails = useMemo(() => resolveCoverDetails(profile?.coverImage), [profile?.coverImage]);
  const coverImage = coverDetails.url || COVER_FALLBACK;
  const coverPlaceholder = coverDetails.placeholder;
  const hasCustomCover = Boolean(coverDetails.url);
  const heroBackgroundStyle = coverPlaceholder
    ? { backgroundImage: `url(${coverPlaceholder})` }
    : undefined;
  const topics = Array.isArray(profile?.topics) ? profile.topics : [];
  const joinedAt = profile?.createdAt ? new Date(profile.createdAt) : null;

  const followerCount = stats?.followers ?? 0;
  const followingCount = stats?.following ?? 0;
  const profileSlug = profile?.username || profileUsername || authUser?.username || "";
  const canNavigateToConnections = viewingOwnProfile || Boolean(profileSlug);
  const storiesUsername = viewingOwnProfile ? null : profileSlug || profileUsername;
  const followersLink = viewingOwnProfile
    ? "/profile/followers"
    : profileSlug
    ? `/u/${profileSlug}/followers`
    : "#";
  const followingLink = viewingOwnProfile
    ? "/profile/following"
    : profileSlug
    ? `/u/${profileSlug}/following`
    : "#";
  const postsPageLink = viewingOwnProfile
    ? "/profile/stories"
    : storiesUsername
    ? `/u/${storiesUsername}/stories`
    : null;
  const draftsPageLink = viewingOwnProfile
    ? { pathname: "/profile/stories", search: "?tab=drafts" }
    : null;

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
      <div className="profile-hero" style={heroBackgroundStyle}>
        <img src={coverImage} alt="Profile banner" />
        <div className="profile-hero__overlay" />
        {viewingOwnProfile && (
          <div className="profile-hero__controls">
            <label
              className="profile-hero__button profile-hero__button--primary"
              data-busy={coverUpdating ? "true" : undefined}
              aria-disabled={coverUpdating ? "true" : "false"}
            >
              <input
                type="file"
                accept="image/*"
                className="profile-hero__input"
                onChange={handleCoverUpload}
                disabled={coverUpdating}
              />
              {coverUpdating ? "Updating…" : "Change cover"}
            </label>
            {hasCustomCover && (
              <button
                type="button"
                className="profile-hero__button profile-hero__button--ghost"
                onClick={handleCoverRemove}
                disabled={coverUpdating}
              >
                Remove
              </button>
            )}
          </div>
        )}
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
                  {canNavigateToConnections ? (
                    <Link to={followersLink} className="profile-header-card__meta-link">
                      <strong>{formatNumber(followerCount)}</strong> follower{followerCount === 1 ? "" : "s"}
                    </Link>
                  ) : (
                    <span>
                      <strong>{formatNumber(followerCount)}</strong> follower{followerCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {canNavigateToConnections ? (
                    <Link to={followingLink} className="profile-header-card__meta-link">
                      <strong>{formatNumber(followingCount)}</strong> following
                    </Link>
                  ) : (
                    <span>
                      <strong>{formatNumber(followingCount)}</strong> following
                    </span>
                  )}
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
                <div className="profile-preview-section">
                  <div className="profile-preview-header">
                    <h3>Stories</h3>
                    {postsPageLink && (postPreview.length > 0 || postPreviewMeta.total > 0) && (
                      <Link to={postsPageLink} className="profile-preview-link">
                        See all
                      </Link>
                    )}
                  </div>
                  {loadingPostPreview && <p className="profile-status">Loading stories…</p>}
                  {postsError && !loadingPostPreview && (
                    <p className="profile-status profile-status--muted">{postsError}</p>
                  )}
                  {!loadingPostPreview && !postsError && postPreview.length === 0 && (
                    <p className="profile-status profile-status--muted">
                      {viewingOwnProfile
                        ? "Publish your first story to see it here."
                        : "No public stories yet."}
                    </p>
                  )}
                  {postPreview.map((post) => (
                    <Post
                      key={post.id || post.slug || post._id || post.metadata?.id}
                      post={post}
                      variant="profile"
                      canEdit={viewingOwnProfile}
                      onActionFeedback={handleCardFeedback}
                      onDeletePost={viewingOwnProfile ? handleDeleteOwnPost : undefined}
                    />
                  ))}
                </div>

                {viewingOwnProfile && (
                  <div className="profile-preview-section">
                    <div className="profile-preview-header">
                      <h3>Drafts</h3>
                      {draftsPageLink && (draftPreview.length > 0 || draftPreviewMeta.total > 0) && (
                        <Link to={draftsPageLink} className="profile-preview-link">
                          See all
                        </Link>
                      )}
                    </div>
                    {loadingDraftPreview && <p className="profile-status">Loading drafts…</p>}
                    {draftsError && !loadingDraftPreview && (
                      <p className="profile-status profile-status--muted">{draftsError}</p>
                    )}
                    {!loadingDraftPreview && !draftsError && draftPreview.length === 0 && (
                      <p className="profile-status profile-status--muted">
                        Save ideas as drafts to keep them handy.
                      </p>
                    )}
                    {draftPreview.map((post) => (
                      <Post
                        key={post.id || post.slug || post._id || post.metadata?.id}
                        post={post}
                        variant="profile"
                        canEdit
                        onActionFeedback={handleCardFeedback}
                        onDeletePost={handleDeleteOwnPost}
                      />
                    ))}
                  </div>
                )}
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
                    canEdit={false}
                    onActionFeedback={handleCardFeedback}
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
                    <div className="profile-edit-modal__chips" data-disabled={editSaving ? "true" : undefined}>
                      {Array.isArray(editForm.pronouns) &&
                        editForm.pronouns.map((pronoun) => (
                          <span key={pronoun} className="profile-edit-modal__chip">
                            <span className="profile-edit-modal__chip-label">{pronoun}</span>
                            <button
                              type="button"
                              className="profile-edit-modal__chip-remove"
                              onClick={() => removePronoun(pronoun)}
                              disabled={editSaving}
                              aria-label={`Remove pronoun ${pronoun}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      <input
                        type="text"
                        className="profile-edit-modal__chips-input"
                        value={editForm.pronounInput}
                        onChange={handlePronounInputChange}
                        onKeyDown={handlePronounKeyDown}
                        onBlur={handlePronounBlur}
                        placeholder={
                          Array.isArray(editForm.pronouns) && editForm.pronouns.length > 0
                            ? "Add pronoun"
                            : "e.g. she/her"
                        }
                        disabled={editSaving || (editForm.pronouns?.length ?? 0) >= 4}
                        aria-label="Add a pronoun"
                      />
                    </div>
                    <span className="profile-edit-modal__help">Add up to four pronouns. Press Enter to save each one.</span>
                  </label>
                  <label className="profile-edit-modal__field">
                    <span className="profile-edit-modal__label">Bio</span>
                    <textarea
                      className="profile-edit-modal__textarea"
                      rows={4}
                      value={editForm.bio}
                      onChange={handleBioChange}
                      disabled={editSaving}
                    ></textarea>
                    <div className="profile-edit-modal__meta-row">
                      <span className="profile-edit-modal__help">Share what you publish or what readers can expect.</span>
                      <span
                        className={`profile-edit-modal__counter${bioLimitReached ? " profile-edit-modal__counter--alert" : ""}`}
                      >
                        {bioWordCount}/{BIO_WORD_LIMIT} words
                      </span>
                    </div>
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
