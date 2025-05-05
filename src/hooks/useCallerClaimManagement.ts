
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';

/**
 * Hook to manage bingo claims for a caller
 * @param sessionId The game session ID
 * @returns The claims and methods to validate them
 */
export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();
  
  // Reference to check if component is mounted
  const isMounted = useRef(true);
  
  // Use the network context
  const network = useNetwork();
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Set up listener for new claims
  useEffect(() => {
    if (!sessionId) return;
    
    // Initial fetch of claims
    const fetchClaims = async () => {
      if (!sessionId) return;
      
      try {
        setIsProcessingClaim(true);
        logWithTimestamp(`Fetching claims for session ${sessionId}`, 'info');
        
        // Use the fetch claims method from our network context
        const fetched = await network.fetchClaims(sessionId);
        
        if (isMounted.current) {
          logWithTimestamp(`Found ${fetched?.length || 0} claims for session ${sessionId}`, 'info');
          setClaims(fetched || []);
          setIsProcessingClaim(false);
        }
      } catch (error) {
        console.error('Error fetching claims:', error);
        if (isMounted.current) {
          setIsProcessingClaim(false);
        }
      }
    };
    
    // Run initial fetch
    fetchClaims();
    
    // Set up real-time listener through our network context
    const removeListener = network.addGameStateUpdateListener((gameState) => {
      // Re-fetch claims when game state changes
      fetchClaims();
    });
    
    return () => {
      removeListener();
    };
  }, [sessionId, network]);
  
  // For new claims specifically, set up a broadcast listener
  useEffect(() => {
    if (!sessionId) return;
    
    // Subscribe to broadcast channel for new claims
    const channel = network.addConnectionStatusListener((isConnected) => {
      // When connection state changes, refetch claims if connected
      if (isConnected) {
        // Use the fetch claims method from our network context
        network.fetchClaims(sessionId)
          .then(fetched => {
            if (isMounted.current) {
              setClaims(fetched || []);
            }
          })
          .catch(error => {
            console.error('Error fetching claims after connection change:', error);
          });
      }
    });
    
    return () => {
      channel();
    };
  }, [sessionId, network]);
  
  // Validate a claim (approve or reject)
  const validateClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!claim || !claim.id) {
      toast({
        title: "Error",
        description: "Invalid claim data",
        variant: "destructive"
      });
      return false;
    }
    
    try {
      setIsProcessingClaim(true);
      
      // Use the network context to validate the claim
      const success = await network.validateClaim(claim, isValid);
      
      if (success) {
        // Remove the claim from the local state to avoid showing it again
        if (isMounted.current) {
          setClaims(prev => prev.filter(c => c.id !== claim.id));
        }
        
        toast({
          title: isValid ? "Claim Verified" : "Claim Rejected",
          description: isValid 
            ? `The bingo claim for ${claim.player_name || ''} has been verified.` 
            : `The bingo claim for ${claim.player_name || ''} has been rejected.`,
          variant: isValid ? "default" : "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to process the claim",
          variant: "destructive"
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An error occurred while processing the claim",
        variant: "destructive"
      });
      return false;
    } finally {
      if (isMounted.current) {
        setIsProcessingClaim(false);
      }
    }
  }, [toast, network]);
  
  return {
    claims,
    validateClaim,
    isProcessingClaim
  };
}
