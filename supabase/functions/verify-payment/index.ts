
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
  console.log(`[verify-payment] ${message}`, data ? JSON.stringify(data) : "");
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");
    
    // Get request data
    const { sessionId, purchaseId } = await req.json();
    
    if (!sessionId || !purchaseId) {
      throw new Error("Missing required parameters");
    }
    
    log("Request data", { sessionId, purchaseId });

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

    // Get the purchase record
    log("Getting purchase record");
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("token_purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("user_id", userId)
      .single();
      
    if (purchaseError || !purchaseData) {
      log("Error getting purchase record", purchaseError);
      throw new Error("Purchase record not found or not accessible");
    }
    
    // Verify the session belongs to this purchase
    if (purchaseData.stripe_session_id !== sessionId) {
      log("Session ID mismatch", { 
        expected: purchaseData.stripe_session_id, 
        received: sessionId 
      });
      throw new Error("Invalid session ID");
    }

    // Check if the purchase was already completed
    if (purchaseData.status === "completed") {
      log("Purchase already completed");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Payment was already processed",
          purchase: purchaseData
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Get session from Stripe to verify payment status
    log("Fetching Stripe session");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session || session.payment_status !== "paid") {
      log("Payment not completed", { status: session?.payment_status });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Payment not completed",
          status: session?.payment_status
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Update the user's token count using the DB function
    log("Completing token purchase");
    await supabaseAdmin.rpc("complete_token_purchase", {
      p_user_id: userId,
      p_purchase_id: purchaseId,
      p_payment_intent_id: session.payment_intent as string,
      p_amount: purchaseData.amount
    });
    
    log("Purchase completed successfully", { 
      userId,
      purchaseId,
      amount: purchaseData.amount
    });
    
    // Get updated profile with new token count
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("token_count")
      .eq("id", userId)
      .single();
      
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Payment processed successfully",
        purchase: {
          ...purchaseData,
          status: "completed"
        },
        token_count: profileData?.token_count
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
    
  } catch (error) {
    log("Error", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
