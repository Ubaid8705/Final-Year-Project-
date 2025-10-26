import React, { useState } from "react";
import "./postview.css";
import { Provider, ClapButton } from "@lyket/react";

function CustomClapButton({ id, namespace }) {
  const [isClapped, setIsClapped] = useState(false);
  const [clapCount, setClapCount] = useState(0);

  const handleClick = () => {
    if (isClapped) {
      setClapCount((prev) => Math.max(prev - 1, 0));
      setIsClapped(false);
    } else {
      setClapCount((prev) => prev + 1);
      setIsClapped(true);
    }
  };

  return (
    <div className="custom-clap-wrapper" onClick={handleClick}>
      <Provider apiKey="acc0dbccce8e557db5ebbe6d605aaa">
        <button
          className={`post-meta-btn clap-button ${isClapped ? "clapped" : ""}`}
        >
          👏 {clapCount}
        </button>
      </Provider>
    </div>
  );
}

function PostMeta({ author }) {
  if (!author) return null;
  return (
    <div className="post-meta">
      <div className="post-meta-left">
        <img
          src={author.avatar}
          alt={author.name}
          className="post-author-avatar"
        />
        <div className="post-author-info">
          <div className="post-author-row">
            <span className="post-author-name">{author.name}</span>
            <button className="post-follow-btn">Following ▾</button>
          </div>
          <div className="post-author-meta">
            <span>{author.readTime}</span>
            <span className="separator">•</span>
            <span>{author.date}</span>
          </div>
        </div>
      </div>

      <div className="post-meta-right">
        <div className="post-meta-actions">
          <CustomClapButton namespace="my-blog-post" id={`post-${author.id}`} />
          <button className="post-meta-btn">💬 {author.comments}</button>
        </div>
      </div>
    </div>
  );
}
// ...existing code...

function applyMarkups(text, markups = []) {
  if (!markups?.length) return text;

  const sorted = [...markups].sort((a, b) => a.start - b.start);
  const elements = [];
  let lastIndex = 0;

  sorted.forEach((markup, idx) => {
    if (markup.start > lastIndex)
      elements.push(text.slice(lastIndex, markup.start));

    const markedText = text.slice(markup.start, markup.end);

    let el = null;
    switch (markup.type) {
      case "bold":
        el = <strong key={idx}>{markedText}</strong>;
        break;
      case "italic":
        el = <em key={idx}>{markedText}</em>;
        break;
      case "underline":
        el = <u key={idx}>{markedText}</u>;
        break;
      case "highlight":
        el = <mark key={idx}>{markedText}</mark>;
        break;
      case "code":
        el = <code key={idx}>{markedText}</code>;
        break;
      case "link":
        el = (
          <a
            key={idx}
            href={markup.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {markedText}
          </a>
        );
        break;
      default:
        el = markedText;
    }

    elements.push(el);
    lastIndex = markup.end;
  });

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

function renderBlock(block, idx) {
  if (!block) return null;
  const key = block.id || idx;

  switch (block.type) {
    case "P":
      return (
        <p key={key} className="post-paragraph">
          {applyMarkups(block.text, block.markups)}
        </p>
      );

    case "H1":
      return (
        <h1 key={key} className="post-heading-1">
          {block.text}
        </h1>
      );

    case "H2":
      return (
        <h2 key={key} className="post-heading-2">
          {block.text}
        </h2>
      );

    case "UL":
      return (
        <ul key={key} className="post-list">
          {block.items.map((item, i) => (
            <li key={i}>{applyMarkups(item.text, item.markups)}</li>
          ))}
        </ul>
      );

    case "OL":
      return (
        <ol key={key} className="post-list ordered">
          {block.items.map((item, i) => (
            <li key={i}>{applyMarkups(item.text, item.markups)}</li>
          ))}
        </ol>
      );

    case "DIVIDER":
      return <hr key={key} className="post-divider" />;

    case "IMG":
      return (
        <figure key={key} className="post-image-container">
          <img
            src={block.image?.url}
            alt={block.image?.alt}
            className="post-image"
          />
          {block.image?.caption && (
            <figcaption className="post-image-caption">
              {block.image.caption}
            </figcaption>
          )}
        </figure>
      );

    case "VIDEO":
      return (
        <div key={key} className="post-video">
          <video
            controls
            width={block.video?.width || "100%"}
            poster={block.video?.thumbnail}
          >
            <source src={block.video?.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {block.video?.title && (
            <p className="post-video-title">{block.video.title}</p>
          )}
        </div>
      );

    case "CODE":
      return (
        <pre key={key} className="post-code-block">
          <code>{block.codeBlock}</code>
        </pre>
      );

    case "BLOCKQUOTE":
    case "blockquote":
      return (
        <blockquote key={key} className="post-blockquote">
          {applyMarkups(block.text, block.markups)}
        </blockquote>
      );

    default:
      return null;
  }
}

const samplePost = {
  title: "Building a Dynamic Blog System Like Medium",
  subtitle:
    "Implementing inline markups, media embeds, and structured content blocks",
  coverImage:
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200",
  content: [
    {
      id: 1,
      type: "H1",
      text: "Introduction",
    },
    {
      id: 2,
      type: "P",
      text: "In this guide, we’ll show you how to create a full-featured blog system using React and Node.js — with inline markups like bold, italic, highlight, and links.",
      markups: [
        { type: "bold", start: 46, end: 66 },
        { type: "italic", start: 68, end: 73 },
        { type: "highlight", start: 75, end: 84 },
        { type: "link", start: 90, end: 100, href: "https://react.dev" },
      ],
    },
    {
      id: 3,
      type: "DIVIDER",
    },
    {
      id: 4,
      type: "H2",
      text: "Core Features",
    },
    {
      id: 5,
      type: "UL",
      items: [
        {
          text: "Inline markups with start/end positions",
          markups: [{ type: "bold", start: 0, end: 6 }],
        },
        { text: "Video and image embeds" },
        { text: "Ordered and unordered lists" },
      ],
    },
    {
      id: 6,
      type: "IMG",
      image: {
        url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900",
        alt: "Blog editor screenshot",
        caption: "A blog editor supporting markups and media",
      },
    },
    {
      id: 7,
      type: "VIDEO",
      video: {
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        title: "Demo: Blog post rendering system",
        thumbnail:
          "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=800",
      },
    },
    {
      id: 8,
      type: "OL",
      items: [
        { text: "Initialize project and install dependencies" },
        { text: "Add editor for writing posts" },
        { text: "Save blocks with markups in MongoDB" },
      ],
    },
    {
      id: 9,
      type: "CODE",
      codeBlock: `npm create vite@latest blog-app
cd blog-app
npm install
npm run dev`,
    },
    {
      id: 10,
      type: "P",
      text: "With these tools, your blog can handle rich text and structured content seamlessly.",
    },
    {
      id: 11,
      type: "BLOCKQUOTE",
      text: "“Happy blogging! Build, write, and share your knowledge.”",
      markups: [{ type: "italic", start: 1, end: 15 }],
    },
  ],
};

const sampleAuthor = {
  name: "Richard Anton",
  avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  readTime: "21 min read",
  date: "3 days ago",
  claps: 25,
  comments: 1,
};

export default function PostView({ post = samplePost }) {
  if (!post) return <div className="post-loading">Loading...</div>;

  return (
    <article className="post-container">
      <header className="post-header">
        <h1 className="post-title">{post.title}</h1>
        {post.subtitle && <h2 className="post-subtitle">{post.subtitle}</h2>}

        {/* 👇 Author Metadata Section */}
        <PostMeta author={sampleAuthor} />

        {post.coverImage && (
          <div className="post-cover-image">
            <img src={post.coverImage} alt="cover" />
          </div>
        )}
      </header>

      <div className="post-content">
        {Array.isArray(post.content) &&
          post.content.map((block, idx) => renderBlock(block, idx))}
      </div>
    </article>
  );
}
