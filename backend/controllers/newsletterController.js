import Newsletter from "../models/Newsletter.js";

const serializeNewsletter = (newsletter) => ({
  id: newsletter._id,
  isSubscribed: newsletter.isSubscribed,
  subscribersCount: newsletter.subscribersCount,
  createdAt: newsletter.createdAt,
  updatedAt: newsletter.updatedAt,
});

const ensureNewsletter = async (userId) => {
  let newsletter = await Newsletter.findOne({ user: userId });
  if (!newsletter) {
    newsletter = await Newsletter.create({ user: userId });
  }
  return newsletter;
};

export const getNewsletter = async (req, res) => {
  try {
    const newsletter = await ensureNewsletter(req.user._id);
    res.json(serializeNewsletter(newsletter));
  } catch (error) {
    res.status(500).json({ error: "Failed to load newsletter preferences" });
  }
};

export const updateNewsletterSubscription = async (req, res) => {
  try {
    const { subscribe } = req.body;
    if (typeof subscribe !== "boolean") {
      return res.status(400).json({ error: "subscribe must be a boolean" });
    }

    const newsletter = await ensureNewsletter(req.user._id);
    newsletter.isSubscribed = subscribe;
    await newsletter.save();

    res.json(serializeNewsletter(newsletter));
  } catch (error) {
    res.status(500).json({ error: "Failed to update newsletter preference" });
  }
};
