import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.0.0";
import {
  authenticateCommerceMember,
  CommerceError,
  commerceCorsHeaders,
  commerceErrorResponse,
  commerceJson,
  readCommerceBody,
  requireRequestId,
  trustedRedirectUrl,
  trustedServerValue,
} from "../_shared/commerce.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: commerceCorsHeaders });
  if (req.method !== "POST") return commerceJson({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const body = await readCommerceBody(req);
    const requestId = requireRequestId(body.requestId);
    const { user, admin } = await authenticateCommerceMember(req);
    if (!user.email) throw new CommerceError("PROFILE_INCOMPLETE", "An account email is required", 409);

    const stripeSecretKey = trustedServerValue("STRIPE_SECRET_KEY");
    const priceId = trustedServerValue("STRIPE_FOUNDING_BETA_PRICE_ID");
    if (!/^price_[A-Za-z0-9_]+$/.test(priceId)) {
      console.error("STRIPE_FOUNDING_BETA_PRICE_ID is malformed");
      throw new CommerceError("COMMERCE_NOT_CONFIGURED", "Membership billing is not configured", 503);
    }

    const successUrl = trustedRedirectUrl("DERIVE_CHECKOUT_SUCCESS_URL");
    const cancelUrl = trustedRedirectUrl("DERIVE_CHECKOUT_CANCEL_URL");
    const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id, email")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new CommerceError("PROFILE_UNAVAILABLE", "Member profile could not be loaded", 500);
    if (!profile) throw new CommerceError("PROFILE_INCOMPLETE", "Complete account setup before checkout", 409);

    const { data: membership, error: membershipError } = await admin.from("memberships")
      .select("id, status, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, created_at")
      .eq("user_id", user.id)
      .order("last_stripe_event_created_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw new CommerceError("MEMBERSHIP_UNAVAILABLE", "Membership could not be loaded", 500);
    if (
      membership?.stripe_subscription_id
      && ["active", "trialing"].includes(membership.stripe_subscription_status ?? "")
    ) {
      throw new CommerceError("MEMBERSHIP_ALREADY_ACTIVE", "Manage the active membership in the billing portal", 409);
    }

    let customerId = membership?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: profile.email || user.email,
          metadata: { derive_user_id: user.id, derive_tier: "founding_beta" },
        },
        { idempotencyKey: `derive-customer-${user.id}` },
      );
      customerId = customer.id;

      const persistence = membership
        ? await admin.from("memberships").update({ stripe_customer_id: customerId }).eq("id", membership.id)
        : await admin.from("memberships").insert({
          user_id: user.id,
          tier: "founding_beta",
          status: "paused",
          stripe_customer_id: customerId,
        });
      if (persistence.error) {
        console.error("Stripe customer binding failed:", persistence.error.code);
        throw new CommerceError("MEMBERSHIP_UNAVAILABLE", "Membership could not be prepared", 500);
      }
    }

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const existingFoundingBeta = existingSubscriptions.data.find((subscription) =>
      !["canceled", "incomplete_expired"].includes(subscription.status)
      && subscription.items.data.some((item) => item.price.id === priceId)
    );
    if (existingFoundingBeta) {
      throw new CommerceError(
        "MEMBERSHIP_ALREADY_EXISTS",
        "Manage the existing membership in the billing portal",
        409,
      );
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { derive_user_id: user.id, derive_tier: "founding_beta" },
        subscription_data: {
          metadata: { derive_user_id: user.id, derive_tier: "founding_beta" },
        },
      },
      { idempotencyKey: `derive-checkout-${user.id}-${requestId}` },
    );

    if (!session.url) throw new CommerceError("CHECKOUT_UNAVAILABLE", "Checkout could not be opened", 502);
    return commerceJson({ url: session.url });
  } catch (error) {
    return commerceErrorResponse(error);
  }
});
