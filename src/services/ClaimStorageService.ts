
import { ClaimData } from '@/types/claim';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Service for managing in-memory storage of bingo claims
 */
class ClaimStorageService {
  // Maintain a mapping of session ID -> array of pending claims
  private pendingClaims = new Map<string, ClaimData[]>();
  
  // Keep track of claim IDs to prevent duplicates
  private claimIds = new Set<string>();

  /**
   * Get all pending claims for a specific session
   */
  public getClaimsForSession(sessionId: string): ClaimData[] {
    if (!sessionId) return [];

    // Get from the in-memory map
    const claims = this.pendingClaims.get(sessionId) || [];
    logWithTimestamp(`Found ${claims.length} claims in storage service for session ${sessionId}`);
    
    if (claims.length > 0) {
      logWithTimestamp(`First claim ID: ${claims[0]?.id}, player: ${claims[0]?.playerName || claims[0]?.playerId}`, 'debug');
    }

    // Return a copy to prevent external modifications
    return [...claims];
  }

  /**
   * Store a claim in the in-memory storage
   */
  public storeClaim(claim: ClaimData): boolean {
    if (!claim || !claim.sessionId) {
      logWithTimestamp('Cannot store claim: Missing session ID or claim object', 'error');
      return false;
    }

    if (!claim.id) {
      logWithTimestamp('Claim is missing ID, cannot store', 'error');
      return false;
    }

    const sessionId = claim.sessionId;

    // Create a new queue for this session if it doesn't exist yet
    if (!this.pendingClaims.has(sessionId)) {
      logWithTimestamp(`Creating new claim queue for session ${sessionId}`);
      this.pendingClaims.set(sessionId, []);
    }

    // Check for duplicate claims
    if (this.claimIds.has(claim.id)) {
      logWithTimestamp(`Duplicate claim ${claim.id} detected, ignoring`, 'warn');
      return false;
    }

    // Track the claim ID
    this.claimIds.add(claim.id);

    // Add to the queue for this session
    const sessionClaims = this.pendingClaims.get(sessionId) || [];
    sessionClaims.push(claim);
    this.pendingClaims.set(sessionId, sessionClaims);

    logWithTimestamp(`Added claim ${claim.id} to queue. Queue now has ${sessionClaims.length} claims for session ${sessionId}`);
    
    // Debug log the state of the map
    for (const [sesId, claims] of this.pendingClaims.entries()) {
      logWithTimestamp(`Session ${sesId}: ${claims.length} claims`);
    }
    
    return true;
  }

  /**
   * Remove a claim from storage
   */
  public removeClaim(sessionId: string, claimId: string): ClaimData | null {
    if (!sessionId || !claimId) {
      logWithTimestamp('Cannot remove claim: Missing session ID or claim ID', 'error');
      return null;
    }

    const sessionClaims = this.pendingClaims.get(sessionId) || [];
    const claimIndex = sessionClaims.findIndex(c => c.id === claimId);

    if (claimIndex === -1) {
      logWithTimestamp(`Claim ${claimId} not found in session ${sessionId}`, 'error');
      return null;
    }

    const claim = sessionClaims[claimIndex];
    
    // Remove from pending claims
    sessionClaims.splice(claimIndex, 1);
    this.pendingClaims.set(sessionId, sessionClaims);
    
    // Remove from claim IDs set
    this.claimIds.delete(claimId);
    
    logWithTimestamp(`Removed claim ${claimId} from pending queue. Queue now has ${sessionClaims.length} claims.`);
    
    return claim;
  }

  /**
   * Clear all claims for a session (e.g., when game ends)
   */
  public clearClaimsForSession(sessionId: string): void {
    if (this.pendingClaims.has(sessionId)) {
      const claims = this.pendingClaims.get(sessionId) || [];
      
      // Remove all claim IDs for this session from the set
      claims.forEach(claim => {
        this.claimIds.delete(claim.id);
      });
      
      this.pendingClaims.delete(sessionId);
      logWithTimestamp(`Cleared all claims for session ${sessionId}`);
    }
  }

  /**
   * Get the current number of claims for a session
   */
  public getClaimCount(sessionId: string): number {
    if (!sessionId) return 0;
    return this.pendingClaims.get(sessionId)?.length || 0;
  }

  /**
   * Remove claims by player ID
   */
  public removeClaimsByPlayerId(sessionId: string, playerId: string): void {
    if (!sessionId || !playerId) return;

    const sessionClaims = this.pendingClaims.get(sessionId) || [];
    const claimsToRemove = sessionClaims.filter(claim => claim.playerId === playerId);
    
    // Remove from claim IDs set
    claimsToRemove.forEach(claim => {
      this.claimIds.delete(claim.id);
    });
    
    const updatedClaims = sessionClaims.filter(claim => claim.playerId !== playerId);
    this.pendingClaims.set(sessionId, updatedClaims);
    
    logWithTimestamp(`Removed ${claimsToRemove.length} claims for player ${playerId} from session ${sessionId}`);
  }
}

// Export a singleton instance
export const claimStorageService = new ClaimStorageService();
