import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./landingpage.css";
import Suggesstion from "../Components/Suggesstion";
import Recomendations from "../Components/recomendations";
import FollowSuggestions from "../Components/followsuggestions";
import Notifications from "./notifications";
import PostsFeed from "../Components/PostsFeed";
import { useSocketContext } from "../contexts/SocketContext";

const FILTERS = [
  { id: "forYou", label: "For you" },
  { id: "following", label: "Following" },
  { id: "featured", label: "Featured", badge: "New" },
  { id: "dataScience", label: "Data Science" },
  { id: "programming", label: "Programming" },
];

const LandingPage = () => {
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [activeView, setActiveView] = useState("posts");
  const location = useLocation();
  const navigate = useNavigate();
  const socketContext = useSocketContext();
  const unreadCount = socketContext?.unreadCount ?? 0;

  useEffect(() => {
    const handleShowPosts = () => {
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

    if (view === "notifications") {
      setActiveView("notifications");
    } else {
      setActiveView("posts");
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location, navigate]);

  const handleNotificationsClick = () => {
    setActiveView("notifications");
  };

  const isNotificationsView = activeView === "notifications";

  return (
    <div className="landing-container">
      <div className="main-content">
        <div className="filter-bar">
          <span className="filter-icon">+</span>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`filter-btn${
                !isNotificationsView && filter.id === "forYou" ? " active" : ""
              }`}
              onClick={() => setActiveView("posts")}
            >
              {filter.label}
              {filter.badge && <span className="new-badge">{filter.badge}</span>}
            </button>
          ))}
          <button
            type="button"
            className={`filter-btn filter-btn--notifications ${isNotificationsView ? "active" : ""}`}
            onClick={handleNotificationsClick}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="filter-btn__badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {isNotificationsView ? <Notifications showSidebar={false} embedded /> : <PostsFeed />}
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
            <button className="info-action">Start writing</button>
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