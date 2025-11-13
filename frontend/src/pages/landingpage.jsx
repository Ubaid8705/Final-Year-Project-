import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./landingpage.css";
import Suggesstion from "../Components/Suggesstion";
import Recomendations from "../Components/recomendations";
import FollowSuggestions from "../Components/followsuggestions";
import Notifications from "./notifications";
import PostsFeed from "../Components/PostsFeed";
import { useSocketContext } from "../contexts/SocketContext";
const FEED_FILTERS = [
  { id: "forYou", label: "For you" },
  { id: "featured", label: "Featured" },
];

const LandingPage = () => {
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [activeView, setActiveView] = useState("posts");
  const [postsSelection, setPostsSelection] = useState("forYou");
  const location = useLocation();
  const navigate = useNavigate();
  const socketContext = useSocketContext();
  const unreadCount = socketContext?.unreadCount ?? 0;

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
      <div className="side-content">
        <p>Staff Picks</p>
        <Suggesstion />
        <Suggesstion />
        <Suggesstion />
        <Suggesstion />
        <button
          className="suggestion-desc"
          onClick={() => alert("See the full list clicked!")}
        >
          See the full list
        </button>
        {showInfoBox && (
          <div className="info-box">
            <span
              className="info-close"
              onClick={() => setShowInfoBox(false)}
              title="Close"
            >
              &#10005;
            </span>
            <div className="info-title">Writing on Medium</div>
            <ul className="info-list">
              <li>New writer FAQ</li>
              <li>Expert writing advice</li>
              <li>Grow your readership</li>
            </ul>
            <button className="info-action" onClick={handleStartWriting}>Start writing</button>
          </div>
        )}
        <Recomendations />
        <button
          className="suggestion-desc"
          onClick={() => alert("See more topics clicked!")}
        >
          See more topics
        </button>
        <FollowSuggestions />
      </div>
    </div>
  );
};

export default LandingPage;