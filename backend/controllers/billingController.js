import User from "../models/User.js";
import {
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
  createCustomerPortalSession,
} from "../services/stripeService.js";

const pickPrimaryClientUrl = () => {
  const raw = process.env.CLIENT_URL || "http://localhost:3000";
  if (!raw) {
    return "http://localhost:3000";
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0] || "http://localhost:3000";
};

const sanitizeUserPayload = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;

  return {
    id: doc._id?.toString?.() || doc._id || doc.id,
    _id: doc._id?.toString?.() || doc._id || doc.id,
    email: doc.email,
    username: doc.username,
    name: doc.name,
    avatar: doc.avatar,
    membershipStatus: Boolean(doc.membershipStatus),
    stripeCustomerId: doc.stripeCustomerId,
    stripeSubscriptionId: doc.stripeSubscriptionId,
  };
};

export const createCheckoutSession = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (user.membershipStatus) {
      return res.status(400).json({ error: "You already have an active premium membership." });
    }

    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return res.status(503).json({ error: "Premium plan is currently unavailable. Contact support." });
    }

    const clientUrl = pickPrimaryClientUrl();

    const successUrl = `${clientUrl}/plans?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${clientUrl}/plans?checkout=cancelled`;

    const session = await createSubscriptionCheckoutSession({
      customerEmail: user.email,
      customerId: user.stripeCustomerId,
      clientReferenceId: user._id?.toString?.() || user._id || user.id,
      priceId,
      successUrl,
      cancelUrl,
      metadata: {
        userId: user._id?.toString?.() || user._id || user.id,
        username: user.username || "",
      },
    });

    return res.status(201).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Failed to create Stripe checkout session", error);
    return res.status(500).json({
      error: "Unable to begin checkout",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const confirmCheckoutSession = async (req, res) => {
  try {
    const { user } = req;
    const { sessionId } = req.body || {};

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "A valid Stripe session ID is required." });
    }

    const session = await retrieveCheckoutSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Checkout session not found." });
    }

    const sessionUserId =
      session.client_reference_id || session.metadata?.userId || session.customer_details?.email;

    const normalizedUserId = user._id?.toString?.() || user._id || user.id;

    if (sessionUserId && sessionUserId !== normalizedUserId && session.customer_details?.email !== user.email) {
      return res.status(403).json({ error: "This checkout session does not belong to the current user." });
    }

    const isComplete = session.status === "complete" || session.payment_status === "paid";

    if (!isComplete) {
      return res.status(409).json({ error: "Checkout session has not been completed." });
    }

    const updatePayload = {
      membershipStatus: true,
      stripeCustomerId: session.customer?.id || session.customer || user.stripeCustomerId,
      stripeSubscriptionId:
        (typeof session.subscription === "string" && session.subscription) ||
        session.subscription?.id ||
        user.stripeSubscriptionId,
      membershipStartedAt: session.created ? new Date(session.created * 1000) : new Date(),
      membershipCanceledAt: null,
    };

    const updatedUser = await User.findByIdAndUpdate(user._id, updatePayload, {
      new: true,
      runValidators: true,
    }).select("_id email username name avatar membershipStatus stripeCustomerId stripeSubscriptionId");

    return res.json({
      message: "Your BlogsHive Premium membership is active!",
      user: sanitizeUserPayload(updatedUser),
    });
  } catch (error) {
    console.error("Failed to confirm Stripe checkout session", error);
    return res.status(500).json({
      error: "Unable to activate membership",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const createPortalSession = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe billing information found for this account." });
    }

    const clientUrl = pickPrimaryClientUrl();
    const portalSession = await createCustomerPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${clientUrl}/plans`,
    });

    return res.json({ url: portalSession.url });
  } catch (error) {
    console.error("Failed to create Stripe portal session", error);
    return res.status(500).json({
      error: "Unable to open billing portal",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
