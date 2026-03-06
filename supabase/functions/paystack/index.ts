// =====================================================
// TAXWISE PAYSTACK PAYMENTS - INVISIBLE + RECURRING
// Deploy: supabase functions deploy paystack --no-verify-jwt
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_API_URL = "https://api.paystack.co";

// Plan definitions — must match src/config.js PLANS
const PLANS: Record<string, { name: string; amount: number; interval: string; plan_code: string }> = {
  startup: {
    name: "Startup Plan",
    amount: 1000000, // ₦10,000 in kobo
    interval: "monthly",
    plan_code: "PLN_taxwise_startup"
  },
  sme: {
    name: "SME Plan",
    amount: 2500000, // ₦25,000 in kobo
    interval: "monthly",
    plan_code: "PLN_taxwise_sme"
  },
  corporate: {
    name: "Corporate Plan",
    amount: 6000000, // ₦60,000 in kobo
    interval: "monthly",
    plan_code: "PLN_taxwise_corporate"
  }
};

// Trial card verification — ₦100 charged then immediately refunded (Paystack minimum; net = ₦0)
const CARD_VERIFICATION_AMOUNT = 10000; // ₦100 in kobo

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return jsonResponse({ error: "Paystack not configured" }, 500);
    }

    // Get auth for non-webhook actions
    let user = null;
    let supabase = null;

    if (action !== "webhook") {
      const authHeader = req.headers.get("Authorization");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      if (authHeader) {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data } = await supabase.auth.getUser();
        user = data?.user;
      } else {
        // Allow unauthenticated for initial registration charge
        supabase = createClient(supabaseUrl, supabaseAnonKey);
      }
    }

    switch (action) {
      case "initialize":
        return await handleInitialize(payload, paystackSecretKey);
      case "charge_card":
        return await handleChargeCard(payload, paystackSecretKey, user, supabase);
      case "submit_otp":
        return await handleSubmitOtp(payload, paystackSecretKey);
      case "verify":
        return await handleVerify(payload, paystackSecretKey, user, supabase);
      case "create_subscription":
        return await handleCreateSubscription(payload, paystackSecretKey, user, supabase);
      case "charge_authorization":
        return await handleChargeAuthorization(payload, paystackSecretKey, supabase);
      case "get_subscription":
        return await handleGetSubscription(payload, paystackSecretKey, user, supabase);
      case "cancel_subscription":
        return await handleCancelSubscription(payload, paystackSecretKey, user, supabase);
      case "webhook":
        return await handleWebhook(req, paystackSecretKey);
      case "plans":
        return jsonResponse({ success: true, plans: PLANS });
      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// Initialize a Paystack transaction — returns authorization_url for BrowserWindow popup
// Works with ALL card types (international + Nigerian), no direct-charge approval needed
async function handleInitialize(payload: Record<string, unknown>, secretKey: string) {
  const { email, plan, is_trial, organization_id } = payload as {
    email: string;
    plan?: string;
    is_trial?: boolean;
    organization_id?: string;
  };

  if (!email) return jsonResponse({ error: "Email required" }, 400);

  const amount = is_trial
    ? CARD_VERIFICATION_AMOUNT
    : (PLANS[plan || "sme"]?.amount || PLANS.sme.amount);

  const reference = `txw_${is_trial ? "trial" : "sub"}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount,
      reference,
      // Electron intercepts this redirect before it hits a real server
      callback_url: "http://localhost:52731/taxwise-pay-complete",
      label: is_trial ? "TaxWise 14-Day Trial — Card Verification (₦100 refunded)" : `TaxWise ${plan || "SME"} Plan`,
      metadata: { plan: plan || "sme", is_trial: is_trial || false, organization_id },
    }),
  });

  const data = await response.json();
  console.log("Paystack /transaction/initialize response:", JSON.stringify(data));

  if (!data.status) {
    return jsonResponse({ error: data.message || "Failed to initialize payment" }, 400);
  }

  return jsonResponse({
    success: true,
    authorization_url: data.data.authorization_url,
    reference: data.data.reference,
    access_code: data.data.access_code,
  });
}

// Charge card directly (invisible — no popup)
// For trial signup: charges ₦100 as card verification, stores authorization for later
// FIX: removed /transaction/initialize step — /charge is self-contained
async function handleChargeCard(payload: Record<string, unknown>, secretKey: string, user: unknown, supabase: unknown) {
  const { email, amount, card, plan, metadata, is_trial } = payload as {
    email: string;
    amount?: number;
    card: { number: string; cvv: string; expiry_month: string; expiry_year: string };
    plan?: string;
    metadata?: Record<string, unknown>;
    is_trial?: boolean;
  };

  if (!card || !card.number || !card.cvv || !card.expiry_month || !card.expiry_year) {
    return jsonResponse({ error: "Card details required" }, 400);
  }

  // For trial signups: charge ₦100 for card verification only
  // For renewals/upgrades: charge full plan amount
  const chargeAmount = is_trial
    ? CARD_VERIFICATION_AMOUNT
    : (amount || (plan && PLANS[plan]?.amount) || PLANS.sme.amount);

  const reference = `txw_${is_trial ? 'trial' : 'sub'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Call /charge directly — no need to /transaction/initialize first
  const chargeResponse = await fetch(`${PAYSTACK_API_URL}/charge`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: chargeAmount,
      reference,
      card: {
        number: card.number.replace(/\s/g, ""),
        cvv: card.cvv,
        expiry_month: card.expiry_month,
        expiry_year: card.expiry_year
      },
      metadata: {
        user_id: (user as { id?: string } | null)?.id,
        plan,
        is_trial: is_trial || false,
        ...(metadata || {})
      }
    }),
  });

  const chargeData = await chargeResponse.json();

  // Log full Paystack response for debugging
  console.log("Paystack /charge response:", JSON.stringify(chargeData));

  if (!chargeData.status) {
    // Return full detail so the frontend can show a useful message
    return jsonResponse({
      error: chargeData.message,
      detail: chargeData
    }, 400);
  }

  const status = chargeData.data.status;

  if (status === "success") {
    return jsonResponse({
      success: true,
      status: "success",
      reference: chargeData.data.reference,
      authorization: chargeData.data.authorization,
      customer: chargeData.data.customer
    });
  } else if (
    status === "send_otp" || status === "send_pin" ||
    status === "send_phone" || status === "send_birthday"
  ) {
    return jsonResponse({
      success: true,
      status,
      reference: chargeData.data.reference,
      display_text: chargeData.data.display_text || "Please provide additional information"
    });
  } else if (status === "open_url") {
    return jsonResponse({
      success: true,
      status: "3ds_required",
      reference: chargeData.data.reference,
      url: chargeData.data.url
    });
  } else if (status === "charge_attempted") {
    // Paystack queued the charge — client should immediately call verify
    return jsonResponse({
      success: true,
      status: "charge_attempted",
      reference: chargeData.data.reference,
      display_text: "Verifying card, please wait…"
    });
  } else {
    return jsonResponse({
      success: false,
      status,
      message: chargeData.data?.message || chargeData.message || "Payment failed"
    }, 400);
  }
}

// Submit OTP/PIN for charge
async function handleSubmitOtp(payload: Record<string, unknown>, secretKey: string) {
  const { reference, otp, pin, phone, birthday } = payload as {
    reference: string;
    otp?: string;
    pin?: string;
    phone?: string;
    birthday?: string;
  };

  const authData: Record<string, string> = { reference };
  if (otp) authData.otp = otp;
  if (pin) authData.pin = pin;
  if (phone) authData.phone = phone;
  if (birthday) authData.birthday = birthday;

  const response = await fetch(`${PAYSTACK_API_URL}/charge/submit_otp`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(authData),
  });

  const data = await response.json();

  // Normalize response for frontend
  if (data.data?.status === "success") {
    return jsonResponse({
      success: true,
      status: "success",
      data: data.data
    });
  }
  return jsonResponse(data);
}

// Verify transaction and activate subscription (or start trial)
// FIX: uses upsert on subscriptions table to be idempotent
async function handleVerify(payload: Record<string, unknown>, secretKey: string, user: unknown, supabase: unknown) {
  const { reference, organization_id, plan, is_trial } = payload as {
    reference: string;
    organization_id?: string;
    plan?: string;
    is_trial?: boolean;
  };

  const response = await fetch(`${PAYSTACK_API_URL}/transaction/verify/${reference}`, {
    headers: { "Authorization": `Bearer ${secretKey}` },
  });

  const data = await response.json();

  if (!data.status || data.data.status !== "success") {
    return jsonResponse({ error: "Payment verification failed" }, 400);
  }

  const authorization = data.data.authorization;
  const customer = data.data.customer;

  if (organization_id && supabase) {
    const sb = supabase as ReturnType<typeof createClient>;

    const now = new Date();

    if (is_trial) {
      // Trial signup: set 14-day trial period, store auth code for later auto-charge
      const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      await sb.from("organizations").update({
        subscription_tier: plan || "sme",
        subscription_status: "trial",
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_expires_at: trialEndsAt.toISOString(),
        paystack_customer_code: customer.customer_code,
        paystack_authorization_code: authorization.authorization_code,
        card_last4: authorization.last4,
        card_brand: authorization.brand,
        card_exp_month: authorization.exp_month,
        card_exp_year: authorization.exp_year
      }).eq("id", organization_id);

      // Upsert subscription record (idempotent)
      await sb.from("subscriptions").upsert({
        organization_id,
        plan_code: plan || "sme",
        paystack_customer_code: customer.customer_code,
        paystack_authorization_code: authorization.authorization_code,
        status: "trial",
        current_period_start: now.toISOString(),
        current_period_end: trialEndsAt.toISOString()
      }, { onConflict: "organization_id" });

      // Immediately refund the ₦100 verification charge — net cost to customer = ₦0
      // The authorization_code remains valid for future charges even after refund
      try {
        await fetch(`${PAYSTACK_API_URL}/refund`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transaction: reference }),
        });
      } catch (refundErr) {
        // Non-fatal: log but don't fail the signup
        console.error("Auto-refund failed:", (refundErr as Error).message);
      }

    } else {
      // Direct subscription (upgrade/reactivate)
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await sb.from("organizations").update({
        subscription_tier: plan || "sme",
        subscription_status: "active",
        subscription_expires_at: expiresAt.toISOString(),
        paystack_customer_code: customer.customer_code,
        paystack_authorization_code: authorization.authorization_code,
        card_last4: authorization.last4,
        card_brand: authorization.brand,
        card_exp_month: authorization.exp_month,
        card_exp_year: authorization.exp_year
      }).eq("id", organization_id);

      // Upsert subscription record (idempotent — won't fail on retry)
      await sb.from("subscriptions").upsert({
        organization_id,
        plan_code: plan || "sme",
        paystack_customer_code: customer.customer_code,
        paystack_authorization_code: authorization.authorization_code,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: expiresAt.toISOString()
      }, { onConflict: "organization_id" });
    }
  }

  return jsonResponse({
    success: true,
    is_trial: is_trial || false,
    authorization_code: authorization.authorization_code,
    customer_code: customer.customer_code,
    card: {
      last4: authorization.last4,
      brand: authorization.brand,
      exp_month: authorization.exp_month,
      exp_year: authorization.exp_year
    }
  });
}

// Charge saved authorization (for trial conversion and recurring renewals)
async function handleChargeAuthorization(payload: Record<string, unknown>, secretKey: string, supabase: unknown) {
  const { authorization_code, email, amount, organization_id, plan } = payload as {
    authorization_code: string;
    email: string;
    amount?: number;
    organization_id?: string;
    plan?: string;
  };

  const reference = `txw_renew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chargeAmount = amount || (plan && PLANS[plan]?.amount) || PLANS.sme.amount;

  const response = await fetch(`${PAYSTACK_API_URL}/transaction/charge_authorization`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authorization_code,
      email,
      amount: chargeAmount,
      reference,
      currency: "NGN",
      metadata: { organization_id, plan, type: "renewal" }
    }),
  });

  const data = await response.json();

  if (data.status && data.data.status === "success") {
    if (organization_id && supabase) {
      const sb = supabase as ReturnType<typeof createClient>;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await sb.from("organizations").update({
        subscription_status: "active",
        subscription_expires_at: expiresAt.toISOString()
      }).eq("id", organization_id);

      await sb.from("subscriptions").upsert({
        organization_id,
        status: "active",
        current_period_end: expiresAt.toISOString()
      }, { onConflict: "organization_id" });
    }

    return jsonResponse({ success: true, reference: data.data.reference });
  }

  // Mark as past_due if charge failed
  if (organization_id && supabase) {
    const sb = supabase as ReturnType<typeof createClient>;
    await sb.from("organizations").update({
      subscription_status: "past_due"
    }).eq("id", organization_id);
  }

  return jsonResponse({ error: data.message || "Charge failed" }, 400);
}

// Create Paystack subscription (for auto-renewal via Paystack)
async function handleCreateSubscription(payload: Record<string, unknown>, secretKey: string, user: unknown, supabase: unknown) {
  const { customer_code, plan, authorization_code } = payload as {
    customer_code: string;
    plan: string;
    authorization_code: string;
  };

  const planCode = PLANS[plan]?.plan_code;
  if (!planCode) {
    return jsonResponse({ error: "Invalid plan" }, 400);
  }

  const response = await fetch(`${PAYSTACK_API_URL}/subscription`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: customer_code,
      plan: planCode,
      authorization: authorization_code
    }),
  });

  const data = await response.json();

  if (!data.status) {
    return jsonResponse({ error: data.message }, 400);
  }

  return jsonResponse({
    success: true,
    subscription_code: data.data.subscription_code,
    next_payment_date: data.data.next_payment_date
  });
}

// Get subscription status
async function handleGetSubscription(payload: Record<string, unknown>, secretKey: string, user: unknown, supabase: unknown) {
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const sb = supabase as ReturnType<typeof createClient>;
  const u = user as { id: string };

  const { data: profile } = await sb
    .from("users")
    .select("organization:organizations(*)")
    .eq("id", u.id)
    .single();

  if (!(profile as { organization?: unknown })?.organization) {
    return jsonResponse({ error: "Organization not found" }, 404);
  }

  const org = (profile as { organization: Record<string, unknown> }).organization;

  return jsonResponse({
    success: true,
    subscription: {
      tier: org.subscription_tier,
      status: org.subscription_status,
      expires_at: org.subscription_expires_at,
      trial_ends_at: org.trial_ends_at,
      card: org.card_last4 ? {
        last4: org.card_last4,
        brand: org.card_brand,
        exp_month: org.card_exp_month,
        exp_year: org.card_exp_year
      } : null
    }
  });
}

// Cancel subscription
async function handleCancelSubscription(payload: Record<string, unknown>, secretKey: string, user: unknown, supabase: unknown) {
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const sb = supabase as ReturnType<typeof createClient>;
  const u = user as { id: string };

  const { data: profile } = await sb
    .from("users")
    .select("organization_id, organization:organizations(paystack_subscription_code)")
    .eq("id", u.id)
    .single();

  const p = profile as { organization_id: string; organization?: { paystack_subscription_code?: string } };

  if (p?.organization?.paystack_subscription_code) {
    await fetch(`${PAYSTACK_API_URL}/subscription/disable`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: p.organization.paystack_subscription_code,
        token: (payload as { email_token?: string }).email_token
      }),
    });
  }

  await sb.from("organizations").update({
    subscription_status: "cancelled"
  }).eq("id", p.organization_id);

  return jsonResponse({ success: true });
}

// Handle Paystack webhooks (for auto-renewal events)
async function handleWebhook(req: Request, secretKey: string) {
  const signature = req.headers.get("x-paystack-signature");
  const body = await req.text();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  if (signature !== computedSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body);
  console.log("Webhook:", event.event);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  switch (event.event) {
    case "charge.success": {
      const chargeData = event.data;
      if (chargeData.metadata?.organization_id && chargeData.metadata?.type === "renewal") {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase.from("organizations").update({
          subscription_status: "active",
          subscription_expires_at: expiresAt.toISOString()
        }).eq("id", chargeData.metadata.organization_id);
      }
      break;
    }

    case "subscription.disable":
      await supabase.from("organizations").update({
        subscription_status: "cancelled"
      }).eq("paystack_subscription_code", event.data.subscription_code);
      break;

    case "invoice.payment_failed":
      if (event.data.metadata?.organization_id) {
        await supabase.from("organizations").update({
          subscription_status: "past_due"
        }).eq("id", event.data.metadata.organization_id);
      }
      break;
  }

  return new Response("OK", { status: 200 });
}
