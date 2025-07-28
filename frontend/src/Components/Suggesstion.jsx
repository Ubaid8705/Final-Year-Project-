import React from 'react';
import './suggesstion.css';

const Suggesstion = () => (
  <div className="suggestion-post">
    <div className="suggestion-meta">
      <img
        src="https://cdn-icons-png.flaticon.com/512/25/25231.png"
        alt="logo"
        className="suggestion-logo"
      />
      <span className="suggestion-in">
        In The Riff by <span className="suggestion-author">Eric Dockett</span>
      </span>
    </div>
    <div className="suggestion-title">
      Ozzy Osbourne: Legacy of a Madman
    </div>
    <div className="suggestion-footer">
      <span className="suggestion-star">&#10022;</span>
      <span className="suggestion-date">Oct 25, 2024</span>
    </div>
    
  </div>
);

export default Suggesstion;