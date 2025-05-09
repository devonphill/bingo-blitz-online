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
    logWithTimestamp(`Found ${claims.length} claims in storage service`);

    // Return a copy to prevent external modifications
    return [...claims];
  }

  /**
   * Store a claim in the in-memory storage
   */
  public storeClaim(claim: ClaimData): boolean {
    if (!claim || !claim.sessionId) {
      logWithTimestamp('Cannot store claim: Missing session ID', 'error');
      return false;
    }

    const sessionId = claim.sessionId;

    // Create a new queue for this session if it doesn't exist yet
    if (!this.pendingClaims.has(sessionId)) {
      logWithTimestamp(`Creating new claim queue for session ${sessionId}`);
      this.pendingClaims.set(sessionId, []);
    }

    // Track the claim ID
    this.claimIds.add(claim.id);

    // Add to the queue for this session
    const sessionClaims = this.pendingClaims.get(sessionId) || [];
    sessionClaims.push(claim);
    this.pendingClaims.set(sessionId, sessionClaims);

    logWithTimestamp(`Added claim to queue. Queue now has ${sessionClaims.length} claims for session ${sessionId}`);
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
    logWithTimestamp(`Removed claim ${claimId} from pending queue. Queue now has ${sessionClaims.length} claims.`);
    
    return claim;
  }

  /**
   * Clear all claims for a session (e.g., when game ends)
   */
  public clearClaimsForSession(sessionId: string): void {
    if (this.pendingClaims.has(sessionId)) {
      this.pendingClaims.delete(sessionId);
      logWithTimestamp(`Cleared all claims for session ${sessionId}`);
    }
  }

  /**
   * Remove claims by player ID
   */
  public removeClaimsByPlayerId(sessionId: string, playerId: string): void {
    if (!sessionId || !playerId) return;

    const sessionClaims = this.pendingClaims.get(sessionId) || [];
    const updatedClaims = sessionClaims.filter(claim => claim.playerId !== playerId);
    this.pendingClaims.set(sessionId, updatedClaims);
  }
}

// Export a singleton instance
export const claimStorageService = new ClaimStorageService();
