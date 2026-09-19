import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.0.0";
import {
  authenticateCommerceMember,
  CommerceError,
  commerceCorsHeaders,
  commerceErrorResponse,
  commerceJson,
  trustedRedirectUrl,
  trustedServerValue,
} from "../_shared/commerce.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: commerceCorsHeaders });
  if (req.method !== "POST") return commerceJson({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { user, admin } = await authenticateCommerceMember(req);
    const stripe = new Stripe(trustedServerValue("STRIPE_SECRET_KEY"), {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const returnUrl = trustedRedirectUrl("DERIVE_PORTAL_RETURN_URL");

    const { data: membership, error } = await admin.from("memberships")
      .select("stripe_customer_id, created_at")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("last_stripe_event_created_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new CommerceError("MEMBERSHIP_UNAVAILABLE", "Membership could not be loaded", 500);
    if (!membership?.stripe_customer_id) {
      throw new CommerceError("BILLING_PROFILE_NOT_FOUND", "Start membership checkout before opening billing settings", 409);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: returnUrl,
    });
    return commerceJson({ url: session.url });
  } catch (error) {
    return commerceErrorResponse(error);
  }
});
