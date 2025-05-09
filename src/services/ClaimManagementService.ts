import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

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
    const sessionId = claimData.sessionId;
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

    // Create a channel for broadcasting
    const broadcastChannel = supabase.channel('game-updates');
    
    // Broadcast the claim to all listeners
    await broadcastChannel.send({
      type: 'broadcast', 
      event: 'claim-submitted',
      payload: {
        claimId: claim.id,
        sessionId: claim.sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'unknown',
        timestamp: claim.timestamp,
        toGoCount: claim.toGoCount || 0,
        gameType: claim.gameType || 'mainstage',
        winPattern: claim.winPattern || 'oneLine'
      }
    });
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
    // Create a channel for broadcasting
    const broadcastChannel = supabase.channel('claim-results-channel');
    
    // Broadcast to all clients - they'll filter based on their own player ID
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'claim-result',
      payload: {
        sessionId,
        playerId,
        playerName,
        result,
        timestamp: new Date().toISOString(),
        ticket: ticket ? {
          serial: ticket.serial,
          numbers: ticket.numbers,
          calledNumbers: ticket.calledNumbers
        } : undefined
      }
    });
    
    logWithTimestamp(`Broadcast claim result: ${result} for player ${playerName || playerId}`);
    
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
  getClaimsForSession,
  broadcastClaimEvent,
  broadcastClaimResult,
  clearClaimsForSession
};
