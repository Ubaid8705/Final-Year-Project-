import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./header.css";
import { useSocketContext } from "../contexts/SocketContext";
import { API_BASE_URL } from "../config";

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;
const PREMIUM_BADGE = "\u2726"; // &#10022;

function Header() {
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("posts"); // "posts" or "authors"
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const menuRef = useRef();
  const searchRef = useRef();
  const searchRequestRef = useRef(0);
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
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
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

  const handleAbout = () => {
    setShowMenu(false);
    navigate("/about");
  };

  const handleTerms = () => {
    setShowMenu(false);
    navigate("/terms");
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

  const handleSearch = async (query, typeOverride) => {
    const nextToken = searchRequestRef.current + 1;
    searchRequestRef.current = nextToken;

    const activeType = typeOverride || searchType;
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const endpoint = activeType === "posts"
        ? `${API_BASE_URL}/api/posts/search?q=${encodeURIComponent(trimmedQuery)}`
        : `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(trimmedQuery)}`;
      
      const response = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (searchRequestRef.current !== nextToken) {
          return;
        }
        const resultsKey = activeType === "posts" ? "posts" : "users";
        const normalizedResults = Array.isArray(data[resultsKey])
          ? data[resultsKey]
          : Array.isArray(data.results)
          ? data.results
          : [];
        setSearchResults(normalizedResults);
      } else {
        if (searchRequestRef.current === nextToken) {
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
      if (searchRequestRef.current === nextToken) {
        setSearchResults([]);
      }
    } finally {
      if (searchRequestRef.current === nextToken) {
        setIsSearching(false);
      }
    }
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim()) {
      handleSearch(value);
    } else {
      setSearchResults([]);
    }
  };

  const handleSearchFocus = () => {
    setShowSearchDropdown(true);
  };

  const handleSearchTypeToggle = (type) => {
    if (type === searchType) {
      return;
    }

    setSearchType(type);
    setSearchResults([]);

    if (searchQuery.trim()) {
      handleSearch(searchQuery, type);
    }
  };

  const handleResultClick = (result) => {
    setShowSearchDropdown(false);
    setSearchQuery("");
    setSearchResults([]);

    if (searchType === "posts") {
      const targetId = result.slug || result.id || result._id;
      if (targetId) {
        navigate(`/post/${targetId}`);
      }
      return;
    }

    const targetUsername = result.username;
    if (!targetUsername) {
      return;
    }

    if (user?.username && user.username === targetUsername) {
      navigate("/profile");
    } else {
      navigate(`/u/${targetUsername}`);
    }
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
      <div className="search-bar" ref={searchRef}>
        <span className="search-icon">&#128269;</span>
        <input 
          type="search" 
          placeholder="Search" 
          value={searchQuery}
          onChange={handleSearchInput}
          onFocus={handleSearchFocus}
        />
        {showSearchDropdown && (
          <div className="search-dropdown">
            <div className="search-type-toggle">
              <button 
                className={`search-type-btn ${searchType === "posts" ? "active" : ""}`}
                onClick={() => handleSearchTypeToggle("posts")}
              >
                Posts
              </button>
              <button 
                className={`search-type-btn ${searchType === "authors" ? "active" : ""}`}
                onClick={() => handleSearchTypeToggle("authors")}
              >
                Authors
              </button>
            </div>
            {isSearching && (
              <div className="search-loading">Searching...</div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => {
                  const key = `${searchType}-${result.id || result._id || result.slug || result.username || result.title}`;
                  const displayName = result.name || result.username || "Author";
                  const avatarSource = result.avatar || buildFallbackAvatar(displayName);
                  const authorLabel = result.author?.name || result.author?.username || "Unknown author";

                  return (
                    <div
                      key={key}
                      className={`search-result-item ${searchType === "authors" ? "search-result-item--user" : "search-result-item--post"}`}
                      onClick={() => handleResultClick(result)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => handleKeyActivate(event, () => handleResultClick(result))}
                    >
                      {searchType === "posts" ? (
                        <div className="search-result-post">
                          <div className="search-result-title">{result.title}</div>
                          {result.subtitle && (
                            <div className="search-result-subtitle">{result.subtitle}</div>
                          )}
                          <div className="search-result-author">by {authorLabel}</div>
                        </div>
                      ) : (
                        <>
                          <img
                            src={avatarSource}
                            alt={displayName}
                            className="search-result-avatar"
                            onError={(e) => {
                              e.target.src = buildFallbackAvatar(displayName);
                            }}
                          />
                          <div className="search-result-user-info">
                            <div className="search-result-name">
                              {displayName}
                              {result.membershipStatus && (
                                <span className="search-result-premium">{PREMIUM_BADGE}</span>
                              )}
                            </div>
                            <div className="search-result-username">@{result.username}</div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
              <div className="search-no-results">No results found</div>
            )}
          </div>
        )}
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
              <span
                className="profile-footer-link"
                onClick={handleHome}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleKeyActivate(event, handleHome)}
              >
                Home
              </span>
              <span className="profile-footer-link">Blog</span>
              <span
                className="profile-footer-link"
                onClick={handleAbout}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleKeyActivate(event, handleAbout)}
              >
                About
              </span>
              <span
                className="profile-footer-link"
                onClick={handleTerms}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleKeyActivate(event, handleTerms)}
              >
                Terms
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Header;
