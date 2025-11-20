import Stripe from "stripe";

let stripeClient = null;

const initStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe secret key is not configured. Set STRIPE_SECRET_KEY in your environment.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });
  }

  return stripeClient;
};

export const getStripeClient = () => initStripeClient();

export const createSubscriptionCheckoutSession = async ({
  customerEmail,
  customerId,
  clientReferenceId,
  priceId,
  successUrl,
  cancelUrl,
  metadata = {},
}) => {
  const stripe = initStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId || undefined,
    customer_email: customerId ? undefined : customerEmail,
    client_reference_id: clientReferenceId,
    allow_promotion_codes: true,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });

  return session;
};

export const retrieveCheckoutSession = async (sessionId) => {
  const stripe = initStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
};

export const createCustomerPortalSession = async ({ customerId, returnUrl }) => {
  if (!customerId) {
    throw new Error("Customer ID is required to create a portal session");
  }

  const stripe = initStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
};
