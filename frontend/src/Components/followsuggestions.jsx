import React from 'react';
import './followsuggestions.css';

const suggestions = [
  {
    name: "Jim the AI Whisperer",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    info: "🧑‍💻 7x Top Writer. 39x Boosted. AI Whisperer &...",
    desc: "",
  },
  {
    name: "Mac O'Clock",
    avatar: "https://cdn-icons-png.flaticon.com/512/732/732212.png",
    info: "Publication",
    desc: "The best stories for Apple owners and enthusiasts",
  },
  {
    name: "Sandesh | DevOps | AWS | K8",
    avatar: "https://randomuser.me/api/portraits/men/65.jpg",
    info: "",
    desc: "Hi, I'm Sandesh—a DevOps Engineer with 5...",
  },
];

const FollowSuggestions = () => (
  <div className="follow-section">
    <div className="follow-title">Who to follow</div>
    <ul className="follow-list">
      {suggestions.map((s, i) => (
        <li key={i} className="follow-item">
          <img src={s.avatar} alt={s.name} className="follow-avatar" />
          <div className="follow-details">
            <div className="follow-name">{s.name}</div>
            {s.info && <div className="follow-info">{s.info}</div>}
            {s.desc && <div className="follow-desc">{s.desc}</div>}
          </div>
          <button className="follow-btn">Follow</button>
        </li>
      ))}
    </ul>
    <button className="follow-more" onClick={() => alert("See more suggestions clicked!")}>
      See more suggestions
    </button>
  </div>
);

export default FollowSuggestions;