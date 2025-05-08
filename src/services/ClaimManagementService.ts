
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

class ClaimManagementService {
  // Register a session to track claims
  registerSession(sessionId: string): void {
    if (!claimQueues.has(sessionId)) {
      claimQueues.set(sessionId, []);
    }
  }
  
  // Unregister a session when done
  unregisterSession(sessionId: string): void {
    claimQueues.delete(sessionId);
    sessionSubscribers.delete(sessionId);
  }
  
  // Submit a new claim
  submitClaim(claimData: any): boolean {
    try {
      if (!claimData.sessionId) {
        console.error("Missing sessionId in claim data");
        return false;
      }
      
      // Generate a unique ID for the claim
      const claimId = uuidv4();
      
      // Create the claim object
      const claim: BingoClaim = {
        id: claimId,
        playerId: claimData.playerId,
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
        claimQueues.set(claim.sessionId, []);
      }
      
      // Add ticket validation metrics
      if (claim.ticket && claim.ticket.numbers && claim.calledNumbers) {
        // Calculate "to go" count - how many numbers on the ticket aren't called yet
        const uncalledNumbers = claim.ticket.numbers.filter(n => !claim.calledNumbers.includes(n));
        claim.toGoCount = uncalledNumbers.length;
        
        // Check if the last called number is on this ticket
        claim.hasLastCalledNumber = claim.lastCalledNumber !== null && 
                                   claim.ticket.numbers.includes(claim.lastCalledNumber);
      }
      
      // Add to queue
      const queue = claimQueues.get(claim.sessionId) || [];
      queue.push(claim);
      claimQueues.set(claim.sessionId, queue);
      
      // Notify subscribers
      this.notifySubscribers(claim.sessionId);
      
      // Also broadcast the claim event for real-time updates
      this.broadcastClaimEvent(claim);
      
      logWithTimestamp(`Claim submitted for session ${claim.sessionId} by player ${claim.playerName}`, 'info');
      return true;
    } catch (error) {
      console.error("Error submitting claim:", error);
      return false;
    }
  }
  
  // Subscribe to claim queue updates for a session
  subscribeToClaimQueue(sessionId: string, callback: (claims: BingoClaim[]) => void): () => void {
    if (!sessionSubscribers.has(sessionId)) {
      sessionSubscribers.set(sessionId, new Set());
    }
    
    const subscribers = sessionSubscribers.get(sessionId)!;
    subscribers.add(callback);
    
    // Initial callback with current claims
    const currentClaims = claimQueues.get(sessionId) || [];
    callback(currentClaims);
    
    // Return unsubscribe function
    return () => {
      const subs = sessionSubscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
      }
    };
  }
  
  // Process a claim (valid or invalid)
  async processClaim(claimId: string, sessionId: string, isValid: boolean): Promise<boolean> {
    try {
      // Find the claim in the queue
      const queue = claimQueues.get(sessionId) || [];
      const claimIndex = queue.findIndex(c => c.id === claimId);
      
      if (claimIndex === -1) {
        console.error(`Claim ${claimId} not found in session ${sessionId}`);
        return false;
      }
      
      const claim = queue[claimIndex];
      
      // Process the claim in the database
      const { error } = await supabase
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
          validated_at: new Date().toISOString(),
          prize_shared: isValid
        });
      
      if (error) {
        console.error("Error processing claim:", error);
        return false;
      }
      
      // Broadcast the result to the player
      await this.broadcastClaimResult(claim.playerId, isValid ? 'valid' : 'invalid');
      
      // Remove from queue
      queue.splice(claimIndex, 1);
      claimQueues.set(sessionId, queue);
      
      // Notify subscribers
      this.notifySubscribers(sessionId);
      
      return true;
    } catch (error) {
      console.error("Error processing claim:", error);
      return false;
    }
  }
  
  // Clear all claims for a session
  clearClaimsForSession(sessionId: string): void {
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
    
    // Notify all subscribers
    subscribers.forEach(callback => callback(sortedClaims));
  }
  
  // Broadcast claim to all listeners in session
  private async broadcastClaimEvent(claim: BingoClaim): Promise<void> {
    try {
      const channel = supabase.channel('game-updates');
      await channel.send({
        type: 'broadcast',
        event: 'new-claim',
        payload: {
          sessionId: claim.sessionId,
          claimId: claim.id,
          playerId: claim.playerId,
          playerName: claim.playerName
        }
      });
    } catch (err) {
      console.error("Error broadcasting claim:", err);
    }
  }
  
  // Broadcast claim result to the player
  private async broadcastClaimResult(playerId: string, result: 'valid' | 'invalid'): Promise<void> {
    try {
      const channel = supabase.channel('claim-results-channel');
      await channel.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          playerId,
          result
        }
      });
    } catch (err) {
      console.error("Error broadcasting claim result:", err);
    }
  }
}

// Export a singleton instance
export const claimService = new ClaimManagementService();
