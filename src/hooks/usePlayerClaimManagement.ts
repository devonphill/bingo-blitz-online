
import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for managing player claim submissions without client-side validation
 */
export function usePlayerClaimManagement(
  playerCode: string | null | undefined,
  playerId: string | null | undefined,
  sessionId: string | null,
  playerName: string,
  gameType: string,
  winPattern: string | null
) {
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'validating' | 'validated' | 'rejected'>('none');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [hasActiveClaims, setHasActiveClaims] = useState(false);
  const { toast } = useToast();
  const webSocketService = useRef(getWebSocketService());
  const instanceId = useRef(`claim-${Math.random().toString(36).substring(2, 7)}`);

  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Submit a claim without local validation
  const submitClaim = useCallback(async (ticket: any) => {
    if (!sessionId || !playerId || !playerCode) {
      toast({
        title: "Cannot Submit Claim",
        description: "Missing session or player information",
        variant: "destructive"
      });
      return false;
    }

    if (!winPattern) {
      toast({
        title: "Cannot Submit Claim",
        description: "No active win pattern",
        variant: "destructive"
      });
      return false;
    }

    logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Submitting claim for ${playerCode} in ${sessionId}`, 'info');
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');

    try {
      // Prepare claim data
      const claimData = {
        id: uuidv4(), // Generate a unique ID for this claim
        playerCode,
        playerId,
        sessionId,
        playerName,
        gameType,
        winPattern,
        gameNumber: 1, // Assuming game 1 as default
        timestamp: new Date().toISOString(),
        ticket: ticket
      };

      logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Submitting claim with payload: ${JSON.stringify(claimData)}`, 'info');

      // Broadcast claim using WebSocket
      const success = await webSocketService.current.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_SUBMITTED,
        claimData
      );

      if (success) {
        logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Claim broadcast sent successfully`, 'info');
        setHasActiveClaims(true);
        
        toast({
          title: "Claim Submitted",
          description: "Your claim has been submitted for verification",
        });
        return true;
      } else {
        throw new Error("Failed to broadcast claim");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Error submitting claim: ${errorMessage}`, 'error');
      
      setClaimStatus('none');
      
      toast({
        title: "Claim Failed",
        description: "Failed to submit your claim. Please try again.",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsSubmittingClaim(false);
    }
  }, [playerCode, playerId, sessionId, playerName, gameType, winPattern, toast]);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  };
}
