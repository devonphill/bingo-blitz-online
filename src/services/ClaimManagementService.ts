
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType, ensureString } from '@/utils/typeUtils';

/**
 * Service for managing bingo claim events and lifecycle.
 * This acts as a global system for tracking claims before they are recorded in the database.
 */

// Maintain a mapping of session ID -> array of pending claims
const pendingClaims = new Map<string, any[]>();

// Keep track of claim IDs to prevent duplicates
const claimIds = new Set<string>();

/**
 * Generates a UUID v4 to identify claims
 * From: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Submit a new bingo claim for verification
 */
const submitClaim = (claimData: any) => {
  if (!claimData || !claimData.sessionId) {
    logWithTimestamp('Cannot submit claim: Missing session ID', 'error');
    return false;
  }

  try {
    const sessionId = ensureString(claimData.sessionId);
    logWithTimestamp(`Submitting claim for session ${sessionId}`);

    // Create a new queue for this session if it doesn't exist yet
    if (!pendingClaims.has(sessionId)) {
      logWithTimestamp(`Creating new claim queue for session ${sessionId}`);
      pendingClaims.set(sessionId, []);
    }

    // Generate a unique ID for this claim
    const claimId = generateUUID();
    claimIds.add(claimId);

    // Add some metrics to help with debugging
    const toGoCount = claimData.toGoCount || 0;
    const hasLastCalledNumber = !!claimData.lastCalledNumber;
    logWithTimestamp(`Claim metrics: ${toGoCount} to go, has last called number: ${hasLastCalledNumber}`);

    // Create the full claim object
    const claim = {
      id: claimId,
      timestamp: new Date().toISOString(),
      ...claimData,
      status: 'pending'
    };

    // Add to the queue for this session
    const sessionClaims = pendingClaims.get(sessionId) || [];
    sessionClaims.push(claim);
    pendingClaims.set(sessionId, sessionClaims);

    logWithTimestamp(`Added claim to queue. Queue now has ${sessionClaims.length} claims for session ${sessionId}`);

    // Broadcast this claim to listeners (callers and other players)
    broadcastClaimEvent(claim);

    return true;
  } catch (error) {
    console.error('Error submitting claim:', error);
    return false;
  }
};

/**
 * Process a claim validation result
 * @param claimId The ID of the claim to process
 * @param sessionId The session ID for context
 * @param isValid Whether the claim is valid or not
 * @param onGameProgress Optional callback for game progression after validation
 * @returns {Promise<boolean>} Success status
 */
const processClaim = async (
  claimId: string,
  sessionId: string,
  isValid: boolean,
  onGameProgress?: () => void
): Promise<boolean> => {
  try {
    if (!claimId || !sessionId) {
      logWithTimestamp('Cannot process claim: Missing claim ID or session ID', 'error');
      return false;
    }

    // Find the claim in the session queue
    const sessionClaims = pendingClaims.get(sessionId) || [];
    const claimIndex = sessionClaims.findIndex(c => c.id === claimId);

    if (claimIndex === -1) {
      logWithTimestamp(`Claim ${claimId} not found in session ${sessionId}`, 'error');
      return false;
    }

    const claim = sessionClaims[claimIndex];
    
    // Remove from pending claims
    sessionClaims.splice(claimIndex, 1);
    pendingClaims.set(sessionId, sessionClaims);
    logWithTimestamp(`Removed claim ${claimId} from pending queue. Queue now has ${sessionClaims.length} claims.`);
    
    // Broadcast result to the player
    await broadcastClaimResult(
      sessionId,
      claim.playerId,
      claim.playerName || 'Player',
      isValid ? 'valid' : 'invalid',
      claim.ticket
    );
    
    // If valid and there's a progression callback, trigger it
    if (isValid && onGameProgress) {
      logWithTimestamp('Triggering game progression callback', 'info');
      onGameProgress();
    }
    
    return true;
  } catch (error) {
    console.error('Error processing claim:', error);
    return false;
  }
};

/**
 * Get all pending claims for a specific session
 */
const getClaimsForSession = (sessionId: string) => {
  if (!sessionId) return [];

  // First check the in-memory map
  const claims = pendingClaims.get(sessionId) || [];
  logWithTimestamp(`Found ${claims.length} claims in service`);

  // Return a copy to prevent external modifications
  return [...claims];
};

/**
 * Broadcast a claim event to the Supabase real-time channel
 */
const broadcastClaimEvent = async (claim: any) => {
  try {
    if (!claim || !claim.sessionId) {
      console.error('Cannot broadcast claim: Missing session ID');
      return;
    }

    logWithTimestamp(`Broadcasting claim ${claim.id} for player ${claim.playerName || claim.playerId} in session ${claim.sessionId}`);

    // FIXED: Use consistent channel name "game-updates" for all claim-related broadcasts
    const broadcastChannel = supabase.channel('game-updates');
    
    // Broadcast the claim to all listeners - FIXED: use consistent event name "claim-submitted"
    await broadcastChannel.send({
      type: validateChannelType('broadcast'), 
      event: 'claim-submitted',
      payload: {
        claimId: ensureString(claim.id),
        sessionId: ensureString(claim.sessionId),
        playerId: ensureString(claim.playerId),
        playerName: ensureString(claim.playerName || 'unknown'),
        timestamp: claim.timestamp,
        toGoCount: claim.toGoCount || 0,
        gameType: ensureString(claim.gameType || 'mainstage'),
        winPattern: ensureString(claim.winPattern || 'oneLine'),
        ticket: claim.ticket // Pass the ticket data for verification
      }
    });
    
    logWithTimestamp(`Claim broadcast sent for player ${claim.playerName || claim.playerId}`);
  } catch (err) {
    console.error("Error broadcasting claim:", err);
  }
};

/**
 * Broadcast a claim result to the specified player
 */
const broadcastClaimResult = async (
  sessionId: string, 
  playerId: string, 
  playerName: string, 
  result: 'valid' | 'invalid' | 'rejected',
  ticket?: any
) => {
  try {
    // FIXED: Use consistent channel name "claim-results-channel" for result broadcasts
    const broadcastChannel = supabase.channel('claim-results-channel');
    
    // Log before broadcasting
    logWithTimestamp(`Broadcasting claim result: ${result} for player ${playerName || playerId} in session ${sessionId}`, 'info');
    
    // Broadcast to all clients - they'll filter based on their own player ID
    await broadcastChannel.send({
      type: validateChannelType('broadcast'),
      event: 'claim-result',
      payload: {
        sessionId: ensureString(sessionId),
        playerId: ensureString(playerId),
        playerName: ensureString(playerName),
        result,
        timestamp: new Date().toISOString(),
        ticket: ticket ? {
          serial: ensureString(ticket.serial),
          numbers: ticket.numbers,
          calledNumbers: ticket.calledNumbers
        } : undefined
      }
    });
    
    logWithTimestamp(`Broadcast claim result sent: ${result} for player ${playerName || playerId}`);
    
    // Remove claim from pending list if found
    const sessionClaims = pendingClaims.get(sessionId) || [];
    const updatedClaims = sessionClaims.filter(claim => claim.playerId !== playerId);
    pendingClaims.set(sessionId, updatedClaims);
    
  } catch (err) {
    console.error("Error broadcasting claim result:", err);
  }
};

/**
 * Clear all claims for a session (e.g., when game ends)
 */
const clearClaimsForSession = (sessionId: string) => {
  if (pendingClaims.has(sessionId)) {
    pendingClaims.delete(sessionId);
    logWithTimestamp(`Cleared all claims for session ${sessionId}`);
  }
};

export const claimService = {
  submitClaim,
  processClaim,
  getClaimsForSession,
  broadcastClaimEvent,
  broadcastClaimResult,
  clearClaimsForSession
};
