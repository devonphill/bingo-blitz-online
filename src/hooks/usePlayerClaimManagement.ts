
import { useState, useCallback, useEffect } from 'react';
import { toast } from "sonner";
import usePlayerWebSocketNumbers from './playerWebSocket/usePlayerWebSocketNumbers';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { EVENT_TYPES } from '@/constants/websocketConstants';

interface PlayerClaimOptions {
  sessionId: string;
  playerName?: string;
  playerCode?: string;
}

export const usePlayerClaimManagement = ({ sessionId, playerName, playerCode }: PlayerClaimOptions) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<'VALID' | 'INVALID' | null>(null);
  const [isCheckingClaim, setIsCheckingClaim] = useState(false);

  // Using our websocket hook to handle connection status
  const websocket = usePlayerWebSocketNumbers(sessionId);
  
  // We need to modify this line to check isConnected instead of isWsReady
  const isConnectionReady = websocket.isConnected;

  // Listen for claim validation results
  useEffect(() => {
    if (!sessionId || !isConnectionReady) return;

    const connectionManager = getNCMInstance();
    const claimValidationChannelName = `claims_validation-${sessionId}`;

    // Listen for claim validation events
    const cleanup = connectionManager.listenForEvent(
      claimValidationChannelName,
      EVENT_TYPES.CLAIM_RESOLUTION,
      (data: { result: 'VALID' | 'INVALID', claim_id?: string }) => {
        console.log('Claim validation result received:', data);
        
        if (data.result === 'VALID') {
          toast.success('Your claim is valid! 🎉');
          setClaimResult('VALID');
        } else {
          toast.error('Your claim was rejected');
          setClaimResult('INVALID');
        }
        
        setIsCheckingClaim(false);
      }
    );

    return cleanup;
  }, [sessionId, isConnectionReady]);

  // Function to submit a claim
  const submitClaim = useCallback((ticketData: any) => {
    if (!sessionId || !isConnectionReady) {
      toast.error('Cannot submit claim: connection not ready');
      return;
    }
    
    setIsClaiming(true);
    setClaimResult(null);
    
    try {
      const connectionManager = getNCMInstance();
      const claimSenderChannelName = `claim_sender-${sessionId}`;
      
      const claimData = {
        ticketDetails: ticketData,
        playerName: playerName || 'Unknown Player',
        playerCode: playerCode || 'UNKNOWN',
        sessionId,
        timestamp: new Date().toISOString()
      };
      
      connectionManager.listenForEvent(
        claimSenderChannelName, 
        EVENT_TYPES.CLAIM_SUBMITTED, 
        claimData
      );
      
      setIsCheckingClaim(true);
      toast.info('Your claim has been sent for validation');
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
      setIsClaiming(false);
    }
  }, [sessionId, isConnectionReady, playerName, playerCode]);

  return {
    submitClaim,
    isClaiming,
    isCheckingClaim,
    claimResult,
    clearClaimResult: () => setClaimResult(null)
  };
};

export default usePlayerClaimManagement;
