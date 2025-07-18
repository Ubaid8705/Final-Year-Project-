import React from 'react';
import './header.css';

function Header() {
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
        />
      </div>
    </div>
  );
}

export default Header;