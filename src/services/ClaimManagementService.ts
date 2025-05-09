
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { v4 as uuidv4 } from 'uuid';

// Define BingoClaim type
export interface BingoClaim {
  id: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  gameNumber: number;
  winPattern: string;
  gameType: string;
  ticket: {
    serial: string;
    perm: number;
    position: number;
    layoutMask: number;
    numbers: number[];
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
  claimedAt: Date;
  toGoCount?: number;
  hasLastCalledNumber?: boolean;
}

// In-memory storage for pending claims by session
const claimQueues: Map<string, BingoClaim[]> = new Map();
const sessionSubscribers: Map<string, Set<(claims: BingoClaim[]) => void>> = new Map();

// Track recently processed claims to prevent re-adding them
const recentlyProcessedClaims = new Map<string, number>();

class ClaimManagementService {
  // Register a session to track claims
  registerSession(sessionId: string): void {
    if (!sessionId) {
      console.error("Cannot register session: sessionId is null or undefined");
      return;
    }
    
    logWithTimestamp(`Registering session for claim tracking: ${sessionId}`, 'info');
    
    if (!claimQueues.has(sessionId)) {
      claimQueues.set(sessionId, []);
    }
  }
  
  // Unregister a session when done
  unregisterSession(sessionId: string): void {
    logWithTimestamp(`Unregistering session from claim tracking: ${sessionId}`, 'info');
    claimQueues.delete(sessionId);
    sessionSubscribers.delete(sessionId);
  }
  
  // Submit a new claim - MEMORY ONLY, NO DATABASE WRITE
  submitClaim(claimData: any): boolean {
    try {
      if (!claimData.sessionId) {
        console.error("Missing sessionId in claim data");
        return false;
      }
      
      logWithTimestamp(`Submitting claim for session ${claimData.sessionId}`, 'info');
      logWithTimestamp(`Claim data details: ${JSON.stringify(claimData)}`, 'debug');
      
      // Generate a unique ID for the claim
      const claimId = claimData.id || uuidv4();
      
      // Create the claim object
      const claim: BingoClaim = {
        id: claimId,
        playerId: claimData.playerId || 'unknown-player',
        playerName: claimData.playerName || 'Unknown Player',
        sessionId: claimData.sessionId,
        gameNumber: claimData.gameNumber || 1,
        winPattern: claimData.winPattern || 'oneLine',
        gameType: claimData.gameType || 'mainstage',
        ticket: claimData.ticket || { 
          serial: 'unknown',
          perm: 0,
          position: 0,
          layoutMask: 0,
          numbers: []
        },
        calledNumbers: claimData.calledNumbers || [],
        lastCalledNumber: claimData.lastCalledNumber || null,
        claimedAt: new Date()
      };
      
      // Add the claim to the queue for this session
      if (!claimQueues.has(claim.sessionId)) {
        logWithTimestamp(`Creating new claim queue for session ${claim.sessionId}`, 'info');
        claimQueues.set(claim.sessionId, []);
      }
      
      // Check if this player already has a pending claim with this win pattern in this session
      const existingQueue = claimQueues.get(claim.sessionId) || [];
      const isDuplicate = existingQueue.some(existing => 
        (existing.id === claim.id) || 
        (existing.playerId === claim.playerId && 
         existing.gameNumber === claim.gameNumber && 
         existing.winPattern === claim.winPattern &&
         existing.ticket.serial === claim.ticket.serial)
      );
      
      // Also check if this claim was recently processed
      const wasRecentlyProcessed = recentlyProcessedClaims.has(
        `${claim.playerId}-${claim.sessionId}-${claim.gameNumber}-${claim.winPattern}-${claim.ticket.serial}`
      );
      
      if (isDuplicate || wasRecentlyProcessed) {
        logWithTimestamp(`Skipping duplicate claim for player ${claim.playerName}`, 'info');
        return false;
      }
      
      // Add ticket validation metrics
      if (claim.ticket && claim.ticket.numbers && claim.calledNumbers) {
        // Calculate "to go" count - how many numbers on the ticket aren't called yet
        const uncalledNumbers = claim.ticket.numbers.filter(n => !claim.calledNumbers.includes(n));
        claim.toGoCount = uncalledNumbers.length;
        
        // Check if the last called number is on this ticket
        claim.hasLastCalledNumber = claim.lastCalledNumber !== null && 
                                   claim.ticket.numbers.includes(claim.lastCalledNumber);
                                   
        logWithTimestamp(`Claim metrics: ${claim.toGoCount} to go, has last called number: ${claim.hasLastCalledNumber}`, 'info');
      }
      
      // Add to queue
      const queue = claimQueues.get(claim.sessionId) || [];
      queue.push(claim);
      claimQueues.set(claim.sessionId, queue);
      
      logWithTimestamp(`Added claim to queue. Queue now has ${queue.length} claims for session ${claim.sessionId}`, 'info');
      
      // Notify subscribers
      this.notifySubscribers(claim.sessionId);
      
      // ENHANCED: Use multiple channels to ensure claim is broadcast
      this.broadcastClaimEvent(claim);
      
      return true;
    } catch (error) {
      console.error("Error submitting claim:", error);
      return false;
    }
  }
  
  // Get all claims for a session
  getClaimsForSession(sessionId: string): BingoClaim[] {
    if (!sessionId) {
      return [];
    }
    
    return claimQueues.get(sessionId) || [];
  }
  
  // Subscribe to claim queue updates for a session
  subscribeToClaimQueue(sessionId: string, callback: (claims: BingoClaim[]) => void): () => void {
    if (!sessionId) {
      logWithTimestamp("Cannot subscribe to claim queue: sessionId is null or undefined", 'error');
      return () => {}; // Return empty unsubscribe function
    }
    
    logWithTimestamp(`Setting up claim queue subscription for session ${sessionId}`, 'info');
    
    if (!sessionSubscribers.has(sessionId)) {
      sessionSubscribers.set(sessionId, new Set());
    }
    
    const subscribers = sessionSubscribers.get(sessionId)!;
    subscribers.add(callback);
    
    // Initial callback with current claims
    const currentClaims = claimQueues.get(sessionId) || [];
    logWithTimestamp(`Initial claim subscription callback with ${currentClaims.length} claims`, 'info');
    callback(currentClaims);
    
    // Return unsubscribe function
    return () => {
      logWithTimestamp(`Unsubscribing from claim queue for session ${sessionId}`, 'info');
      const subs = sessionSubscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
      }
    };
  }
  
  // Process a claim (valid or invalid) - this is when we write to the database
  async processClaim(claimId: string, sessionId: string, isValid: boolean, onGameProgress?: () => void): Promise<boolean> {
    try {
      if (!sessionId) {
        logWithTimestamp("Cannot process claim: sessionId is null or undefined", 'error');
        return false;
      }
      
      // Find the claim in the queue
      const queue = claimQueues.get(sessionId) || [];
      const claimIndex = queue.findIndex(c => c.id === claimId);
      
      if (claimIndex === -1) {
        console.error(`Claim ${claimId} not found in session ${sessionId}`);
        return false;
      }
      
      const claim = queue[claimIndex];
      const claimKey = `${claim.playerId}-${claim.sessionId}-${claim.gameNumber}-${claim.winPattern}-${claim.ticket.serial}`;
      
      logWithTimestamp(`Processing claim ${claimId} as ${isValid ? 'valid' : 'invalid'}`, 'info');
      
      // Now write to the database - this is the only place we write claims to the database
      const { error: insertError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: claim.sessionId,
          player_id: claim.playerId,
          player_name: claim.playerName,
          game_number: claim.gameNumber || 1,
          game_type: claim.gameType || 'mainstage',
          win_pattern: claim.winPattern || 'oneLine',
          ticket_serial: claim.ticket.serial,
          ticket_perm: claim.ticket.perm,
          ticket_position: claim.ticket.position,
          ticket_layout_mask: claim.ticket.layoutMask,
          ticket_numbers: claim.ticket.numbers,
          called_numbers: claim.calledNumbers,
          last_called_number: claim.lastCalledNumber,
          total_calls: claim.calledNumbers.length,
          claimed_at: claim.claimedAt.toISOString(),
          validated_at: new Date().toISOString(), // Set timestamp when validated
          prize_shared: isValid // Set prize shared to true only if valid
        });
      
      if (insertError) {
        console.error("Error creating validated claim:", insertError);
        return false;
      }
      
      // ENHANCED: More robust broadcasting with multiple channels
      await this.broadcastClaimResult(claim.playerId, isValid ? 'valid' : 'invalid');
      
      // Add to recently processed claims to prevent re-adding
      recentlyProcessedClaims.set(claimKey, Date.now());
      
      // Remove from queue
      queue.splice(claimIndex, 1);
      claimQueues.set(sessionId, queue);
      
      // Notify subscribers about the updated queue
      this.notifySubscribers(sessionId);
      
      // Clean up old processed claims after 10 seconds
      setTimeout(() => {
        recentlyProcessedClaims.delete(claimKey);
      }, 10000);
      
      // Call game progress callback if provided and claim was valid
      if (isValid && onGameProgress) {
        logWithTimestamp('Valid claim processed, triggering game progress callback', 'info');
        onGameProgress();
      }
      
      logWithTimestamp(`Successfully processed claim ${claimId} as ${isValid ? 'valid' : 'invalid'}. ${queue.length} claims remaining.`, 'info');
      return true;
    } catch (error) {
      console.error("Error processing claim:", error);
      return false;
    }
  }
  
  // Clear all claims for a session
  clearClaimsForSession(sessionId: string): void {
    if (!sessionId) return;
    
    logWithTimestamp(`Clearing all claims for session ${sessionId}`, 'info');
    claimQueues.set(sessionId, []);
    this.notifySubscribers(sessionId);
  }
  
  // Private helper methods
  private notifySubscribers(sessionId: string): void {
    const subscribers = sessionSubscribers.get(sessionId);
    if (!subscribers) return;
    
    const claims = claimQueues.get(sessionId) || [];
    
    // Sort claims - 0TG first, then by whether they have the last called number
    const sortedClaims = [...claims].sort((a, b) => {
      // First priority: 0TG claims
      if ((a.toGoCount === 0) !== (b.toGoCount === 0)) {
        return (a.toGoCount === 0) ? -1 : 1;
      }
      
      // Second priority: Has last called number
      if (a.hasLastCalledNumber !== b.hasLastCalledNumber) {
        return a.hasLastCalledNumber ? -1 : 1;
      }
      
      // Third priority: Lower TG count
      if (a.toGoCount !== b.toGoCount) {
        return (a.toGoCount || 0) - (b.toGoCount || 0);
      }
      
      // Fourth priority: Submission time (earlier first)
      return a.claimedAt.getTime() - b.claimedAt.getTime();
    });
    
    logWithTimestamp(`Notifying ${subscribers.size} subscribers about ${sortedClaims.length} claims for session ${sessionId}`, 'info');
    
    // Notify all subscribers
    subscribers.forEach(callback => callback(sortedClaims));
  }
  
  // ENHANCED: Broadcast claim to multiple channels for redundancy
  private async broadcastClaimEvent(claim: BingoClaim): Promise<void> {
    try {
      logWithTimestamp(`Broadcasting claim ${claim.id} for player ${claim.playerName} in session ${claim.sessionId}`, 'info');
      
      // Use multiple channels for redundancy
      const channels = [
        'game-updates',
        'caller-notifications',
        `session-${claim.sessionId}`
      ];
      
      // Create payload
      const payload = {
        sessionId: claim.sessionId,
        claimId: claim.id,
        playerId: claim.playerId,
        playerName: claim.playerName,
        gameNumber: claim.gameNumber,
        winPattern: claim.winPattern,
        gameType: claim.gameType,
        ticket: claim.ticket,
        calledNumbers: claim.calledNumbers,
        lastCalledNumber: claim.lastCalledNumber,
        toGoCount: claim.toGoCount
      };
      
      // Broadcast to all channels
      for (const channelName of channels) {
        try {
          const channel = supabase.channel(channelName);
          await channel.send({
            type: 'broadcast',
            event: 'new-claim',
            payload
          });
          supabase.removeChannel(channel);
        } catch (err) {
          console.error(`Error broadcasting to ${channelName}:`, err);
          // Continue with other channels even if one fails
        }
      }
      
      // Also write to database as a backup mechanism
      try {
        await supabase
          .from('universal_game_logs')
          .insert({
            session_id: claim.sessionId,
            player_id: claim.playerId,
            player_name: claim.playerName,
            game_number: claim.gameNumber,
            game_type: claim.gameType,
            win_pattern: claim.winPattern,
            ticket_serial: claim.ticket.serial,
            ticket_perm: claim.ticket.perm,
            ticket_position: claim.ticket.position,
            ticket_layout_mask: claim.ticket.layoutMask,
            ticket_numbers: claim.ticket.numbers,
            called_numbers: claim.calledNumbers,
            last_called_number: claim.lastCalledNumber,
            total_calls: claim.calledNumbers.length,
            claimed_at: claim.claimedAt.toISOString(),
            validated_at: null,
            prize_shared: null
          });
      } catch (dbErr) {
        console.error("Failed to write claim to database as backup:", dbErr);
        // This is just a backup mechanism, so continue even if it fails
      }
      
    } catch (err) {
      console.error("Error broadcasting claim:", err);
    }
  }
  
  // ENHANCED: Broadcast claim result to multiple channels for redundancy
  private async broadcastClaimResult(playerId: string, result: 'valid' | 'invalid'): Promise<void> {
    try {
      logWithTimestamp(`Broadcasting claim result (${result}) to player ${playerId}`, 'info');
      
      // Use multiple channels for redundancy
      const channels = [
        'claim-results-channel',
        'player-notifications',
        `player-${playerId}`
      ];
      
      // Broadcast to all channels
      for (const channelName of channels) {
        try {
          const channel = supabase.channel(channelName);
          await channel.send({
            type: 'broadcast',
            event: 'claim-result',
            payload: {
              playerId,
              result
            }
          });
          supabase.removeChannel(channel);
        } catch (err) {
          console.error(`Error broadcasting to ${channelName}:`, err);
          // Continue with other channels even if one fails
        }
      }
      
    } catch (err) {
      console.error("Error broadcasting claim result:", err);
    }
  }
}

// Export a singleton instance
export const claimService = new ClaimManagementService();
