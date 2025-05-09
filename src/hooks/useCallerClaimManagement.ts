
import { useState, useEffect, useCallback } from 'react';
import { claimService } from '@/services/ClaimManagementService';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for managing bingo claims from the caller's perspective
 */
export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Refresh claims from the service
  const fetchClaims = useCallback(() => {
    if (!sessionId) {
      setClaims([]);
      return;
    }
    
    logWithTimestamp(`Manually fetching claims for session ${sessionId}`);
    setIsRefreshing(true);
    
    try {
      const sessionClaims = claimService.getClaimsForSession(sessionId);
      setClaims(sessionClaims);
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);
  
  // Set up real-time listener for new claims
  useEffect(() => {
    if (!sessionId) {
      setClaims([]);
      return;
    }
    
    logWithTimestamp(`Setting up claim listener for session ${sessionId}`);
    
    // Listen for claim submissions
    const channel = supabase.channel('game-updates')
      .on('broadcast', { event: 'claim-submitted' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received real-time claim notification for session ${sessionId}`, 'info');
          
          // Show a toast notification for the new claim
          toast({
            title: "New Bingo Claim!",
            description: `${payload.payload.playerName || 'A player'} has claimed bingo!`,
            variant: "destructive",
            duration: 5000,
          });
          
          // Refresh claims to get the latest data
          fetchClaims();
        }
      })
      .subscribe();
      
    // Fetch claims initially
    fetchClaims();
    
    // Clean up
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchClaims, toast]);
  
  // Return claims, count, and refresh function
  return {
    claims,
    claimsCount: claims.length,
    fetchClaims,
    isRefreshing,
    lastRefreshTime
  };
}
