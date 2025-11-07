import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocketContext } from "../contexts/SocketContext";
import "./notifications.css";

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const NotificationRow = ({ notification, onOpen }) => {
  const actor = notification.sender;
  const actorLabel = actor?.name || actor?.username || "Someone";
  const avatar =
    actor?.avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(actorLabel || "BlogsHive")}`;
  const displayMessage = notification.message
    || (notification.type === "follow"
      ? `${actorLabel} followed you`
      : notification.type === "like"
      ? `${actorLabel} appreciated your story`
      : notification.type === "comment" || notification.type === "reply"
      ? `${actorLabel} responded to your story`
      : "You have a new notification");

  const handleClick = () => {
    onOpen(notification);
  };

  return (
    <button
      type="button"
      className={`notifications-item${notification.isRead ? "" : " notifications-item--unread"}`}
      onClick={handleClick}
    >
      <span className="notifications-item__avatar" aria-hidden="true">
        <img src={avatar} alt="" />
      </span>
      <span className="notifications-item__body">
  <span className="notifications-item__message">{displayMessage}</span>
        <span className="notifications-item__meta">{formatDate(notification.createdAt)}</span>
      </span>
    </button>
  );
};

const STAFF_PICKS = [
  {
    author: "Malaynda Stewart, PhD, BCPA",
    title: "Repair Over Perfection: What I Learned When I Said the Wrong Thing",
    timeAgo: "5d ago",
  },
  {
    author: "jael holzman",
    title: "\u201cCan\u2019t believe I\u2019m just a dateline to my friends.\u201d",
    timeAgo: "Oct 26",
  },
  {
    author: "Jeff Maysh",
    title: "I Bought a Witches\u2019 Prison",
    timeAgo: "Oct 28, 2020",
    featured: true,
  },
];

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    loadMore,
  } = useSocketContext();

  const [activeTab, setActiveTab] = useState("all");

  const filteredNotifications = useMemo(() => {
    if (activeTab === "responses") {
      return notifications.filter((item) => item.type === "comment" || item.type === "reply");
    }
    return notifications;
  }, [notifications, activeTab]);

  const handleOpenNotification = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    const destination = notification.metadata?.postSlug
      ? `/post/${notification.metadata.postSlug}`
      : notification.post?.slug
      ? `/post/${notification.post.slug}`
      : null;

    if (destination) {
      navigate(destination);
    }
  };

  return (
    <div className="notifications-page">
      <header className="notifications-hero">
        <div className="notifications-hero__content">
          <h1>Notifications</h1>
          <p>Stay on top of who\u2019s reading, responding, and following your work.</p>
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} className="notifications-mark-all">
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <div className="notifications-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          className={`notifications-tab${activeTab === "all" ? " notifications-tab--active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All
          {activeTab === "all" && unreadCount > 0 && (
            <span className="notifications-tab__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "responses"}
          className={`notifications-tab${activeTab === "responses" ? " notifications-tab--active" : ""}`}
          onClick={() => setActiveTab("responses")}
        >
          Responses
        </button>
      </div>

      {error && <div className="notifications-alert">{error}</div>}

      <div className="notifications-layout">
        <section className="notifications-list" aria-live="polite">
          {loading && notifications.length === 0 && (
            <div className="notifications-empty">Loading your latest activity&hellip;</div>
          )}

          {!loading && filteredNotifications.length === 0 && (
            <div className="notifications-empty">
              <p>No notifications yet.</p>
              <p>When readers engage with your stories, you\u2019ll see updates here.</p>
            </div>
          )}

          {filteredNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpen={handleOpenNotification}
            />
          ))}

          {hasMore && (
            <button type="button" className="notifications-older" onClick={loadMore}>
              Older notifications
            </button>
          )}
        </section>

        <aside className="notifications-sidebar">
          <div className="notifications-card">
            <h2>Staff Picks</h2>
            <ul>
              {STAFF_PICKS.map((pick) => (
                <li key={pick.title}>
                  <p className="notifications-card__title">{pick.title}</p>
                  <p className="notifications-card__meta">
                    {pick.author}
                    {pick.featured && <span className="notifications-card__icon" aria-hidden="true">\u2605</span>}
                  </p>
                  <span className="notifications-card__time">{pick.timeAgo}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
