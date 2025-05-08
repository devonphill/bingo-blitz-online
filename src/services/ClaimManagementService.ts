
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { v4 as uuidv4 } from 'uuid';

export interface BingoClaim {
  id: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  gameNumber: number;
  winPattern: string;
  claimedAt: Date;
  ticket: {
    serial: string;
    perm: number;
    position: number;
    layoutMask: number;
    numbers: number[];
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
  toGoCount?: number; // Number of numbers still needed
  hasLastCalledNumber?: boolean; // Whether the ticket contains the last called number
  gameType?: string;
}

class ClaimManagementService {
  private static instance: ClaimManagementService;
  private activeClaimQueue: Map<string, BingoClaim[]> = new Map();
  private listeners: Map<string, Set<(claims: BingoClaim[]) => void>> = new Map();

  private constructor() {
    // Initialize broadcast channel listener
    this.setupBroadcastListener();
  }

  public static getInstance(): ClaimManagementService {
    if (!ClaimManagementService.instance) {
      ClaimManagementService.instance = new ClaimManagementService();
    }
    return ClaimManagementService.instance;
  }

  private setupBroadcastListener(): void {
    logWithTimestamp('Setting up claim broadcast listener', 'info', 'ClaimService');
    
    // Listen for incoming claim broadcasts
    const channel = supabase.channel('bingo-claims-channel')
      .on('broadcast', { event: 'bingo-claim' }, (payload) => {
        if (payload.payload) {
          const { sessionId } = payload.payload;
          logWithTimestamp(`Received claim broadcast for session ${sessionId}`, 'info', 'ClaimService');
          
          // If the claim is for a session we're tracking, add it to the queue
          if (this.activeClaimQueue.has(sessionId)) {
            this.addClaimToQueue(payload.payload);
          }
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`Claim broadcast channel status: ${status}`, 'info', 'ClaimService');
      });
  }

  // Add a claim to the queue
  private addClaimToQueue(claimData: any): void {
    if (!claimData.sessionId) {
      logWithTimestamp('Invalid claim data - missing sessionId', 'error', 'ClaimService');
      return;
    }

    // Generate a unique ID if not provided
    const claim: BingoClaim = {
      id: claimData.id || uuidv4(),
      playerId: claimData.playerId,
      playerName: claimData.playerName,
      sessionId: claimData.sessionId,
      gameNumber: claimData.gameNumber || 1,
      winPattern: claimData.winPattern || 'oneLine',
      claimedAt: new Date(claimData.claimedAt || Date.now()),
      ticket: claimData.ticket,
      calledNumbers: claimData.calledNumbers || [],
      lastCalledNumber: claimData.lastCalledNumber || null,
      gameType: claimData.gameType || 'mainstage'
    };

    // Calculate toGoCount and hasLastCalledNumber if ticket exists
    if (claim.ticket && claim.calledNumbers) {
      // Count how many numbers are left to be called on this ticket
      const ticketNumbers = new Set(claim.ticket.numbers);
      const calledSet = new Set(claim.calledNumbers);
      
      let toGo = 0;
      ticketNumbers.forEach(num => {
        if (!calledSet.has(num)) {
          toGo++;
        }
      });
      
      claim.toGoCount = toGo;
      claim.hasLastCalledNumber = claim.lastCalledNumber !== null && 
                                 ticketNumbers.has(claim.lastCalledNumber);
    }

    // Add to queue
    const sessionClaims = this.activeClaimQueue.get(claim.sessionId) || [];
    sessionClaims.push(claim);
    this.activeClaimQueue.set(claim.sessionId, sessionClaims);
    
    // Notify listeners
    this.notifyListeners(claim.sessionId);
  }

  // Register to track claims for a session
  public registerSession(sessionId: string): void {
    if (!this.activeClaimQueue.has(sessionId)) {
      this.activeClaimQueue.set(sessionId, []);
    }
  }

  // Unregister a session
  public unregisterSession(sessionId: string): void {
    this.activeClaimQueue.delete(sessionId);
    this.listeners.delete(sessionId);
  }

  // Get claims for a session
  public getClaimsForSession(sessionId: string): BingoClaim[] {
    return [...(this.activeClaimQueue.get(sessionId) || [])].sort((a, b) => {
      // Sort by toGoCount first (0TG first)
      if (a.toGoCount !== b.toGoCount) {
        return (a.toGoCount || 0) - (b.toGoCount || 0);
      }
      
      // Then prioritize tickets with the last called number
      if (a.hasLastCalledNumber !== b.hasLastCalledNumber) {
        return a.hasLastCalledNumber ? -1 : 1;
      }
      
      // Then by claim time (oldest first)
      return a.claimedAt.getTime() - b.claimedAt.getTime();
    });
  }

  // Submit a new claim
  public submitClaim(claim: Omit<BingoClaim, 'id' | 'claimedAt'>): boolean {
    try {
      const fullClaim: BingoClaim = {
        ...claim,
        id: uuidv4(),
        claimedAt: new Date(),
      };

      // Broadcast the claim
      supabase.channel('bingo-claims-channel').send({
        type: 'broadcast',
        event: 'bingo-claim',
        payload: fullClaim
      }).then(() => {
        logWithTimestamp('Claim broadcast sent successfully', 'info', 'ClaimService');
        
        // Also add to our local queue if we're tracking this session
        if (this.activeClaimQueue.has(fullClaim.sessionId)) {
          this.addClaimToQueue(fullClaim);
        }
      }).catch(error => {
        logWithTimestamp(`Error broadcasting claim: ${error}`, 'error', 'ClaimService');
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error submitting claim: ${error}`, 'error', 'ClaimService');
      return false;
    }
  }

  // Process a claim (mark as valid or invalid)
  public async processClaim(
    claimId: string, 
    sessionId: string, 
    isValid: boolean
  ): Promise<boolean> {
    try {
      // Find the claim in our queue
      const sessionClaims = this.activeClaimQueue.get(sessionId) || [];
      const claimIndex = sessionClaims.findIndex(claim => claim.id === claimId);
      
      if (claimIndex === -1) {
        logWithTimestamp(`Claim ${claimId} not found in queue for session ${sessionId}`, 'error', 'ClaimService');
        return false;
      }
      
      const claim = sessionClaims[claimIndex];
      
      // Now write to database
      const { error } = await supabase
        .from('universal_game_logs')
        .insert({
          id: claim.id, // Use the same ID for traceability
          session_id: claim.sessionId,
          player_id: claim.playerId,
          player_name: claim.playerName,
          game_number: claim.gameNumber,
          game_type: claim.gameType || 'mainstage',
          win_pattern: claim.winPattern,
          claimed_at: claim.claimedAt.toISOString(),
          validated_at: new Date().toISOString(),
          prize_shared: isValid,
          ticket_serial: claim.ticket.serial,
          ticket_perm: claim.ticket.perm,
          ticket_position: claim.ticket.position,
          ticket_layout_mask: claim.ticket.layoutMask,
          ticket_numbers: claim.ticket.numbers,
          called_numbers: claim.calledNumbers,
          last_called_number: claim.lastCalledNumber,
          total_calls: claim.calledNumbers.length,
          validation_result: isValid ? 'valid' : 'invalid'
        });
        
      if (error) {
        logWithTimestamp(`Error writing claim to database: ${error.message}`, 'error', 'ClaimService');
        return false;
      }
      
      // Remove from queue
      sessionClaims.splice(claimIndex, 1);
      this.activeClaimQueue.set(sessionId, sessionClaims);
      
      // Broadcast the result
      await supabase.channel('claim-results-channel').send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          claimId,
          sessionId,
          playerId: claim.playerId,
          result: isValid ? 'valid' : 'rejected',
          timestamp: new Date().toISOString()
        }
      });
      
      // Notify listeners that the queue has changed
      this.notifyListeners(sessionId);
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error processing claim: ${error}`, 'error', 'ClaimService');
      return false;
    }
  }

  // Subscribe to changes in the claim queue for a session
  public subscribeToClaimQueue(
    sessionId: string, 
    callback: (claims: BingoClaim[]) => void
  ): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    
    const sessionListeners = this.listeners.get(sessionId)!;
    sessionListeners.add(callback);
    
    // Immediately call with current state
    callback(this.getClaimsForSession(sessionId));
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(sessionId);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  private notifyListeners(sessionId: string): void {
    const listeners = this.listeners.get(sessionId);
    if (!listeners) return;
    
    const claims = this.getClaimsForSession(sessionId);
    listeners.forEach(callback => callback(claims));
  }
  
  // Clear all claims for a session (e.g. when game ends)
  public clearClaimsForSession(sessionId: string): void {
    this.activeClaimQueue.set(sessionId, []);
    this.notifyListeners(sessionId);
  }
}

// Export singleton instance
export const claimService = ClaimManagementService.getInstance();
