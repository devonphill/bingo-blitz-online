import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';

/**
 * Interface for claim data
 */
export interface ClaimData {
  id?: string;
  session_id: string;
  player_id: string;
  player_name: string;
  ticket_id?: string;
  ticket_serial?: string;
  win_pattern: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

/**
 * Submit a bingo claim
 */
export const submitClaim = async (
  sessionId: string,
  playerId: string,
  playerName: string,
  ticketId: string | undefined,
  ticketSerial: string | undefined,
  winPattern: string
): Promise<{ success: boolean; claimId?: string; error?: string }> => {
  try {
    if (!sessionId) {
      return { success: false, error: 'No session ID provided' };
    }

    if (!playerId) {
      return { success: false, error: 'No player ID provided' };
    }

    if (!winPattern) {
      return { success: false, error: 'No win pattern provided' };
    }

    // Log the claim attempt
    logWithTimestamp(
      `Player ${playerName} (${playerId}) submitting claim for ${winPattern} in session ${sessionId}`,
      'info'
    );

    // Check if player already has a pending claim for this session and pattern
    const { data: existingClaims, error: checkError } = await supabase
      .from('claims')
      .select('*')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .eq('win_pattern', winPattern)
      .eq('status', 'pending');

    if (checkError) {
      logWithTimestamp(`Error checking existing claims: ${checkError.message}`, 'error');
      return { success: false, error: `Error checking existing claims: ${checkError.message}` };
    }

    if (existingClaims && existingClaims.length > 0) {
      logWithTimestamp(`Player already has a pending claim for this pattern`, 'warn');
      return {
        success: false,
        error: 'You already have a pending claim for this pattern',
        claimId: existingClaims[0].id
      };
    }

    // Create the claim
    const claim: ClaimData = {
      session_id: sessionId,
      player_id: playerId,
      player_name: playerName,
      ticket_id: ticketId,
      ticket_serial: ticketSerial,
      win_pattern: winPattern,
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('claims')
      .insert([claim])
      .select();

    if (error) {
      logWithTimestamp(`Error submitting claim: ${error.message}`, 'error');
      return { success: false, error: `Error submitting claim: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No data returned from claim submission' };
    }

    logWithTimestamp(`Claim submitted successfully: ${data[0].id}`, 'info');
    return { success: true, claimId: data[0].id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logWithTimestamp(`Exception submitting claim: ${errorMessage}`, 'error');
    return { success: false, error: `Exception submitting claim: ${errorMessage}` };
  }
};

/**
 * Get claim status
 */
export const getClaimStatus = async (
  claimId: string
): Promise<{ status: string; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('status')
      .eq('id', claimId)
      .single();

    if (error) {
      return { status: 'error', error: error.message };
    }

    return { status: data?.status || 'unknown' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: errorMessage };
  }
};

/**
 * Verify a claim
 */
export const verifyClaim = async (
  claimId: string,
  isValid: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const status = isValid ? 'verified' : 'rejected';
    
    const { error } = await supabase
      .from('claims')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', claimId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
};
