import React, { useEffect, useState } from "react";
import Post from "../Components/post";
import "./landingpage.css";
import Suggesstion from "../Components/Suggesstion";
import Recomendations from "../Components/recomendations";
import FollowSuggestions from "../Components/followsuggestions";
import { API_BASE_URL } from "../config";
import { mockPosts } from "../mocks/posts";

const LandingPage = () => {
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [posts, setPosts] = useState(mockPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPosts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/posts?limit=10`);
        if (!response.ok) {
          throw new Error("Failed to load stories");
        }

        const payload = await response.json();
        if (!cancelled && Array.isArray(payload?.items) && payload.items.length > 0) {
          setPosts(payload.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load stories");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-container">
      <div className="main-content">
        <div className="filter-bar">
          <span className="filter-icon">+</span>
          <button className="filter-btn active">For you</button>
          <button className="filter-btn">Following</button>
          <button className="filter-btn">
            Featured <span className="new-badge">New</span>
          </button>
          <button className="filter-btn">Data Science</button>
          <button className="filter-btn">Programming</button>
        </div>
        {loading && <p className="posts-status">Loading stories…</p>}
        {error && !loading && (
          <p className="posts-status" role="alert">
            {error}. Showing highlights instead.
          </p>
        )}
        {posts.map((post) => (
          <Post key={post.id || post.slug || post._id} post={post} />
        ))}
        {/* You can map more <Post /> components here */}
      </div>
      <div className="side-content">
        <p>Staff Picks</p>
        <Suggesstion />
        <Suggesstion />
        <Suggesstion />
        <Suggesstion />
        {/* Add more widgets or content here */}
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