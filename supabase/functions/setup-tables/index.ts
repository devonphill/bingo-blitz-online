
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Create called_numbers table if it doesn't exist
    const createCalledNumbersResult = await supabaseClient.rpc('create_called_numbers_if_not_exists');
    
    if (createCalledNumbersResult.error) {
      console.error("Error creating called_numbers table:", createCalledNumbersResult.error);
      
      // Try direct SQL approach
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS public.called_numbers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
          number INTEGER NOT NULL,
          called_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
      `);
    }
    
    // Note: No need to create bingo_claims table as claims are stored in universal_game_logs

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 400,
    })
  }
})
