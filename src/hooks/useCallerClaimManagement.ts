
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { ClaimData, ClaimStatus } from '@/types/claim';

/**
 * Hook for managing caller-side claims with optimistic UI updates
 */
export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsCount, setClaimsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const refreshTimerRef = useRef<number | null>(null);
  const instanceId = useRef(`CallerClaimMgmt-${Math.random().toString(36).substring(2, 7)}`);
  const optimisticClaimsRef = useRef<Map<string, any>>(new Map());
  
  // Custom logging function
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`CallerClaimManagement (${instanceId.current}): ${message}`, level);
  }, []);
  
  // Fetch all pending claims from database
  const fetchClaims = useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      log(`Initial fetch of claims for session ${sessionId}`, 'info');
      
      // Query claims table for pending claims with all necessary fields
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('claimed_at', { ascending: false });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Log raw claims data for debugging
      console.log('[useCallerClaimManagement] Claims fetched from DB:', data);
      
      // Combine with any optimistic claims we have
      const optimisticClaims = Array.from(optimisticClaimsRef.current.values());
      log(`Found ${data?.length || 0} pending claims in DB + ${optimisticClaims.length} optimistic claims`, 'info');
      
      // Deduplicate by claim ID
      const allClaimsMap = new Map<string, any>();
      
      // First add database claims
      if (data) {
        data.forEach(claim => {
          // Convert database ID to string if needed
          const claimId = typeof claim.id === 'number' ? String(claim.id) : claim.id;
          
          allClaimsMap.set(claimId, {
            ...claim,
            id: claimId, // Ensure ID is stored as string
            isOptimistic: false,
            // Ensure these fields are properly mapped for consistent access in UI
            playerName: claim.player_name,
            playerId: claim.player_id,
            playerCode: claim.player_code,
            winPattern: claim.pattern_claimed,
            patternClaimed: claim.pattern_claimed,
            ticket: claim.ticket_details,
            ticketSerial: claim.ticket_serial,
            gameNumber: claim.ticket_details?.game_number || 1, // Access game_number from ticket_details
            timestamp: claim.claimed_at,
            calledNumbers: claim.called_numbers_snapshot
          });
        });
      }
      
      // Then add optimistic claims (will override DB values if same ID)
      optimisticClaims.forEach(claim => {
        allClaimsMap.set(claim.id, {
          ...claim,
          isOptimistic: true
        });
      });
      
      // Convert back to array and sort by timestamp (newest first)
      const allClaims = Array.from(allClaimsMap.values()).sort((a, b) => {
        const timeA = new Date(a.claimed_at || a.timestamp).getTime();
        const timeB = new Date(b.claimed_at || b.timestamp).getTime();
        return timeB - timeA; // Newest first
      });
      
      setClaims(allClaims);
      setClaimsCount(allClaims.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Error fetching claims: ${errorMessage}`, 'error');
      setError(errorMessage);
      toast({
        title: "Error Fetching Claims",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, toast, log]);
  
  // Force refresh claims (triggered by WebSocket or UI)
  const forceRefresh = useCallback(() => {
    log('Forced refresh of claims', 'info');
    
    // Clear any pending refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    // Fetch claims immediately
    fetchClaims();
    
    // Schedule another refresh after a delay to catch any DB latency
    refreshTimerRef.current = window.setTimeout(() => {
      log('Performing follow-up refresh after forced refresh', 'info');
      fetchClaims();
    }, 2000);
  }, [fetchClaims, log]);
  
  // Add an optimistic claim to the UI (triggered by WebSocket)
  const addOptimisticClaim = useCallback((claimData: ClaimData) => {
    if (!claimData || !claimData.id) {
      log('Cannot add optimistic claim: Missing ID', 'warn');
      return;
    }
    
    log(`Adding optimistic claim ${claimData.id} to UI`, 'info');
    
    // Normalize the claim format to match what the UI expects
    const normalizedClaim = {
      id: claimData.id,
      session_id: claimData.sessionId,
      player_id: claimData.playerId,
      player_name: claimData.playerName || 'Player',
      playerName: claimData.playerName || 'Player', // Add for UI consistency
      playerId: claimData.playerId,
      playerCode: claimData.playerCode,
      ticket_serial: claimData.ticket?.serial || '',
      ticketSerial: claimData.ticket?.serial || '',
      ticket_details: claimData.ticket || {},
      ticket: claimData.ticket || {},
      pattern_claimed: claimData.winPattern || 'unknown',
      winPattern: claimData.winPattern || 'unknown',
      patternClaimed: claimData.winPattern || 'unknown',
      called_numbers_snapshot: claimData.calledNumbers || [],
      calledNumbers: claimData.calledNumbers || [],
      status: claimData.status || 'pending' as ClaimStatus,
      claimed_at: claimData.timestamp || new Date().toISOString(),
      timestamp: claimData.timestamp || new Date().toISOString(),
      gameNumber: claimData.gameNumber || 1,
      isOptimistic: true
    };
    
    // Store in our ref so it persists across renders
    optimisticClaimsRef.current.set(claimData.id, normalizedClaim);
    
    // Update state to trigger UI refresh
    setClaims(prev => {
      // Remove any existing claim with same ID
      const filtered = prev.filter(claim => claim.id !== claimData.id);
      // Add new claim at the beginning
      return [normalizedClaim, ...filtered];
    });
    
    setClaimsCount(prev => prev + 1);
    
    // Schedule a refresh to sync with database
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      log('Syncing optimistic claims with database', 'info');
      fetchClaims();
    }, 3000);
  }, [log, fetchClaims]);
  
  // Remove an optimistic claim (usually after processing)
  const removeOptimisticClaim = useCallback((claimId: string) => {
    if (!claimId) return;
    
    log(`Removing optimistic claim ${claimId}`, 'info');
    
    // Remove from our ref
    const hadClaim = optimisticClaimsRef.current.delete(claimId);
    
    // Update state if we actually removed something
    if (hadClaim) {
      setClaims(prev => prev.filter(claim => claim.id !== claimId));
      setClaimsCount(prev => Math.max(0, prev - 1));
    }
  }, [log]);
  
  // Process a claim (approve or reject)
  const processClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!claim || !claim.id || !sessionId) {
      log('Cannot process claim: Missing ID or session', 'warn');
      return false;
    }
    
    try {
      log(`Processing claim ${claim.id}, isValid=${isValid}`, 'info');
      
      // Update the claim in the database
      const { error } = await supabase
        .from('claims')
        .update({
          status: isValid ? 'valid' : 'rejected',
          verified_at: new Date().toISOString()
        })
        .eq('id', claim.id);
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Remove the claim from our optimistic list
      removeOptimisticClaim(String(claim.id));
      
      // Refresh to get updated data
      fetchClaims();
      
      toast({
        title: isValid ? "Claim Validated" : "Claim Rejected",
        description: `${claim.player_name || 'Player'}'s claim has been ${isValid ? 'validated' : 'rejected'}.`,
        duration: 3000
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Error processing claim: ${errorMessage}`, 'error');
      toast({
        title: "Error Processing Claim",
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    }
  }, [sessionId, removeOptimisticClaim, fetchClaims, toast, log]);
  
  // Initial fetch of claims
  useEffect(() => {
    if (sessionId) {
      log(`Initial fetch for session ${sessionId}`, 'info');
      fetchClaims();
      
      // Clean up
      return () => {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
      };
    }
  }, [sessionId, fetchClaims, log]);
  
  // Clean up optimistic claims when session changes
  useEffect(() => {
    optimisticClaimsRef.current.clear();
  }, [sessionId]);
  
  return {
    claims,
    claimsCount,
    isLoading,
    error,
    fetchClaims,
    forceRefresh,
    processClaim,
    addOptimisticClaim,
    removeOptimisticClaim
  };
}
