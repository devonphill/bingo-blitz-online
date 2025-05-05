
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';

// Define a simple interface for the ticket data structure
interface TicketData {
  serial: string;
  numbers: number[];
  layoutMask?: number;
  perm?: number;
  position?: number;
}

// Define a claim interface that includes the optional ticket property
interface Claim {
  id: string;
  player_id?: string;
  playerId?: string;
  playerCode?: string;
  player_code?: string;
  playerName?: string;
  player_name?: string;
  claimed_at?: string;
  ticket_serial?: string;
  ticket_numbers?: number[];
  ticket_layout_mask?: number;
  ticket_perm?: number;
  ticket_position?: number;
  ticket?: TicketData;
  [key: string]: any; // Allow additional properties
}

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();
  
  // Use the network context instead of directly using connectionManager
  const network = useNetwork();

  // Fetch claims on mount and periodically
  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    fetchClaims();
    
    // Set up polling
    const interval = setInterval(fetchClaims, 5000);
    
    // Clean up
    return () => clearInterval(interval);
  }, [sessionId]);

  // Fetch claims from database using the network context
  const fetchClaims = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      // Use network context to fetch claims
      const fetchedClaims = await network.fetchClaims(sessionId);
      
      if (Array.isArray(fetchedClaims) && fetchedClaims.length > 0) {
        logWithTimestamp(`Found ${fetchedClaims.length} pending claims`);
        
        // Process the claims to ensure ticket data is formatted properly
        const processedClaims = fetchedClaims.map(claim => {
          // Create a new claim object to ensure type safety
          const processedClaim: Claim = { ...claim };
          
          // Ensure ticket data is in the expected format
          if (processedClaim.ticket_serial && !processedClaim.ticket) {
            // If we have ticket details but not in the 'ticket' object, construct it
            processedClaim.ticket = {
              serial: processedClaim.ticket_serial,
              numbers: processedClaim.ticket_numbers || [],
              layoutMask: processedClaim.ticket_layout_mask || 0,
              perm: processedClaim.ticket_perm || 0,
              position: processedClaim.ticket_position || 0
            };
          }
          
          return processedClaim;
        });
        
        setClaims(processedClaims);
      } else {
        setClaims([]);
      }
    } catch (err) {
      console.error('Error fetching claims:', err);
      setClaims([]);
    }
  }, [network, sessionId]);

  // Validate or reject a claim
  const validateClaim = useCallback(async (claim: Claim, isValid: boolean) => {
    if (!sessionId || !claim?.id) return;
    
    setIsProcessingClaim(true);
    
    try {
      logWithTimestamp(`Validating claim ${claim.id}, result: ${isValid ? 'valid' : 'rejected'}`);
      
      // Use network context to validate the claim
      const result = await network.validateClaim(claim, isValid);
      
      if (result) {
        // Show toast notification
        toast({
          title: isValid ? "Claim Verified" : "Claim Rejected",
          description: isValid 
            ? "The player's claim has been verified as valid." 
            : "The player's claim has been rejected.",
          duration: 3000
        });
      
        // Refresh claims
        fetchClaims();
      } else {
        throw new Error("Failed to validate claim");
      }
    } catch (err) {
      console.error('Error validating claim:', err);
      toast({
        title: "Error",
        description: "Failed to process the claim. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingClaim(false);
    }
  }, [fetchClaims, network, sessionId, toast]);

  return {
    claims,
    validateClaim,
    isProcessingClaim,
    fetchClaims
  };
}
