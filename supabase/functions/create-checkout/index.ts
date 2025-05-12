
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

// Log function for easier debugging
const log = (message: string, data?: any) => {
  console.log(`[create-checkout] ${message}`, data ? JSON.stringify(data) : "");
};

// Token package pricing
const tokenPackages = {
  'trial': { tokens: 13, price: 10 },
  'starter': { tokens: 50, price: 36 },
  'popular': { tokens: 100, price: 70 },
  'pro': { tokens: 500, price: 300 }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");
    
    // Get request data
    const { amount, tokenPackage } = await req.json();
    
    if (!amount || amount < 1) {
      throw new Error("Invalid amount");
    }
    
    log("Request data", { amount, tokenPackage });

    // Setup Supabase client with the provided authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    // Initialize Supabase client for authenticating the user
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    // Get authenticated user
    log("Getting authenticated user");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      log("Authentication error", userError);
      throw new Error("User not authenticated");
    }
    
    const userId = userData.user.id;
    log("User authenticated", { userId });

    // Initialize Stripe
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not found");
    }
    
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
    
    // Initialize Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Get package price
    let tokenAmount = amount;
    let costInPounds = 10; // Default price
    
    if (tokenPackage && tokenPackages[tokenPackage]) {
      tokenAmount = tokenPackages[tokenPackage].tokens;
      costInPounds = tokenPackages[tokenPackage].price;
    }
    
    // Convert pounds to pence for Stripe
    const costInPence = costInPounds * 100;
    
    // Create token purchase record in database
    log("Creating token purchase record");
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("token_purchases")
      .insert({
        user_id: userId,
        amount: tokenAmount,
        cost: costInPounds,
        currency: "gbp", // Changed from USD to GBP
        status: "pending",
      })
      .select()
      .single();
      
    if (purchaseError || !purchaseData) {
      log("Error creating purchase record", purchaseError);
      throw new Error("Failed to create purchase record");
    }
    
    log("Purchase record created", { purchaseId: purchaseData.id });
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp", // Changed from USD to GBP
            product_data: {
              name: `${tokenAmount} Bingo Tokens`,
              description: `Purchase ${tokenAmount} tokens for your Bingo Blitz account`,
            },
            unit_amount: costInPence,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchaseData.id}`,
      cancel_url: `${req.headers.get("origin")}/add-tokens?canceled=true`,
      metadata: {
        purchase_id: purchaseData.id,
        user_id: userId,
        token_amount: tokenAmount,
      },
    });
    
    log("Stripe session created", { 
      sessionId: session.id,
      url: session.url
    });
    
    // Update purchase record with Stripe session ID
    await supabaseAdmin
      .from("token_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchaseData.id);
    
    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
        purchaseId: purchaseData.id 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
    
  } catch (error) {
    log("Error", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
