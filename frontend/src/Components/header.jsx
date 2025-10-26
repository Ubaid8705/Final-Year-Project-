import React, { useState, useRef, useEffect } from "react";
import "./header.css";

function Header() {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();

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

  return (
    <div className="header">
      <div className="logo">Medium</div>
      <div className="search-bar">
        <span className="search-icon">&#128269;</span>
        <input type="search" placeholder="Search" />
      </div>
      <div className="header-actions">
        <button className="write-btn">
          <span className="write-icon">&#9998;</span> Write
        </button>
        <span className="bell-icon">&#128276;</span>
        <img
          className="avatar"
          src="https://randomuser.me/api/portraits/men/32.jpg"
          alt="avatar"
          onClick={() => setShowMenu((prev) => !prev)}
          style={{ cursor: "pointer" }}
        />
        {showMenu && (
          <div className="profile-menu" ref={menuRef}>
            <div className="profile-top">
              <img
                className="profile-avatar"
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="avatar"
              />
              <div>
                <div className="profile-name">Bilal Qamar</div>
                <div
                  className="profile-view clickable"
                  onClick={() => alert("View profile clicked!")}
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
              <div className="profile-link">
                <span>&#9998;</span> Write
              </div>
              <div className="profile-link">
                <span>&#128276;</span> Notifications
              </div>
              <div className="profile-link">
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
              <div className="profile-link">Sign out</div>
              <div className="profile-email">bi*********@gmail.com</div>
            </div>
            <div className="profile-footer">
              <span className="profile-footer-link">About</span>
              <span className="profile-footer-link">Blog</span>
              <span className="profile-footer-link">Privacy</span>
              <span className="profile-footer-link">Terms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Header;
