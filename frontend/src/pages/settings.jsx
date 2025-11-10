import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import "./settings.css";

const TABS = [
  { id: "account", label: "Account", hint: "Profile & security", icon: "👤" },
  { id: "publishing", label: "Publishing", hint: "Stories & distribution", icon: "📝" },
];

const HELP_ARTICLES = [
  "Sign in or sign up to Medium",
  "Your profile page",
  "Writing and publishing your first story",
  "About Medium's distribution system",
];

const PREMIUM_BADGE = "\u2726"; // &#10022;

const MENU_OPTIONS = {
  visibility: [
    {
      value: "Public",
      label: "Public",
      description: "Anyone on or off BlogsHive can discover your story.",
    },
    {
      value: "Unlisted",
      label: "Unlisted",
      description: "Only readers with the link can view the story.",
    },
    {
      value: "Private",
      label: "Private",
      description: "Visible only to you while you iterate.",
    },
  ],
  sendEmails: [
    {
      value: true,
      label: "Send automatically",
      description: "Email your followers as soon as a story publishes.",
    },
    {
      value: false,
      label: "I'll decide each time",
      description: "Prompt me whenever I publish a new story.",
    },
  ],
  commentSetting: [
    {
      value: "Everyone",
      label: "Everyone",
      description: "Open responses to all readers.",
    },
    {
      value: "Followers only",
      label: "Followers only",
      description: "Limit responses to people you follow.",
    },
    {
      value: "Disabled",
      label: "Disabled",
      description: "Turn off responses on newly published stories.",
    },
  ],
  autoSave: [
    {
      value: true,
      label: "Auto-save on",
      description: "Drafts save silently as you write.",
    },
    {
      value: false,
      label: "Auto-save off",
      description: "You'll manually save drafts from the editor.",
    },
  ],
  digestFrequency: [
    {
      value: "Daily",
      label: "Daily",
      description: "Stay in the loop every morning.",
    },
    {
      value: "Weekly",
      label: "Weekly",
      description: "One curated summary in your inbox each week.",
    },
    {
      value: "Monthly",
      label: "Monthly",
      description: "A broad recap of the moments that mattered.",
    },
  ],
  membership: [
    {
      value: "None",
      label: "Standard (free)",
      description: "Read, publish, and discover with the free plan.",
    },
    {
      value: "Premium",
      label: "Premium",
      description: "Unlock premium themes, deeper analytics, and supporter perks.",
      icon: PREMIUM_BADGE,
    },
  ],
};

const mapSettingsPayload = (payload = {}, fallback = {}) => {
  const fallbackPremium = (() => {
    if (typeof fallback.isPremium === "boolean") {
      return fallback.isPremium;
    }
    return (fallback.membership || "").toLowerCase() === "premium";
  })();

  const membershipValue = (payload.membership || fallback.membership || "None").trim() || "None";
  const isPremium =
    typeof payload.isPremium === "boolean"
      ? payload.isPremium
      : membershipValue.toLowerCase() === "premium" || fallbackPremium;

  return {
    email: payload.email ?? fallback.email ?? "",
    username: payload.username ?? fallback.username ?? "",
    displayName:
      payload.displayName ??
      payload.name ??
      fallback.displayName ??
      fallback.username ??
      "",
    visibility: payload.visibility ?? fallback.visibility ?? "Public",
    sendEmails:
      typeof payload.sendEmails === "boolean"
        ? payload.sendEmails
        : typeof fallback.sendEmails === "boolean"
        ? fallback.sendEmails
        : true,
    commentSetting: payload.commentSetting ?? fallback.commentSetting ?? "Everyone",
    signature: payload.signature ?? fallback.signature ?? "Thank you for reading!",
    autoSave:
      typeof payload.autoSave === "boolean"
        ? payload.autoSave
        : typeof fallback.autoSave === "boolean"
        ? fallback.autoSave
        : true,
    analyticsId: payload.analyticsId ?? fallback.analyticsId ?? "",
    digestFrequency: payload.digestFrequency ?? fallback.digestFrequency ?? "Weekly",
    membership: membershipValue,
    isPremium,
  };
};

const getInitials = (value) => {
  if (!value) {
    return "U";
  }
  return value.trim().charAt(0).toUpperCase();
};

const formatMembershipLabel = (membership) =>
  (membership || "").toLowerCase() === "premium" ? "Premium member" : "Standard member";

export default function Settings() {
  const { user, token, updateUser } = useAuth();

  const fallbackSettings = useMemo(
    () => ({
      email: user?.email || "",
      username: user?.username || "",
      displayName: user?.name || user?.username || "",
      visibility: "Public",
      sendEmails: true,
      commentSetting: "Everyone",
      signature: "Thank you for reading!",
      autoSave: true,
      analyticsId: "",
      digestFrequency: "Weekly",
      membership: user?.membershipStatus ? "Premium" : "None",
      isPremium: Boolean(user?.membershipStatus),
    }),
    [user]
  );

  const [settingsState, setSettingsState] = useState(fallbackSettings);
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [emailInput, setEmailInput] = useState(fallbackSettings.email);
  const [signatureInput, setSignatureInput] = useState(fallbackSettings.signature);
  const [openMenu, setOpenMenu] = useState(null);
  const [savingField, setSavingField] = useState(null);
  const [justSavedField, setJustSavedField] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState(null);
  const [blockedAction, setBlockedAction] = useState(null);
  const savedTimers = useRef({});
  const menuHostRef = useRef(null);

  const shareWithAuth = useCallback(
    (normalized) => {
      if (typeof updateUser !== "function" || !user) {
        return;
      }

      const nextState = {
        email: normalized.email,
        username: normalized.username,
        name: normalized.displayName || normalized.username,
        membershipStatus: normalized.isPremium,
      };

      const hasDifference = Object.entries(nextState).some(([key, value]) => {
        if (key === "membershipStatus") {
          return Boolean(user.membershipStatus) !== Boolean(value);
        }
        return (user[key] || "") !== (value || "");
      });

      if (!hasDifference) {
        return;
      }

      updateUser(nextState);
    },
    [updateUser, user]
  );

  const applyPayload = useCallback(
    (payload) => {
      const normalized = mapSettingsPayload(payload, fallbackSettings);
      setSettingsState(normalized);
      setEmailInput(normalized.email);
      setSignatureInput(normalized.signature);
      shareWithAuth(normalized);
    },
    [fallbackSettings, shareWithAuth]
  );

  const fetchSettings = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to load settings");
      }

      applyPayload(data);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }, [token, applyPayload]);

  const fetchBlockedUsers = useCallback(async () => {
    if (!token) {
      setBlockedUsers([]);
      return;
    }

    setBlockedLoading(true);
    setBlockedError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/blocked`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load blocked users");
      }

      const items = Array.isArray(payload.blocked) ? payload.blocked : [];
      setBlockedUsers(items);
    } catch (requestError) {
      setBlockedUsers([]);
      setBlockedError(requestError.message || "Failed to load blocked users");
    } finally {
      setBlockedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  useEffect(() => {
    setEmailInput(settingsState.email);
  }, [settingsState.email]);

  useEffect(() => {
    setSignatureInput(settingsState.signature);
  }, [settingsState.signature]);

  useEffect(
    () => () => {
      Object.values(savedTimers.current).forEach(clearTimeout);
    },
    []
  );

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    const handleClick = (event) => {
      if (menuHostRef.current && !menuHostRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

  const registerJustSaved = useCallback((field) => {
    if (!field) {
      return;
    }

    if (savedTimers.current[field]) {
      clearTimeout(savedTimers.current[field]);
    }

    setJustSavedField(field);
    savedTimers.current[field] = setTimeout(() => {
      setJustSavedField((current) => (current === field ? null : current));
      delete savedTimers.current[field];
    }, 1800);
  }, []);

  const persistSettings = useCallback(
    async (payload, fieldKey) => {
      setSavingField(fieldKey || null);
      setError(null);

      try {
        if (!token) {
          registerJustSaved(fieldKey);
          setOpenMenu(null);
          return true;
        }

        const response = await fetch(`${API_BASE_URL}/api/settings/me`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const updated = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(updated.error || "Failed to update settings");
        }

        applyPayload(updated);
        registerJustSaved(fieldKey);
        setOpenMenu(null);
        return true;
      } catch (updateError) {
        setError(updateError.message || "Unable to update settings");
        return false;
      } finally {
        setSavingField(null);
      }
    },
    [token, applyPayload, registerJustSaved]
  );

  const handleUnblockUser = useCallback(
    async (username) => {
      if (!token || !username) {
        return;
      }

      setBlockedAction(username);
      setBlockedError(null);

      try {
    const response = await fetch(`${API_BASE_URL}/api/users/${username}/block`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to unblock user");
        }

        setBlockedUsers((current) => current.filter((entry) => entry?.username !== username));
      } catch (requestError) {
        setBlockedError(requestError.message || "Failed to unblock user");
        fetchBlockedUsers();
      } finally {
        setBlockedAction(null);
      }
    },
    [token, fetchBlockedUsers]
  );

  const handleMenuSelection = useCallback(
    async (field, value) => {
      if (!field) {
        setOpenMenu(null);
        return;
      }

      const previousValue = settingsState[field];
      if (previousValue === value) {
        setOpenMenu(null);
        return;
      }

      setSettingsState((current) => {
        if (!current) {
          return current;
        }

        const nextState = { ...current, [field]: value };
        if (field === "membership") {
          nextState.isPremium = String(value).toLowerCase() === "premium";
        }

        return nextState;
      });

      const success = await persistSettings({ [field]: value }, field);

      if (!success) {
        setSettingsState((current) => {
          if (!current) {
            return current;
          }

          const reverted = { ...current, [field]: previousValue };
          if (field === "membership") {
            reverted.isPremium = String(previousValue).toLowerCase() === "premium";
          }

          return reverted;
        });
      }
    },
    [persistSettings, settingsState]
  );

  const handleEmailSave = useCallback(
    async (event) => {
      if (event) {
        event.preventDefault();
      }

      const nextEmail = emailInput.trim();
      if (!nextEmail || nextEmail === settingsState.email) {
        setShowEmailModal(false);
        return;
      }

      const success = await persistSettings({ email: nextEmail }, "email");
      if (success) {
        setShowEmailModal(false);
      }
    },
    [emailInput, persistSettings, settingsState.email]
  );

  const handleSignatureSave = useCallback(
    async (event) => {
      if (event) {
        event.preventDefault();
      }

      const nextSignature = signatureInput.trim();
      if (nextSignature === settingsState.signature) {
        setShowSignatureModal(false);
        return;
      }

      const success = await persistSettings({ signature: nextSignature }, "signature");
      if (success) {
        setShowSignatureModal(false);
      }
    },
    [persistSettings, settingsState.signature, signatureInput]
  );

  const openAnalyticsPrompt = useCallback(() => {
    const next = window.prompt(
      "Enter your Google Analytics or Plausible ID:",
      settingsState.analyticsId
    );

    if (next === null) {
      return;
    }

    const trimmed = next.trim();
    persistSettings({ analyticsId: trimmed }, "analyticsId");
  }, [persistSettings, settingsState.analyticsId]);

  const heroChips = useMemo(() => {
    if (!settingsState) {
      return [];
    }

    const chips = [
      `Default visibility · ${settingsState.visibility}`,
      `Digest frequency · ${settingsState.digestFrequency}`,
      `Auto-save drafts · ${settingsState.autoSave ? "On" : "Off"}`,
    ];

    if (settingsState.isPremium) {
      chips.push("Premium membership active");
    }

    return chips;
  }, [settingsState]);

  const membershipLabel = formatMembershipLabel(settingsState.membership);
  const initials = getInitials(settingsState.displayName);

  const accountRows = useMemo(
    () => [
      {
        id: "email",
        label: "Email address",
        value: settingsState.email,
        supporting: "Used for sign-in, recovery, and important announcements.",
        onOpen: () => {
          setEmailInput(settingsState.email);
          setShowEmailModal(true);
        },
      },
      {
        id: "username",
        label: "Username and subdomain",
        value: settingsState.username ? `@${settingsState.username}` : "Set a username",
        supporting: "This appears in your profile URL and author bylines.",
      },
      {
        id: "profile",
        label: "Profile information",
        value: settingsState.displayName || "Add your name",
        supporting: "Personalize how readers see you across BlogsHive.",
        avatar: true,
      },
      {
        id: "membership",
        label: "Membership",
        value: membershipLabel,
        supporting: settingsState.isPremium
          ? "Thank you for supporting writers with a premium plan."
          : "Upgrade to premium to unlock deeper analytics and themes.",
        field: "membership",
        options: MENU_OPTIONS.membership,
        currentValue: settingsState.membership,
        accent: settingsState.isPremium,
    badge: settingsState.isPremium ? PREMIUM_BADGE : null,
      },
      {
        id: "digestFrequency",
        label: "Medium Digest",
        value: settingsState.digestFrequency,
        supporting: "Choose how often we send you reading inspiration.",
        field: "digestFrequency",
        options: MENU_OPTIONS.digestFrequency,
        currentValue: settingsState.digestFrequency,
        accent: true,
      },
    ],
    [membershipLabel, settingsState]
  );

  const publishingRows = useMemo(
    () => [
      {
        id: "visibility",
        label: "Default visibility",
        value: settingsState.visibility,
        supporting: "Applies whenever you publish a brand-new story.",
        field: "visibility",
        options: MENU_OPTIONS.visibility,
        currentValue: settingsState.visibility,
        accent: true,
      },
      {
        id: "sendEmails",
        label: "Email distribution",
        value: settingsState.sendEmails ? "Send automatically" : "I'll decide each time",
        field: "sendEmails",
        options: MENU_OPTIONS.sendEmails,
        currentValue: settingsState.sendEmails,
      },
      {
        id: "commentSetting",
        label: "Comment preferences",
        value: settingsState.commentSetting,
        field: "commentSetting",
        options: MENU_OPTIONS.commentSetting,
        currentValue: settingsState.commentSetting,
      },
      {
        id: "signature",
        label: "Post signature",
        value: settingsState.signature || "No signature",
        supporting: "We append this message to the end of new stories.",
        onOpen: () => {
          setSignatureInput(settingsState.signature);
          setShowSignatureModal(true);
        },
      },
      {
        id: "autoSave",
        label: "Auto-save drafts",
        value: settingsState.autoSave ? "Enabled" : "Disabled",
        field: "autoSave",
        options: MENU_OPTIONS.autoSave,
        currentValue: settingsState.autoSave,
      },
      {
        id: "analyticsId",
        label: "Analytics ID",
        value: settingsState.analyticsId || "Not set",
        supporting: "Integrate Google Analytics or Plausible to track readership.",
        onOpen: openAnalyticsPrompt,
      },
    ],
    [openAnalyticsPrompt, settingsState]
  );

  const rows = activeTab === "account" ? accountRows : publishingRows;

  const tabDescription =
    activeTab === "account"
      ? "Manage the essentials—from your sign-in and membership to how the network sees you."
      : "Control how your stories publish, distribute, and invite conversation.";

  const handleRowActivation = (row) => {
    if (row.options) {
      setOpenMenu((current) => (current === row.id ? null : row.id));
      return;
    }

    if (typeof row.onOpen === "function") {
      row.onOpen();
    }
  };

  const handleRowKeyDown = (event, row) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowActivation(row);
    }
  };

  const renderRow = (row) => {
    const fieldKey = row.field || row.id;
    const interactive = Boolean(row.options || row.onOpen);
    const isMenuOpen = openMenu === row.id;
    const isSaving = savingField === fieldKey;
    const isSaved = justSavedField === fieldKey;

    const className = [
      "settings-row",
      interactive ? "settings-row--action" : "",
      row.accent ? "settings-row--accent" : "",
      isMenuOpen ? "settings-row--open" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const containerProps = row.options
      ? {
          role: "button",
          tabIndex: 0,
          onClick: () => handleRowActivation(row),
          onKeyDown: (event) => handleRowKeyDown(event, row),
        }
      : interactive
      ? {
          type: "button",
          onClick: () => handleRowActivation(row),
        }
      : {};

    const Container = row.options ? "div" : interactive ? "button" : "div";

    return (
      <Container key={row.id} className={className} {...containerProps}>
        <div className="settings-row__content">
          {row.avatar && <span className="settings-row__avatar">{initials}</span>}
          <div>
            <p className="settings-row__label">{row.label}</p>
            {row.value && <p className="settings-row__value">{row.value}</p>}
            {row.supporting && <p className="settings-row__supporting">{row.supporting}</p>}
          </div>
        </div>
        <div className="settings-row__aside">
          {row.badge && <span className="settings-row__pill" aria-hidden="true">{row.badge}</span>}
          {isSaving && (
            <span className="settings-row__status settings-row__status--saving">Saving…</span>
          )}
          {!isSaving && isSaved && (
            <span className="settings-row__status settings-row__status--saved">Saved</span>
          )}
          {interactive && (
            <svg
              className={`settings-row__chevron${isMenuOpen ? " settings-row__chevron--open" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {row.options && isMenuOpen && (
          <div className="settings-row__menu" role="menu">
            {row.options.map((option) => {
              const isActive = option.value === row.currentValue;
              return (
                <button
                  type="button"
                  key={String(option.value)}
                  className={`settings-row__option${
                    isActive ? " settings-row__option--active" : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMenuSelection(row.field, option.value);
                  }}
                >
                  <div className="settings-row__option-main">
                    {option.icon && (
                      <span className="settings-row__option-icon" aria-hidden="true">
                        {option.icon}
                      </span>
                    )}
                    <span className="settings-row__option-label">{option.label}</span>
                  </div>
                  {option.description && (
                    <span className="settings-row__option-description">{option.description}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Container>
    );
  };

  return (
    <div className="settings-page">
      <section className="settings-hero">
        <div className="settings-hero__content">
          <span className="settings-hero__eyebrow">Workspace preferences</span>
          <h1>Settings</h1>
          <p>Fine-tune how your account looks, behaves, and reaches readers.</p>
        </div>
        <ul className="settings-hero__chips">
          {heroChips.map((chip) => (
            <li key={chip} className="settings-chip">
              {chip}
            </li>
          ))}
        </ul>
        <nav className="settings-nav" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`settings-nav__item${
                activeTab === tab.id ? " settings-nav__item--active" : ""
              }`}
            >
              <span className="settings-nav__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <div>
                <span className="settings-nav__label">{tab.label}</span>
                <span className="settings-nav__hint">{tab.hint}</span>
              </div>
            </button>
          ))}
        </nav>
        {loading && <div className="settings-loading">Syncing your preferences…</div>}
      </section>

      {error && (
        <div className="settings-alert" role="alert">
          {error}
        </div>
      )}

      <div className="settings-shell">
        <main className="settings-main" ref={menuHostRef}>
          <section className="settings-card">
            <header className="settings-card__header">
              <h2>
                {activeTab === "account"
                  ? "Account preferences"
                  : "Publishing preferences"}
              </h2>
              <p>{tabDescription}</p>
            </header>
            <div className="settings-card__body">{rows.map((row) => renderRow(row))}</div>
          </section>

          {activeTab === "account" && (
            <section className="settings-card">
              <header className="settings-card__header">
                <h2>Blocked accounts</h2>
                <p>Manage who you've muted from interacting with you.</p>
              </header>
              <div className="settings-card__body settings-card__body--list">
                {blockedLoading && (
                  <p className="settings-blocked__status" role="status">
                    Loading blocked users…
                  </p>
                )}
                {blockedError && !blockedLoading && (
                  <div className="settings-blocked__status settings-blocked__status--error" role="alert">
                    <span>{blockedError}</span>
                    <button type="button" onClick={fetchBlockedUsers}>
                      Retry
                    </button>
                  </div>
                )}
                {!blockedLoading && !blockedError && blockedUsers.length === 0 && (
                  <p className="settings-blocked__status" role="status">
                    You haven't blocked anyone.
                  </p>
                )}
                {!blockedLoading && !blockedError &&
                  blockedUsers.map((entry) => (
                    <div
                      key={entry.id || entry.username}
                      className="settings-blocked__item"
                    >
                      <div className="settings-blocked__avatar">
                        {entry.avatar ? (
                          <img src={entry.avatar} alt={entry.name || entry.username} />
                        ) : (
                          <span>{getInitials(entry.name || entry.username)}</span>
                        )}
                      </div>
                      <div className="settings-blocked__meta">
                        <p className="settings-blocked__name">{entry.name || entry.username}</p>
                        <p className="settings-blocked__handle">@{entry.username}</p>
                      </div>
                      <button
                        type="button"
                        className="settings-blocked__action"
                        onClick={() => handleUnblockUser(entry.username)}
                        disabled={blockedAction === entry.username}
                      >
                        {blockedAction === entry.username ? "Unblocking…" : "Unblock"}
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {activeTab === "account" && (
            <section className="settings-card settings-card--danger">
              <header className="settings-card__header">
                <h2>Manage account access</h2>
                <p>Deactivate temporarily or permanently remove your profile.</p>
              </header>
              <div className="settings-danger">
                <button
                  type="button"
                  className="settings-danger__action"
                  onClick={() => window.alert("Deactivate (mock)")}
                >
                  Deactivate account
                </button>
                <p>Suspends your account until you sign back in.</p>
              </div>
              <div className="settings-danger">
                <button
                  type="button"
                  className="settings-danger__action"
                  onClick={() => window.alert("Delete (mock)")}
                >
                  Delete account
                </button>
                <p>This permanently removes your account and content.</p>
              </div>
            </section>
          )}
        </main>

        <aside className="settings-aside">
          <div className="settings-card settings-card--compact">
            <div className="settings-snapshot">
              <div className="settings-snapshot__meta">
                <span className="settings-snapshot__avatar">{initials}</span>
                <div>
                  <p className="settings-snapshot__name">
                    {settingsState.displayName || "Add your name"}
                  </p>
                  <p className="settings-snapshot__detail">
                    {settingsState.username ? `@${settingsState.username}` : "username not set"}
                  </p>
                </div>
              </div>
              <div className="settings-snapshot__detail">
                Email · {settingsState.email || "Not set"}
              </div>
              <div
                className={`settings-snapshot__badge${
                  settingsState.isPremium ? " settings-snapshot__badge--premium" : ""
                }`}
              >
                {settingsState.isPremium ? "Premium member" : "Standard member"}
              </div>
            </div>
          </div>

          <div className="settings-card settings-card--compact">
            <div className="settings-card__header settings-card__header--subtle">
              <h3>Suggested help guides</h3>
              <p>Get quick answers to the most common questions.</p>
            </div>
            <ul className="settings-help">
              {HELP_ARTICLES.map((article) => (
                <li key={article}>
                  <button type="button">{article}</button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {showEmailModal && (
        <div
          className="settings-modal"
          onClick={() => setShowEmailModal(false)}
          role="presentation"
        >
          <div
            className="settings-modal__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-email-heading"
          >
            <header className="settings-modal__header">
              <h3 id="settings-email-heading">Update email address</h3>
              <button
                type="button"
                className="settings-modal__close"
                onClick={() => setShowEmailModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="settings-modal__body">
              <label className="settings-modal__label" htmlFor="settings-email-input">
                Email
              </label>
              <input
                id="settings-email-input"
                className="settings-modal__input"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
              />
              <p>We use this email for account recovery and notifications.</p>
            </div>
            <footer className="settings-modal__actions">
              <button
                type="button"
                className="settings-modal__button settings-modal__button--ghost"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-modal__button settings-modal__button--primary"
                onClick={handleEmailSave}
              >
                Save changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div
          className="settings-modal"
          onClick={() => setShowSignatureModal(false)}
          role="presentation"
        >
          <div
            className="settings-modal__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-signature-heading"
          >
            <header className="settings-modal__header">
              <h3 id="settings-signature-heading">Edit post signature</h3>
              <button
                type="button"
                className="settings-modal__close"
                onClick={() => setShowSignatureModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="settings-modal__body">
              <label className="settings-modal__label" htmlFor="settings-signature-input">
                Signature
              </label>
              <textarea
                id="settings-signature-input"
                className="settings-modal__input settings-modal__input--textarea"
                rows={3}
                value={signatureInput}
                onChange={(event) => setSignatureInput(event.target.value)}
              />
              <p>This message appears at the end of every new story.</p>
            </div>
            <footer className="settings-modal__actions">
              <button
                type="button"
                className="settings-modal__button settings-modal__button--ghost"
                onClick={() => setShowSignatureModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-modal__button settings-modal__button--primary"
                onClick={handleSignatureSave}
              >
                Save signature
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
