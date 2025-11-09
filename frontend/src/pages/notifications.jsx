import React, { useMemo, useState } from "react";
import "./notifications.css";
import { useSocketContext } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";

const TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

const formatRelativeTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const buildMessage = (notification) => {
  if (!notification) {
    return "";
  }

  if (notification.message) {
    return notification.message;
  }

  const actor = notification.sender?.name || notification.sender?.username || "Someone";
  const title = notification.post?.title ? ` "${notification.post.title}"` : "";

  switch (notification.type) {
    case "like":
      return `${actor} liked your story${title}`;
    case "comment":
      return `${actor} commented on${title || " your story"}`;
    case "reply":
      return `${actor} replied to your comment${title ? ` on${title}` : ""}`;
    case "follow":
      return `${actor} started following you`;
    case "system":
    default:
      return `${actor} sent you an update`;
  }
};

const getInitials = (sender) => {
  if (!sender) {
    return "•";
  }

  const source = sender.name || sender.username || "";
  if (!source) {
    return "•";
  }

  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0])
    .join("")
    .toUpperCase();
};

const NotificationItem = ({ notification, onSelect }) => {
  const message = buildMessage(notification);
  const timestamp = formatRelativeTime(notification.createdAt);
  const isUnread = !notification.isRead;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(notification);
    }
  };

  return (
    <div
      className={`notifications-item${isUnread ? " notifications-item--unread" : ""}`}
      onClick={() => onSelect(notification)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="notifications-item__avatar">
        {notification.sender?.avatar ? (
          <img src={notification.sender.avatar} alt={notification.sender.name || ""} />
        ) : (
          <span>{getInitials(notification.sender)}</span>
        )}
      </div>
      <div className="notifications-item__body">
        <p className="notifications-item__message">{message}</p>
        <div className="notifications-item__meta">
          <span>{timestamp}</span>
          {notification.post?.title ? (
            <>
              <span aria-hidden="true">•</span>
              <span>{notification.post.title}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const noop = () => {};

const Notifications = ({ showSidebar = true, embedded = false }) => {
  const { user } = useAuth();
  const socketContext = useSocketContext() || {};
  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    error,
    hasMore = false,
    markAllAsRead = noop,
    markAsRead = noop,
    loadMore = noop,
  } = socketContext;

  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((item) => !item.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  const containerClass = embedded
    ? "notifications-page notifications-page--embedded"
    : "notifications-page";

  const layoutClass = showSidebar
    ? "notifications-layout"
    : "notifications-layout notifications-layout--single";

  const canMarkAllRead = unreadCount > 0 && !loading;
  const showEmptyState = !loading && !filteredNotifications.length;

  const handleNotificationSelect = (notification) => {
    if (!notification) {
      return;
    }

    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    const targetSlug = notification.post?.slug;
    if (targetSlug) {
      window.location.href = `/post/${targetSlug}`;
    }
  };

  return (
    <div className={containerClass}>
      <header className="notifications-hero">
        <div className="notifications-hero__content">
          <h1>Notifications</h1>
          <p>
            {user?.name ? `${user.name}, here is what you missed while you were away.` : "Stay up to date with the latest activity on your stories."}
          </p>
        </div>
        <div className="notifications-actions">
          <button
            type="button"
            className="notifications-mark-all"
            onClick={markAllAsRead}
            disabled={!canMarkAllRead}
          >
            Mark all as read
          </button>
        </div>
      </header>

      <nav className="notifications-tabs" aria-label="Notification filters">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const badge = tab.id === "unread" ? unreadCount : notifications.length;

          return (
            <button
              key={tab.id}
              type="button"
              className={`notifications-tab${isActive ? " notifications-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="notifications-tab__badge">{badge}</span>
            </button>
          );
        })}
      </nav>

      {error ? <div className="notifications-alert">{error}</div> : null}

      <div className={layoutClass}>
        <section className="notifications-list" aria-live="polite">
          {loading && !notifications.length ? <p className="notifications-empty">Loading notifications…</p> : null}
          {showEmptyState ? (
            <div className="notifications-empty">
              <p>No notifications just yet</p>
              <p>You will see new activity here as soon as it happens.</p>
            </div>
          ) : null}

          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onSelect={handleNotificationSelect}
            />
          ))}

          {hasMore ? (
            <button type="button" className="notifications-older" onClick={loadMore} disabled={loading}>
              {loading ? "Loading…" : "Load older notifications"}
            </button>
          ) : null}
        </section>

        {showSidebar ? (
          <aside className="notifications-sidebar" aria-label="Notification insights">
            <div className="notifications-card">
              <h2>Stay in the loop</h2>
              <ul>
                <li>
                  <p className="notifications-card__title">Real-time updates</p>
                  <p className="notifications-card__meta">
                    Never miss a reaction or a new follower. We will keep this list fresh as activity happens.
                  </p>
                </li>
                <li>
                  <p className="notifications-card__title">Pro tip</p>
                  <p className="notifications-card__meta">
                    Tap a notification to jump straight to the story or profile it references.
                  </p>
                </li>
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default Notifications;
