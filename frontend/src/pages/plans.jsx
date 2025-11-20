import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./plans.css";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";

const PREMIUM_BADGE = "\u2726"; // star symbol
const FREE_POST_LIMIT = 5;
const FREE_IMAGE_LIMIT = 3;
const PLAN_PRICE_DISPLAY = "$15";
const PLAN_INTERVAL = "month";

const PREMIUM_FEATURES = [
  {
    id: "publish",
    title: "Publish without artificial limits",
    description: `Free members can publish up to ${FREE_POST_LIMIT} stories. Premium unlocks unlimited publishing so you never have to pause mid-series again.`,
    icon: "🚀",
  },
  {
    id: "media",
    title: "Unlimited rich media",
    description: `Drop in as many high-resolution images and visuals as you need—skip the ${FREE_IMAGE_LIMIT}-image ceiling on the free plan.`,
    icon: "🖼️",
  },
  {
    id: "stories",
    title: "Read every premium story",
    description:
      "Follow your curiosity with unrestricted access to member-only stories across BlogsHive. Support fellow writers and stay inspired.",
    icon: "🔓",
  },
  {
    id: "signal",
    title: "Stand out with the premium signal",
    description:
      "Earn the Premium badge on your profile and receive priority placement in recommendations, helping your best work travel further.",
    icon: "⭐",
  },
  {
    id: "insights",
    title: "Advanced insights & supporter tools",
    description:
      "Unlock deeper analytics on every story and automate emails to your supporters whenever you publish.",
    icon: "📊",
  },
];

const COMPARISON_ROWS = [
  {
    label: "Published stories",
    free: `Up to ${FREE_POST_LIMIT}`,
    premium: "Unlimited publishing",
  },
  {
    label: "Image blocks per story",
    free: `Up to ${FREE_IMAGE_LIMIT}`,
    premium: "Unlimited visuals",
  },
  {
    label: "Access to premium stories",
    free: "Locked",
    premium: "Full library access",
  },
  {
    label: "Audience insights",
    free: "Basic stats",
    premium: "Advanced analytics & trends",
  },
  {
    label: "Profile visibility",
    free: "Standard listing",
    premium: "Premium badge & priority boosts",
  },
];

const formatError = (payload) => {
  if (!payload) {
    return "Unable to complete that request. Please try again.";
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (payload.error) {
    return typeof payload.error === "string"
      ? payload.error
      : payload.error.message || "Something went wrong.";
  }
  if (payload.message) {
    return payload.message;
  }
  return "Something went wrong. Please try again.";
};

const PlansPage = () => {
  const { user, token, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const confirmationAttemptedRef = useRef(null);

  const viewerIsPremium = Boolean(user?.membershipStatus);
  const canOpenPortal = viewerIsPremium && Boolean(user?.stripeCustomerId);

  const heroSubtitle = useMemo(() => {
    if (viewerIsPremium) {
      return "Thank you for supporting thoughtful storytelling on BlogsHive.";
    }
    return "Invest in your craft, unlock richer insights, and keep your best ideas flowing.";
  }, [viewerIsPremium]);

  const clearQueryParams = useCallback(
    (keys) => {
      const next = new URLSearchParams(searchParams.toString());
      let changed = false;
      keys.forEach((key) => {
        if (next.has(key)) {
          next.delete(key);
          changed = true;
        }
      });

      if (changed) {
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const cancelled = searchParams.get("checkout") === "cancelled";
    if (cancelled) {
      setError("Checkout was cancelled. Pick up where you left off when you're ready.");
      clearQueryParams(["checkout"]);
    }
  }, [searchParams, clearQueryParams]);

  const handleUpgrade = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (!token) {
      navigate("/login", { state: { from: "/plans" } });
      return;
    }

    if (viewerIsPremium) {
      setSuccess("You're already enjoying BlogsHive Premium!");
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(formatError(payload));
        return;
      }

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      if (payload.sessionId) {
        window.location.assign(`https://checkout.stripe.com/pay/${payload.sessionId}`);
        return;
      }

      setError("Unexpected response from the billing service. Please try again later.");
    } catch (requestError) {
      setError(requestError.message || "Unable to start checkout. Please try again.");
    } finally {
      setIsCreatingSession(false);
    }
  }, [navigate, token, viewerIsPremium]);

  const handlePortal = useCallback(async () => {
    if (!token) {
      navigate("/login", { state: { from: "/plans" } });
      return;
    }

    setError(null);
    setSuccess(null);
    setIsOpeningPortal(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(formatError(payload));
        return;
      }

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      setError("Unexpected response from the billing portal.");
    } catch (requestError) {
      setError(requestError.message || "Unable to open the billing portal. Please try again.");
    } finally {
      setIsOpeningPortal(false);
    }
  }, [navigate, token]);

  const confirmSession = useCallback(
    async (sessionId) => {
      setIsConfirming(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/billing/confirm-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(formatError(payload));
          return;
        }

        setSuccess(payload.message || "Your premium membership is active. Welcome!");

        if (payload.user && typeof updateUser === "function") {
          updateUser(payload.user);
        } else if (typeof updateUser === "function") {
          updateUser({ membershipStatus: true });
        }
      } catch (requestError) {
        setError(requestError.message || "We couldn't confirm your membership. Please contact support.");
      } finally {
        setIsConfirming(false);
        clearQueryParams(["session_id"]);
      }
    },
    [token, updateUser, clearQueryParams]
  );

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || !token) {
      if (sessionId && !token && confirmationAttemptedRef.current !== sessionId) {
        setError("Sign in to finalize your premium upgrade.");
      }
      return;
    }

    if (confirmationAttemptedRef.current === sessionId) {
      return;
    }

    confirmationAttemptedRef.current = sessionId;
    confirmSession(sessionId);
  }, [searchParams, token, confirmSession]);

  const primaryActionLabel = useMemo(() => {
    if (viewerIsPremium) {
      if (!canOpenPortal) {
        return "Premium active";
      }
      return isOpeningPortal ? "Opening portal…" : "Manage membership";
    }
    if (isCreatingSession) {
      return "Securing your spot…";
    }
    return `Upgrade for ${PLAN_PRICE_DISPLAY}/${PLAN_INTERVAL}`;
  }, [viewerIsPremium, canOpenPortal, isCreatingSession, isOpeningPortal]);

  const primaryActionHandler = viewerIsPremium ? handlePortal : handleUpgrade;
  const primaryActionDisabled = viewerIsPremium
    ? isOpeningPortal || isConfirming || !canOpenPortal
    : isCreatingSession || isConfirming;

  return (
    <div className="plans-page">
      <section className="plans-hero" aria-labelledby="plans-heading">
        <div className="plans-hero__content">
          <span className="plans-hero__eyebrow">{PREMIUM_BADGE} BlogsHive Premium</span>
          <h1 id="plans-heading">Write boldly. Read deeply. Grow faster.</h1>
          <p className="plans-hero__subtitle">{heroSubtitle}</p>
          {error && (
            <div className="plans-callout plans-callout--error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="plans-callout plans-callout--success" role="status">
              {success}
            </div>
          )}
          <div className="plans-hero__actions">
            <button
              type="button"
              className="plans-primary-btn"
              onClick={primaryActionHandler}
              disabled={primaryActionDisabled || isConfirming}
            >
              {primaryActionLabel}
            </button>
            {!viewerIsPremium && (
              <button
                type="button"
                className="plans-secondary-btn"
                onClick={() => navigate("/about")}
              >
                Why membership?
              </button>
            )}
          </div>
          <p className="plans-hero__note">Cancel anytime. Your membership supports a better internet for writers and readers.</p>
        </div>
        <div className="plans-hero__card" aria-label="BlogsHive Premium plan details">
          <div className="plan-card">
            <div className="plan-card__header">
              <h2>Premium</h2>
              <p>Everything you need to grow your voice and your audience.</p>
            </div>
            <div className="plan-card__price">
              <span className="plan-card__price-value">{PLAN_PRICE_DISPLAY}</span>
              <span className="plan-card__price-interval">/{PLAN_INTERVAL}</span>
            </div>
            <ul className="plan-card__perks">
              <li>
                <span aria-hidden="true">🚀</span> Unlimited story publishing
              </li>
              <li>
                <span aria-hidden="true">🖼️</span> Unlimited image blocks per story
              </li>
              <li>
                <span aria-hidden="true">🔓</span> Access to every premium story
              </li>
              <li>
                <span aria-hidden="true">⭐</span> Premium badge on your profile
              </li>
            </ul>
            {!viewerIsPremium && (
              <button
                type="button"
                className="plan-card__cta"
                onClick={handleUpgrade}
                disabled={isCreatingSession || isConfirming}
              >
                Get started
              </button>
            )}
            {viewerIsPremium && (
              <div className="plan-card__active" role="status">
                You’re a premium member. Thank you!
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="plans-features" aria-label="Premium membership benefits">
        {PREMIUM_FEATURES.map((feature) => (
          <article key={feature.id} className="plans-feature">
            <div className="plans-feature__icon" aria-hidden="true">
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>
      <section className="plans-compare" aria-label="Plan comparison">
        <h2>Free vs. Premium at a glance</h2>
        <div className="plans-compare__grid" role="table">
          <div className="plans-compare__header" role="row">
            <div role="columnheader">Feature</div>
            <div role="columnheader">Free</div>
            <div role="columnheader">Premium</div>
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div className="plans-compare__row" role="row" key={row.label}>
              <div role="cell">{row.label}</div>
              <div role="cell">{row.free}</div>
              <div role="cell">{row.premium}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="plans-faq" aria-label="Premium FAQs">
        <h2>Frequently asked questions</h2>
        <div className="plans-faq__grid">
          <article>
            <h3>Can I cancel anytime?</h3>
            <p>Yes. Manage or cancel your membership whenever you want from this page or through the Stripe billing portal.</p>
          </article>
          <article>
            <h3>Do I keep access if I downgrade?</h3>
            <p>You’ll keep your published stories, but premium-only posts go back to your drafts and premium readers lose access once the billing period ends.</p>
          </article>
          <article>
            <h3>Is payment secure?</h3>
            <p>We partner with Stripe for secure payments, trusted by millions of creators and platforms worldwide.</p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default PlansPage;
