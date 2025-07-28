import React from "react";
import "./post.css";

function Post() {
  return (
    <div className="post-container">
      <div className="post-content">
        <div className="post-meta">
          <img
            src="https://randomuser.me/api/portraits/men/45.jpg"
            alt="author"
            className="post-author-img"
          />
          <span className="post-in">In Run.it.Bare by &lt;devtips/&gt;</span>
        </div>
        <h2 className="post-title">
          AI killed my coding brain but I’m rebuilding it
        </h2>
        <p className="post-desc">
          We sprinted into the AI age of autocomplete IDEs now we’re waking up
          wondering why we forgot how to write a for-loop.
        </p>
        <div className="post-footer">
          <div className="stats">
            <span className="post-date">&#11088; Jul 4</span>
            <span className="post-stats">&#128172; 5K</span>
            <span className="post-stats">&#128101; 240</span>
          </div>
          <div className="actions">
            <span className="post-actions">&#9711;</span>
            <span className="post-actions">&#43;</span>
            <span className="post-actions">&#8942;</span>
          </div>
        </div>
      </div>
      <div className="post-image">
        <img
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80"
          alt="post"
        />
      </div>
    </div>
  );
}

export default Post;
