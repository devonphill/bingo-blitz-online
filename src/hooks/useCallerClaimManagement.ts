
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

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

  // Fetch claims from database using the connection manager
  const fetchClaims = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      // Use connection manager to fetch claims
      const fetchedClaims = await connectionManager.fetchClaims(sessionId);
      
      if (Array.isArray(fetchedClaims) && fetchedClaims.length > 0) {
        logWithTimestamp(`Found ${fetchedClaims.length} pending claims`);
        setClaims(fetchedClaims);
      }
      
      // Also do a direct database query as a backup
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
      
      if (error) {
        console.error('Error fetching claims:', error);
      } else if (data && data.length > 0) {
        logWithTimestamp(`Found ${data.length} pending claims in direct query`);
        setClaims(data);
      }
    } catch (err) {
      console.error('Error fetching claims:', err);
    }
  }, [sessionId]);

  // Validate or reject a claim
  const validateClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!sessionId || !claim?.id) return;
    
    setIsProcessingClaim(true);
    
    try {
      logWithTimestamp(`Validating claim ${claim.id}, result: ${isValid ? 'valid' : 'rejected'}`);
      
      // Use connection manager to validate the claim
      const result = await connectionManager.validateClaim(claim, isValid);
      
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
  }, [sessionId, toast, fetchClaims]);

  return {
    claims,
    validateClaim,
    isProcessingClaim,
    fetchClaims
  };
}
