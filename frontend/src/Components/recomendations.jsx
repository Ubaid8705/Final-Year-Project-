import React from 'react';
import './recomendations.css';

const topics = [
  "Self Improvement",
  "Politics",
  "Writing",
  "Relationships",
  "Cryptocurrency",
  "Productivity",
  "Python"
];

const Recomendations = () => (
  <div className="recomendations-section">
    <div className="recomendations-title">Recommended topics</div>
    <div className="recomendations-list">
      {topics.map(topic => (
        <span key={topic} className="recomendation-chip">{topic}</span>
      ))}
    </div>
  </div>
);

export default Recomendations;