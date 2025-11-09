const TOPIC_SOURCE = [
  { label: "Self Improvement", slug: "self-improvement" },
  { label: "Politics", slug: "politics" },
  { label: "Writing", slug: "writing" },
  { label: "Relationships", slug: "relationships" },
  { label: "Cryptocurrency", slug: "cryptocurrency" },
  { label: "Productivity", slug: "productivity" },
  { label: "Python", slug: "python" },
  { label: "Programming", slug: "programming" },
  { label: "Data Science", slug: "data-science" },
  { label: "Technology", slug: "technology" },
  { label: "Design", slug: "design" },
  { label: "Machine Learning", slug: "machine-learning" },
];

export const RECOMMENDED_TOPICS = TOPIC_SOURCE;

export const DEFAULT_FEED_TOPICS = [
  "self-improvement",
  "programming",
  "data-science",
  "productivity",
  "writing",
];

export const normalizeTopicSlug = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const findTopicBySlug = (slug) => {
  const normalized = normalizeTopicSlug(slug);
  if (!normalized) {
    return null;
  }

  return RECOMMENDED_TOPICS.find((topic) => topic.slug === normalized) || null;
};

export const formatTopicLabel = (slug) => {
  const definition = findTopicBySlug(slug);
  if (definition) {
    return definition.label;
  }

  const normalized = normalizeTopicSlug(slug);
  if (!normalized) {
    return "";
  }

  return normalized
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const sortTopicsAlphabetically = (topicSlugs = []) => {
  return [...topicSlugs]
    .map((slug) => normalizeTopicSlug(slug))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort((a, b) => formatTopicLabel(a).localeCompare(formatTopicLabel(b)));
};
