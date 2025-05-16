
import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { v4 as uuidv4 } from 'uuid';
import { toast as sonnerToast } from 'sonner';

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
  const [lastClaimResult, setLastClaimResult] = useState<{id: string, status: string} | null>(null);
  const { toast } = useToast();
  const webSocketService = useRef(getWebSocketService());
  const instanceId = useRef(`claim-${Math.random().toString(36).substring(2, 7)}`);
  const activeClaimIds = useRef<Set<string>>(new Set());

  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
    setLastClaimResult(null);
  }, []);

  // Listen for claim validation events
  useEffect(() => {
    if (!playerCode || !sessionId) return;
    
    logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Setting up claim validation listener for ${playerCode}`, 'info');
    
    const handleClaimValidation = (event: any) => {
      const data = event.payload?.data;
      
      if (!data) {
        console.warn('Received claim validation event with no data');
        return;
      }
      
      logWithTimestamp(`PlayerClaimManagement: Received claim ${data.validationStatus} for claim ${data.claimId}`, 'info');
      console.log('Claim validation data:', data);
      
      // Check if this claim is for this player
      if (data.playerId === playerCode || data.playerId === playerId) {
        logWithTimestamp(`PlayerClaimManagement: Processing claim result for player ${playerCode}`, 'info');
        
        // Update UI based on validation status
        const isValid = data.validationStatus === 'VALID';
        
        setClaimStatus(isValid ? 'validated' : 'rejected');
        setLastClaimResult({
          id: data.claimId,
          status: data.validationStatus
        });
        
        // Remove from active claims
        if (activeClaimIds.current.has(data.claimId)) {
          activeClaimIds.current.delete(data.claimId);
        }
        
        // Update active claims status
        setHasActiveClaims(activeClaimIds.current.size > 0);
        
        // Show toast notification
        sonnerToast[isValid ? 'success' : 'error'](
          isValid ? 'Claim Validated!' : 'Claim Rejected',
          {
            description: isValid 
              ? 'Your claim has been validated by the caller.' 
              : 'Your claim has been rejected by the caller.'
          }
        );
        
        // Auto-reset status after a delay
        setTimeout(() => {
          setClaimStatus('none');
        }, 8000);
      }
    };
    
    // Subscribe to claim validation events
    const unsubscribe = webSocketService.current.subscribe(
      CHANNEL_NAMES.CLAIM_UPDATES,
      EVENT_TYPES.CLAIM_VALIDATED,
      handleClaimValidation
    );
    
    return () => {
      unsubscribe();
    };
  }, [playerCode, playerId, sessionId]);

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
      // Generate a unique ID for this claim
      const claimId = uuidv4();
      
      // Prepare claim data
      const claimData = {
        id: claimId,
        playerCode,
        playerId,
        sessionId,
        playerName,
        gameType,
        winPattern,
        gameNumber: ticket.gameNumber || 1,
        timestamp: new Date().toISOString(),
        ticket: ticket
      };

      logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Submitting claim with payload: ${JSON.stringify(claimData)}`, 'info');

      // Track this claim as active
      activeClaimIds.current.add(claimId);
      setHasActiveClaims(true);

      // Broadcast claim using WebSocket
      const success = await webSocketService.current.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_SUBMITTED,
        claimData
      );

      if (success) {
        logWithTimestamp(`PlayerClaimManagement[${instanceId.current}]: Claim broadcast sent successfully`, 'info');
        
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
    hasActiveClaims,
    lastClaimResult
  };
}
