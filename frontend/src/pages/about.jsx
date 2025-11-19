import React from "react";
import { useNavigate } from "react-router-dom";
import "./about.css";

const AboutPage = () => {
  const navigate = useNavigate();

  const handleStartWriting = () => {
    navigate("/write");
  };

  const handleExploreTopics = () => {
    navigate("/topics");
  };

  return (
    <div className="about-page">
      <header className="about-hero">
        <p className="about-eyebrow">About BlogsHive</p>
        <h1 className="about-title">Everyone has a story to tell</h1>
        <p className="about-lede">
          BlogsHive is a home for human stories and ideas. Here, anyone can share
          knowledge and wisdom with the world—without having to build a mailing list or
          a following first. The internet is noisy and chaotic; BlogsHive is quiet yet
          full of insight. It’s simple, beautiful, collaborative, and helps you find the
          right readers for whatever you have to say.
        </p>
        <div className="about-cta">
          <button type="button" className="about-cta__primary" onClick={handleStartWriting}>
            Start writing
          </button>
          <button type="button" className="about-cta__secondary" onClick={handleExploreTopics}>
            Explore topics
          </button>
        </div>
      </header>

      <section className="about-section">
        <div className="about-section__content">
          <h2>Writing that deepens our understanding</h2>
          <p>
            Ultimately, our goal is to deepen our collective understanding of the world through
            the power of writing.
          </p>
        </div>
        <div className="about-highlights">
          <article className="about-highlight">
            <h3>Craft matters</h3>
            <p>
              We believe that what you read and write matters. Words can divide or empower us,
              inspire or discourage us. In a world where the most sensational and surface-level
              stories often win, we’re building a system that rewards depth, nuance, and time well spent.
            </p>
          </article>
          <article className="about-highlight">
            <h3>Conversation, not noise</h3>
            <p>
              BlogsHive is a space for thoughtful conversation more than drive-by takes, and
              substance over packaging. We surface voices that make you think, not just scroll.
            </p>
          </article>
        </div>
      </section>

      <section className="about-grid about-grid--two-column">
        <article className="about-card">
          <h2>A global community of curious minds</h2>
          <p>
            Over 100 million people connect and share their wisdom on BlogsHive every month. They’re
            software developers, amateur novelists, product designers, CEOs, and anyone burning
            with a story they need to get out into the world.
          </p>
          <p>
            They write about what they’re working on, what’s keeping them up at night, what they’ve
            lived through, and what they’ve learned that the rest of us might want to know too.
          </p>
        </article>
        <aside className="about-card about-card--stats" aria-label="Community snapshot">
          <ul>
            <li>
              <span className="about-card__metric">100M+</span>
              <span className="about-card__label">monthly readers discovering new perspectives</span>
            </li>
            <li>
              <span className="about-card__metric">1M+</span>
              <span className="about-card__label">members supporting creators directly</span>
            </li>
            <li>
              <span className="about-card__metric">195</span>
              <span className="about-card__label">countries represented across BlogsHive</span>
            </li>
          </ul>
        </aside>
      </section>

      <section className="about-section about-section--inverted">
        <div className="about-section__content">
          <h2>Powered by membership, not ads</h2>
          <p>
            Instead of selling ads or selling your data, we’re supported by a growing community of
            over a million BlogsHive members who believe in our mission.
          </p>
          <p>
            If you’re new here, start reading. Dive deeper into whatever matters to you. Find a post
            that helps you learn something new, or reconsider something familiar—and then write your story.
          </p>
        </div>
        <div className="about-membership">
          <div className="about-membership__point">
            <span className="about-membership__icon" aria-hidden="true">&#128214;</span>
            <div>
              <h3>Read with intention</h3>
              <p>Follow the ideas and authors that expand your thinking and keep you inspired.</p>
            </div>
          </div>
          <div className="about-membership__point">
            <span className="about-membership__icon" aria-hidden="true">&#9998;</span>
            <div>
              <h3>Write with confidence</h3>
              <p>Publish in minutes, get feedback, and tap into an audience ready for depth over hype.</p>
            </div>
          </div>
          <div className="about-membership__point">
            <span className="about-membership__icon" aria-hidden="true">&#128161;</span>
            <div>
              <h3>Build lasting connections</h3>
              <p>Collaborate with readers and writers who care about the same topics you do.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-closing">
        <h2>Ready to share your perspective?</h2>
        <p>
          Join a community that values curiosity, nuance, and stories that stay with you.
          Your next idea could be exactly what someone out there needs.
        </p>
        <div className="about-cta about-cta--centered">
          <button type="button" className="about-cta__primary" onClick={handleStartWriting}>
            Start writing today
          </button>
          <button type="button" className="about-cta__secondary" onClick={handleExploreTopics}>
            Find stories to read
          </button>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
