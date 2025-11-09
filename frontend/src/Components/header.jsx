import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./header.css";
import { useSocketContext } from "../contexts/SocketContext";

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;
const PREMIUM_BADGE = "\u2726"; // &#10022;

function Header() {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount = 0 } = useSocketContext() || {};

  const isAuthenticated = Boolean(user);
  const displayName = user?.name || user?.username || "Reader";
  const displayEmail = user?.email || "";
  const isPremium = Boolean(user?.membershipStatus);
  const fallbackAvatar = buildFallbackAvatar(displayName);
  const [avatarSrc, setAvatarSrc] = useState(user?.avatar || fallbackAvatar);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setAvatarSrc(user?.avatar || fallbackAvatar);
  }, [user, fallbackAvatar]);

  const toggleMenu = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setShowMenu((prev) => !prev);
  };

  const handleAvatarError = () => {
    setAvatarSrc(fallbackAvatar);
  };

  const handleWrite = () => {
    navigate(isAuthenticated ? "/write" : "/login");
  };

  const handleHome = () => {
    setShowMenu(false);
    navigate("/", { state: { view: "posts" } });
    window.dispatchEvent(new CustomEvent("landing:showPosts"));
  };

  const handleViewProfile = () => {
    setShowMenu(false);
    navigate(isAuthenticated ? "/profile" : "/login");
  };

  const handleSettings = () => {
    setShowMenu(false);
    navigate(isAuthenticated ? "/settings" : "/login");
  };

  const handleKeyActivate = (event, action) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  const handleLogout = () => {
    logout();
    setShowMenu(false);
    navigate("/login");
  };

  const handleNotifications = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setShowMenu(false);
    navigate("/", { state: { view: "notifications" } });
    window.dispatchEvent(new CustomEvent("landing:showNotifications"));
  };

  return (
    <div className="header">
      <div
        className="logo"
        role="button"
        tabIndex={0}
        onClick={handleHome}
        onKeyDown={(event) => handleKeyActivate(event, handleHome)}
      >
        BlogsHive
      </div>
      <div className="search-bar">
        <span className="search-icon">&#128269;</span>
        <input type="search" placeholder="Search" />
      </div>
      <div className="header-actions">
        <button className="write-btn" onClick={handleWrite}>
          <span className="write-icon">&#9998;</span> Write
        </button>
        {isAuthenticated && (
          <button
            type="button"
            className="bell-btn"
            onClick={handleNotifications}
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <span className="bell-icon" aria-hidden="true">
              &#128276;
            </span>
            {unreadCount > 0 && (
              <span className="bell-badge" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        )}
        {isAuthenticated ? (
          <img
            className="avatar"
            src={avatarSrc}
            alt="avatar"
            onClick={toggleMenu}
            onError={handleAvatarError}
            style={{ cursor: "pointer" }}
          />
        ) : (
          <button className="login-btn" onClick={() => navigate("/login")}>Sign in</button>
        )}
        {isAuthenticated && showMenu && (
          <div className="profile-menu" ref={menuRef}>
            <div className="profile-top">
              <img
                className="profile-avatar"
                src={avatarSrc}
                alt="avatar"
                onError={handleAvatarError}
              />
              <div>
                <div className="profile-name">
                  {displayName}
                  {isPremium && (
                    <span className="profile-name__star" aria-hidden="true">
                      {PREMIUM_BADGE}
                    </span>
                  )}
                </div>
                <div
                  className="profile-view clickable"
                  onClick={handleViewProfile}
                  tabIndex={0}
                  role="button"
                  style={{
                    cursor: "pointer",
                  }}
                >
                  View profile
                </div>
              </div>
            </div>
            <div className="profile-links-container">
              <div className="profile-link" onClick={handleWrite}>
                <span>&#9998;</span> Write
              </div>
              <div
                className="profile-link"
                onClick={handleNotifications}
                onKeyDown={(event) => handleKeyActivate(event, handleNotifications)}
                role="button"
                tabIndex={0}
              >
                <span>&#128276;</span> Notifications
                {unreadCount > 0 && <span className="profile-link__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </div>
              <div
                className="profile-link"
                onClick={handleSettings}
                onKeyDown={(event) => handleKeyActivate(event, handleSettings)}
                role="button"
                tabIndex={0}
              >
                <span>&#9881;</span> Settings
              </div>
              <div className="profile-link">
                <span>&#10067;</span> Help
              </div>
            </div>
            <div className="profile-divider"></div>
            <div className="profile-links">
              <div className="profile-link">
                <span style={{ color: "#f7b500" }}>&#11088;</span> Become a
                Medium member
              </div>
            </div>
            <div className="profile-divider"></div>
            <div className="profile-signout">
              <div className="profile-link" onClick={handleLogout}>
                Sign out
              </div>
              {displayEmail && <div className="profile-email">{displayEmail}</div>}
            </div>
            <div className="profile-footer">
              <span className="profile-footer-link">Home</span>
              <span className="profile-footer-link">Blog</span>
              <span className="profile-footer-link">About</span>
              <span className="profile-footer-link">Terms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Header;
