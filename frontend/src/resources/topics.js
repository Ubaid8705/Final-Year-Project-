const TOPIC_SOURCE = [
  { label: "Artificial Intelligence", slug: "artificial-intelligence" },
  { label: "Business", slug: "business" },
  { label: "Creativity", slug: "creativity" },
  { label: "Culture", slug: "culture" },
  { label: "Cryptocurrency", slug: "cryptocurrency" },
  { label: "Data Science", slug: "data-science" },
  { label: "Design", slug: "design" },
  { label: "Health & Wellness", slug: "health" },
  { label: "Investing", slug: "investing" },
  { label: "Leadership", slug: "leadership" },
  { label: "Machine Learning", slug: "machine-learning" },
  { label: "Marketing", slug: "marketing" },
  { label: "Mental Health", slug: "mental-health" },
  { label: "Mindfulness", slug: "mindfulness" },
  { label: "Politics", slug: "politics" },
  { label: "Product Management", slug: "product-management" },
  { label: "Productivity", slug: "productivity" },
  { label: "Programming", slug: "programming" },
  { label: "Python", slug: "python" },
  { label: "Relationships", slug: "relationships" },
  { label: "Self Improvement", slug: "self-improvement" },
  { label: "Software Development", slug: "software-development" },
  { label: "Startups", slug: "startups" },
  { label: "Technology", slug: "technology" },
  { label: "Travel", slug: "travel" },
  { label: "Work", slug: "work" },
  { label: "World", slug: "world" },
  { label: "Writing", slug: "writing" },
];

export const RECOMMENDED_TOPICS = TOPIC_SOURCE;

export const EXPLORE_TOPIC_SECTIONS = [
  {
    id: "recommended",
    title: "Recommended",
    description: "Popular picks to start curating your feed.",
    topics: [
      { slug: "programming", shortDescription: "Engineering, languages, and dev culture." },
      { slug: "data-science", shortDescription: "Analytics, ML workflows, and AI insights." },
      { slug: "technology", shortDescription: "The latest on innovation and platforms." },
      { slug: "productivity", shortDescription: "Systems and tools to get more done." },
      { slug: "self-improvement", shortDescription: "Grow personally and professionally." },
      { slug: "writing", shortDescription: "Tips to sharpen your storytelling." },
    ],
  },
  {
    id: "technology",
    title: "Technology",
    description: "Stay ahead with software, AI, and emerging tech.",
    topics: [
      { slug: "software-development", shortDescription: "Build, ship, and scale products." },
      { slug: "programming", shortDescription: "Language deep dives and best practices." },
      { slug: "python", shortDescription: "Recipes and tools for Pythonistas." },
      { slug: "machine-learning", shortDescription: "Models, research, and deployment." },
      { slug: "artificial-intelligence", shortDescription: "How AI is reshaping the world." },
      { slug: "cryptocurrency", shortDescription: "Web3, DeFi, and blockchain tech." },
    ],
  },
  {
    id: "life",
    title: "Life & Wellbeing",
    description: "Ideas for living intentionally and staying balanced.",
    topics: [
      { slug: "self-improvement", shortDescription: "Habit building and leveling up." },
      { slug: "mental-health", shortDescription: "Perspectives on emotional resilience." },
      { slug: "mindfulness", shortDescription: "Presence, meditation, and focus." },
      { slug: "relationships", shortDescription: "Connection, empathy, and community." },
      { slug: "health", shortDescription: "Wellness, fitness, and longevity." },
      { slug: "travel", shortDescription: "Stories from the road and beyond." },
    ],
  },
  {
    id: "work",
    title: "Work & Leadership",
    description: "Level up your career, team, and business.",
    topics: [
      { slug: "work", shortDescription: "Career growth and workplace culture." },
      { slug: "leadership", shortDescription: "Managing teams and inspiring others." },
      { slug: "business", shortDescription: "Strategy, operations, and growth." },
      { slug: "startups", shortDescription: "Building new ventures from zero to one." },
      { slug: "product-management", shortDescription: "Roadmaps, discovery, and delivery." },
      { slug: "marketing", shortDescription: "Brand storytelling and go-to-market." },
    ],
  },
  {
    id: "culture",
    title: "Culture & Society",
    description: "Understand the stories shaping our world.",
    topics: [
      { slug: "politics", shortDescription: "Policy, power, and public discourse." },
      { slug: "world", shortDescription: "Global affairs and big-picture trends." },
      { slug: "culture", shortDescription: "Art, media, and the human experience." },
      { slug: "creativity", shortDescription: "Ideas to spark your creative process." },
      { slug: "writing", shortDescription: "Essays, narrative craft, and voice." },
      { slug: "investing", shortDescription: "Money, markets, and long-term wealth." },
    ],
  },
];

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
