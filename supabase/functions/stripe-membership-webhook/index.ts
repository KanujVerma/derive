import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import Stripe from "npm:stripe@22.0.0";
import {
  CommerceError,
  commerceErrorResponse,
  commerceJson,
  trustedServerValue,
} from "../_shared/commerce.ts";
import { selectCurrentMembershipSubscription } from "../_shared/subscriptions.ts";

const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

function resourceId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function validUserId(value: unknown): string | null {
  if (
    typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) return value;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return commerceJson({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new CommerceError("INVALID_SIGNATURE", "Stripe signature is required", 400);

    const stripe = new Stripe(trustedServerValue("STRIPE_SECRET_KEY"), {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        trustedServerValue("STRIPE_WEBHOOK_SECRET"),
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      throw new CommerceError("INVALID_SIGNATURE", "Stripe signature could not be verified", 400);
    }

    if (!handledEvents.has(event.type)) {
      return commerceJson({ received: true, handled: false });
    }

    let eventSubscription: Stripe.Subscription;
    let checkout: Stripe.Checkout.Session | null = null;
    let customerEmail: string | null = null;

    if (event.type.startsWith("checkout.session.")) {
      checkout = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = resourceId(checkout.subscription as string | { id?: string } | null);
      if (!subscriptionId) throw new CommerceError("INVALID_EVENT", "Subscription checkout is incomplete", 400);
      eventSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      customerEmail = checkout.customer_details?.email ?? checkout.customer_email ?? null;
    } else {
      const snapshot = event.data.object as Stripe.Subscription;
      eventSubscription = await stripe.subscriptions.retrieve(snapshot.id);
    }

    const customerId = resourceId(eventSubscription.customer as string | { id?: string });
    if (!customerId) throw new CommerceError("INVALID_EVENT", "Stripe customer identity is missing", 400);

    const expectedPriceId = trustedServerValue("STRIPE_FOUNDING_BETA_PRICE_ID");
    if (!/^price_[A-Za-z0-9_]+$/.test(expectedPriceId)) {
      console.error("STRIPE_FOUNDING_BETA_PRICE_ID is malformed");
      throw new CommerceError("COMMERCE_NOT_CONFIGURED", "Membership billing is not configured", 503);
    }
    if (!eventSubscription.items.data.some((item) => item.price.id === expectedPriceId)) {
      return commerceJson({ received: true, handled: false });
    }

    // Events can arrive for an older subscription after a replacement is paid.
    // Project the customer's current Stripe truth instead of the event's resource.
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      price: expectedPriceId,
      status: "all",
      limit: 100,
    });
    if (listed.has_more) {
      throw new CommerceError("WEBHOOK_PERSISTENCE_FAILED", "Membership state could not be synchronized", 500);
    }
    const subscription = selectCurrentMembershipSubscription(listed.data, expectedPriceId);
    if (!subscription) return commerceJson({ received: true, handled: false });

    const sameSubscription = subscription.id === eventSubscription.id;
    let userId = validUserId(subscription.metadata?.derive_user_id);
    if (sameSubscription && checkout) {
      userId = userId ?? validUserId(checkout.client_reference_id)
        ?? validUserId(checkout.metadata?.derive_user_id);
    }
    if (sameSubscription) {
      userId = userId ?? validUserId(eventSubscription.metadata?.derive_user_id);
    } else {
      customerEmail = null;
    }
    if (!userId || !customerEmail) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer && customer.deleted)) {
        userId = userId ?? validUserId(customer.metadata?.derive_user_id);
        customerEmail = customerEmail ?? customer.email ?? null;
      }
    }

    const supabaseUrl = trustedServerValue("SUPABASE_URL");
    const serviceRoleKey = trustedServerValue("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.rpc("apply_stripe_membership_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_event_created_at: new Date(event.created * 1000).toISOString(),
      p_user_id: userId,
      p_customer_email: customerEmail,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscription.id,
      p_stripe_subscription_status: subscription.status,
      p_stripe_price_id: expectedPriceId,
      p_cancel_at_period_end: subscription.cancel_at_period_end,
    });
    if (error) {
      console.error("membership webhook persistence failed:", error.code);
      throw new CommerceError("WEBHOOK_PERSISTENCE_FAILED", "Membership state could not be synchronized", 500);
    }

    return commerceJson({ received: true, handled: true, applied: data?.applied === true });
  } catch (error) {
    return commerceErrorResponse(error);
  }
});
