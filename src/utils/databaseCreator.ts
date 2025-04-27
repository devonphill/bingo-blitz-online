
import { supabase } from '@/integrations/supabase/client';

export const createRequiredTables = async () => {
  // Create called_numbers table if it doesn't exist
  const { error: createTableError } = await supabase.rpc('create_called_numbers_if_not_exists');
  
  if (createTableError) {
    console.error('Error creating called_numbers table:', createTableError);
    
    // Fallback: Try direct SQL if the RPC function doesn't exist
    const { error: sqlError } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS public.called_numbers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        called_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    
    if (sqlError) {
      console.error('Error creating called_numbers table via SQL:', sqlError);
    }
  }
  
  // Create bingo_claims table if it doesn't exist
  const { error: createClaimsError } = await supabase.rpc('create_bingo_claims_if_not_exists');
  
  if (createClaimsError) {
    console.error('Error creating bingo_claims table:', createClaimsError);
    
    // Fallback: Try direct SQL if the RPC function doesn't exist
    const { error: sqlError } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS public.bingo_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        win_pattern_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    
    if (sqlError) {
      console.error('Error creating bingo_claims table via SQL:', sqlError);
    }
  }
};
