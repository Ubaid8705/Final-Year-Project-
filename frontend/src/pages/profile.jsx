import React from "react";
import { useState } from "react";
import listImg from "../resources/list.jpg";
import "./profile.css";

export default function Profile() {
  const [showEdit, setShowEdit] = useState(false);
  return (
    <div className="profile-container">
      <div className="profile-main-area">
        <div className="profile-banner">
          <img
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y292ZXJ8ZW58MHx8MHx8fDA%3D&w=1000&q=80"
            alt="cover"
            className="profile-cover"
          />
        </div>
        <div className="profile-main">
          <h1 className="profile-username">Ubaid Malik</h1>
          <div className="profile-tabs">
            <span className="profile-tab active">Home</span>
            <span className="profile-tab">Lists</span>
            <span className="profile-tab">About</span>
          </div>
          <hr />
          <div className="profile-story">
            <div className="story-title">Introduction</div>
            <div className="story-desc">
              I am Ubaidullah.
            </div>
            <div className="story-footer">
              <div className="story-time">Just now</div>
              <div className="story-actions">
                {/* Save post icon */}
                <span title="Save post">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M6 3h10a1 1 0 0 1 1 1v15l-6-4-6 4V4a1 1 0 0 1 1-1z"
                      stroke="#757575"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </span>
                {/* Horizontal 3-dot icon */}
                <span title="More options">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <circle cx="6" cy="11" r="1.5" fill="#757575" />
                    <circle cx="11" cy="11" r="1.5" fill="#757575" />
                    <circle cx="16" cy="11" r="1.5" fill="#757575" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="profile-sidebar">
        <img
          src="https://randomuser.me/api/portraits/men/32.jpg"
          alt="avatar"
          className="profile-avatar-sidebar"
        />
        <div className="profile-sidebar-name">
          Ubaid Malik <span className="profile-pronoun">he/him</span>
        </div>
        <div className="profile-sidebar-followers">1 follower</div>
        <div className="profile-sidebar-bio">
          I am a Computer Science fresh graduate from NCBA Lahore.
        </div>
        <button className="profile-edit-btn" onClick={() => setShowEdit(true)}>
          Edit profile
        </button>
        <div className="profile-lists">
          <div className="profile-list-title">Lists</div>
          <div className="profile-list-item">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQB2tmDDUAArMs-GzV0YL30xdUNwO9yGRAj4Q&s" alt="list" className="profile-list-img" />
            <div className="profile-list-info">
              <div className="profile-list-name">Reading list</div>
              <div className="profile-list-count">2 stories</div>
            </div>
          </div>
          <div className="profile-list-viewall">View All</div>
        </div>
        <div className="profile-footer-links">
          <span>Help</span>
          <span>About</span>
          <span>Blog</span>
          <span>Privacy</span>
          <span>Rules</span>
          <span>Terms</span>
        </div>
      </div>
      {showEdit && (
        <div className="profile-modal-overlay">
          <div className="profile-modal">
            <span
              className="profile-modal-close"
              onClick={() => setShowEdit(false)}
              title="Close"
            >
              &#10005;
            </span>
            <h2 className="profile-modal-title">Profile information</h2>
            <div className="profile-modal-photo">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="avatar"
                className="profile-modal-avatar"
              />
              <div className="profile-modal-photo-actions">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "1vw",
                    marginBottom: "1vh",
                    marginLeft: "1vw",
                  }}
                >
                  <span className="profile-modal-update">Update</span>
                  <span className="profile-modal-remove">Remove</span>
                </div>
                <div className="profile-modal-photo-desc">
                  Recommended: Square JPG, PNG, or GIF, at least 1,000 pixels
                  per side.
                </div>
              </div>
            </div>
            <label className="profile-modal-label">Name*</label>
            <input
              className="profile-modal-input"
              type="text"
              defaultValue="Ubaid Malik"
              maxLength={50}
            />
            <div className="profile-modal-count">11/50</div>
            <label className="profile-modal-label">Pronouns</label>
            <div className="profile-modal-pronouns">
              <span className="profile-modal-pronoun">he</span>
              <span className="profile-modal-pronoun">him</span>
              <input
                className="profile-modal-input"
                type="text"
                placeholder="Add..."
                maxLength={10}
              />
            </div>
            <div className="profile-modal-count">2/4</div>
            <label className="profile-modal-label">Short bio</label>
            <textarea
              className="profile-modal-textarea"
              defaultValue="I am a Computer Science fresh graduate from NCBA Lahore."
              maxLength={160}
            />
            <div className="profile-modal-count">92/160</div>
            <label className="profile-modal-label">About Page</label>
            <div className="profile-modal-about">
              Personalize with images and more to paint more of a vivid portrait
              of yourself than your 'Short bio'.
              <span className="profile-modal-edit-about">&#9998;</span>
            </div>
            <div className="profile-modal-actions">
              <button
                className="profile-modal-cancel"
                onClick={() => setShowEdit(false)}
              >
                Cancel
              </button>
              <button className="profile-modal-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
