import React, { useMemo, useState } from "react";
import Post from "../Components/post";
import { useAuth } from "../contexts/AuthContext";
import { mockPosts } from "../mocks/posts";
import "./profile.css";

const COVER_FALLBACK =
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1440&q=80";
const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "Reader")}`;

const Profile = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  const displayName = user?.name || user?.username || "Your profile";
  const pronouns = Array.isArray(user?.pronouns) && user.pronouns.length > 0 ? user.pronouns.join("/") : "he/him";
  const bio = user?.bio || "Share a short introduction so readers know what to expect from you.";
  const location = user?.location || "Lahore, Pakistan";
  const followers = user?.followersCount ?? 1;
  const following = user?.followingCount ?? 0;
  const avatar = user?.avatar || buildFallbackAvatar(displayName);
  const coverImage = user?.coverImage || COVER_FALLBACK;

  const featureLists = useMemo(
    () => [
      {
        id: "reading",
        title: "Reading list",
        count: 3,
        cover:
          "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=320&q=80",
      },
      {
        id: "design",
        title: "Design inspiration",
        count: 5,
        cover:
          "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=320&q=80",
      },
    ],
    []
  );

  const recentPosts = useMemo(() => mockPosts.slice(0, 4), []);

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <img src={coverImage} alt="Profile banner" />
        <div className="profile-hero__overlay" />
      </div>
      <div className="profile-shell">
        <main className="profile-main">
          <section className="profile-header-card">
            <div className="profile-header-card__grid">
              <div className="profile-header-card__primary">
                <h1>{displayName}</h1>
                <p className="profile-header-card__intro">{bio}</p>
                <div className="profile-header-card__meta">
                  <span>{pronouns}</span>
                  <span>{location}</span>
                  <span>
                    <strong>{followers}</strong> follower{followers === 1 ? "" : "s"}
                  </span>
                  <span>
                    <strong>{following}</strong> following
                  </span>
                </div>
              </div>
              <div className="profile-header-card__actions">
                <button type="button" className="profile-button primary">
                  Edit profile
                </button>
                <button type="button" className="profile-button ghost">
                  Share profile
                </button>
              </div>
            </div>
            <nav className="profile-tabs">
              {[
                { id: "home", label: "Home" },
                { id: "lists", label: "Lists" },
                { id: "about", label: "About" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`profile-tab${activeTab === tab.id ? " profile-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </section>

          <section className="profile-feed">
            {recentPosts.map((post) => (
              <Post key={post.id} post={post} variant="profile" />
            ))}
          </section>
        </main>

        <aside className="profile-aside">
          <div className="profile-card">
            <img src={avatar} alt={displayName} className="profile-card__avatar" />
            <div className="profile-card__details">
              <h2>{displayName}</h2>
              <p className="profile-card__role">{pronouns}</p>
              <p className="profile-card__bio">{bio}</p>
            </div>
            <button type="button" className="profile-button full">
              Edit profile
            </button>
          </div>

          <div className="profile-card">
            <h3 className="profile-card__heading">Lists</h3>
            <div className="profile-list-grid">
              {featureLists.map((item) => (
                <article className="profile-list-card" key={item.id}>
                  <img src={item.cover} alt={item.title} />
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.count} stor{item.count === 1 ? "y" : "ies"}</p>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className="profile-button ghost full">
              View all lists
            </button>
          </div>

          <div className="profile-links">
            {["Help", "About", "Blog", "Privacy", "Terms", "Text to speech"].map((link) => (
              <button key={link} type="button">
                {link}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Profile;
