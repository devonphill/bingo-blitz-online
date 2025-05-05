
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
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
  
  // Load claims on mount and set up subscription
  useEffect(() => {
    if (!sessionId) return;
    
    // Initial fetch of claims
    const fetchClaims = async () => {
      if (!sessionId) return;
      
      try {
        setIsProcessingClaim(true);
        const fetched = await network.fetchClaims(sessionId);
        if (isMounted.current) {
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
    
    fetchClaims();
    
    // Subscribe to new claims
    const channel = supabase
      .channel(`claims-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'universal_game_logs',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        // Refetch claims when a new one comes in
        fetchClaims();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
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
      return;
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
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An error occurred while processing the claim",
        variant: "destructive"
      });
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
