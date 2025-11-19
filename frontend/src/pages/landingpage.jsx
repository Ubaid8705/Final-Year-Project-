import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./landingpage.css";
import Suggesstion from "../Components/Suggesstion";
import Recomendations from "../Components/recomendations";
import FollowSuggestions from "../Components/followsuggestions";
import Notifications from "./notifications";
import PostsFeed from "../Components/PostsFeed";
import { useSocketContext } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
const FEED_FILTERS = [
  { id: "forYou", label: "For you" },
  { id: "featured", label: "Featured" },
];

const LandingPage = () => {
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [activeView, setActiveView] = useState("posts");
  const [postsSelection, setPostsSelection] = useState("forYou");
  const [premiumUsers, setPremiumUsers] = useState([]);
  const [loadingPremium, setLoadingPremium] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const socketContext = useSocketContext();
  const { token } = useAuth();
  const unreadCount = socketContext?.unreadCount ?? 0;

  const fetchPremiumUsers = useCallback(async () => {
    setLoadingPremium(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/premium?limit=3`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && Array.isArray(data.premiumUsers)) {
        setPremiumUsers(data.premiumUsers);
      }
    } catch (error) {
      console.error('Failed to load premium users:', error);
    } finally {
      setLoadingPremium(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPremiumUsers();
  }, [fetchPremiumUsers]);

  useEffect(() => {
    const handleShowPosts = (event) => {
      const selectionFromEvent = event?.detail?.selection;
      if (selectionFromEvent === "forYou" || selectionFromEvent === "featured") {
        setPostsSelection(selectionFromEvent);
      }
      setActiveView("posts");
    };

    const handleShowNotifications = () => {
      setActiveView("notifications");
    };

    window.addEventListener("landing:showPosts", handleShowPosts);
    window.addEventListener("landing:showNotifications", handleShowNotifications);

    return () => {
      window.removeEventListener("landing:showPosts", handleShowPosts);
      window.removeEventListener("landing:showNotifications", handleShowNotifications);
    };
  }, []);

  useEffect(() => {
    if (!location?.state || !location.state.view) {
      return;
    }

    const view = location.state.view === "notifications" ? "notifications" : "posts";

    const selectionFromState = location.state.selection;
    if (selectionFromState === "forYou" || selectionFromState === "featured") {
      setPostsSelection(selectionFromState);
    }

    if (view === "notifications") {
      setActiveView("notifications");
    } else {
      setActiveView("posts");
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location, navigate]);

  // const handleNotificationsClick = () => {
  //   setActiveView("notifications");
  // };
  const handleStartWriting = () => {
    navigate("/create-post");
  }

  const isNotificationsView = activeView === "notifications";

  return (
    <div className="landing-container">
      <div className="main-content">
        {!isNotificationsView && (
          <div className="feed-toggle-bar" role="toolbar" aria-label="Story filters">
            <div className="feed-toggle-group" role="group" aria-label="Feed options">
              {FEED_FILTERS.map((filter) => {
                const active = postsSelection === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`feed-toggle-btn${active ? " feed-toggle-btn--active" : ""}`}
                    onClick={() => {
                      setPostsSelection(filter.id);
                      setActiveView("posts");
                    }}
                    aria-pressed={active}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            {/* <button
              type="button"
              className={`feed-toggle-btn feed-toggle-btn--notifications${isNotificationsView ? " feed-toggle-btn--active" : ""}`}
              onClick={handleNotificationsClick}
              aria-pressed={isNotificationsView}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="feed-toggle-btn__badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button> */}
          </div>
        )}

        {isNotificationsView ? (
          <div className="notifications-wrapper">
            <div className="notifications-toolbar">
              <button
                type="button"
                className="notifications-toolbar__button"
                onClick={() => setActiveView("posts")}
              >
                Back to stories
              </button>
              {unreadCount > 0 && (
                <span className="notifications-toolbar__badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <Notifications showSidebar={false} embedded />
          </div>
        ) : (
          <PostsFeed selection={postsSelection} />
        )}
      </div>
      <aside className="side-content" aria-label="Additional recommendations">
        <section className="side-card" aria-live="polite">
          <h2 className="side-card__title">Staff Picks</h2>
          {loadingPremium ? (
            <div className="suggestion-loading">Loading premium members...</div>
          ) : premiumUsers.length > 0 ? (
            premiumUsers.map((item) => (
              <Suggesstion key={item.user.id} user={item.user} stats={item.stats} />
            ))
          ) : (
            <div className="suggestion-empty">No premium members available</div>
          )}
          <button
            className="suggestion-desc side-card__link"
            type="button"
            onClick={() => alert("See the full list clicked!")}
          >
            See the full list
          </button>
        </section>

        {showInfoBox && (
          <section className="side-card side-card--highlight">
            <button
              className="info-close"
              type="button"
              onClick={() => setShowInfoBox(false)}
              title="Hide writing tips"
              aria-label="Hide writing tips"
            >
              &#10005;
            </button>
            <h3 className="info-title">Writing on Medium</h3>
            <ul className="info-list">
              <li>New writer FAQ</li>
              <li>Expert writing advice</li>
              <li>Grow your readership</li>
            </ul>
            <button className="info-action" type="button" onClick={handleStartWriting}>Start writing</button>
          </section>
        )}

        <section className="side-card">
          <Recomendations />
          <button
            className="suggestion-desc side-card__link"
            type="button"
            onClick={() => alert("See more topics clicked!")}
          >
            See more topics
          </button>
        </section>

        <section className="side-card">
          <FollowSuggestions />
        </section>
      </aside>
    </div>
  );
};

export default LandingPage;