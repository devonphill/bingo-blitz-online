
import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { EVENT_TYPES } from '@/constants/websocketConstants';

interface PlayerClaimCheckingNotificationProps {
  sessionId: string;
  playerCode: string;
}

export default function PlayerClaimCheckingNotification({
  sessionId,
  playerCode
}: PlayerClaimCheckingNotificationProps) {
  const { toast } = useToast();
  const [claimStatus, setClaimStatus] = useState<'none' | 'checking' | 'valid' | 'invalid'>('none');
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [instanceId] = useState(`PCN-${Math.random().toString(36).substring(2, 5)}`);

  // Use websocket hook to listen for claim status updates
  const { listenForEvent, isConnected } = useWebSocket(sessionId);

  // Custom logging function
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    logWithTimestamp(`[${instanceId}] ${message}`, level);
  }, [instanceId]);

  // Check for any active claims for this player on mount
  useEffect(() => {
    if (!sessionId || !playerCode) return;

    const checkActiveClaims = async () => {
      try {
        log(`Checking for active claims for player code ${playerCode} in session ${sessionId}`);
        
        // Query for claims in validation for this player - using universal_game_logs instead of bingo_claims
        const { data, error } = await supabase
          .from('universal_game_logs')
          .select('*')
          .eq('session_uuid', sessionId)
          .eq('player_id', playerCode)
          .is('validated_at', null)
          .not('claimed_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error) {
          log(`Error fetching active claims: ${error.message}`, 'error');
          return;
        }
        
        // Set active claim if found
        if (data && data.length > 0) {
          log(`Found active claim for player: ${data[0].id}`);
          setClaimStatus('checking');
          setClaimDetails(data[0]);
          
          // Show toast notification
          toast({
            title: "Claim Being Verified",
            description: "The host is currently verifying your bingo claim.",
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Unexpected error checking claims: ${errorMessage}`, 'error');
      }
    };
    
    checkActiveClaims();
  }, [sessionId, playerCode, toast, log]);
  
  // Set up listeners for claim status updates
  useEffect(() => {
    if (!sessionId || !playerCode || !isConnected) return;
    
    log(`Setting up claim update listeners for session ${sessionId} and player ${playerCode}`);
    
    // Listen for claim being validated
    const validatingCleanup = listenForEvent(
      EVENT_TYPES.CLAIM_VALIDATING_TKT,
      (data: any) => {
        // Check if this claim belongs to current player
        if (data?.playerCode === playerCode) {
          log(`Received claim validating notification for ticket: ${data.ticketId || 'unknown'}`);
          setClaimStatus('checking');
          setClaimDetails({
            ticket_id: data.ticketId,
            pattern: data.pattern,
            claim_id: data.claimId
          });
          
          // Show toast
          toast({
            title: "Claim Being Verified",
            description: "The host is currently verifying your bingo claim.",
          });
        }
      }
    );
    
    // Listen for claim resolution
    const resolutionCleanup = listenForEvent(
      EVENT_TYPES.CLAIM_RESOLUTION, 
      (data: any) => {
        // Check if this claim belongs to current player
        if (data?.playerCode === playerCode || data?.player_code === playerCode) {
          log(`Received claim resolution: ${data.isValid ? 'VALID' : 'INVALID'}`);
          
          setClaimStatus(data.isValid ? 'valid' : 'invalid');
          
          // Show toast
          toast({
            title: data.isValid ? "Claim Approved!" : "Claim Rejected",
            description: data.isValid 
              ? "Your bingo claim has been verified and approved." 
              : "Your bingo claim was not approved. Please continue playing.",
            variant: data.isValid ? "default" : "destructive",
          });
          
          // Reset after 5 seconds
          setTimeout(() => {
            setClaimStatus('none');
            setClaimDetails(null);
          }, 5000);
        }
      }
    );
    
    // Cleanup function
    return () => {
      log('Cleaning up claim update listeners');
      validatingCleanup();
      resolutionCleanup();
    };
  }, [sessionId, playerCode, isConnected, listenForEvent, EVENT_TYPES, toast, log]);

  // Don't render anything if no active claim
  if (claimStatus === 'none') {
    return null;
  }

  // Render notification based on status
  return (
    <div className="fixed bottom-4 left-0 right-0 mx-auto max-w-md z-50 px-4">
      <Alert
        className={`shadow-lg border-l-4 ${
          claimStatus === 'checking' ? 'border-l-blue-500 bg-blue-50' : 
          claimStatus === 'valid' ? 'border-l-green-500 bg-green-50' : 
          'border-l-red-500 bg-red-50'
        }`}
      >
        <AlertTitle className={`${
          claimStatus === 'checking' ? 'text-blue-800' : 
          claimStatus === 'valid' ? 'text-green-800' : 
          'text-red-800'
        } font-bold`}>
          {claimStatus === 'checking' ? 'Verifying Claim' :
           claimStatus === 'valid' ? 'Claim Approved!' :
           'Claim Rejected'}
        </AlertTitle>
        <AlertDescription className={`${
          claimStatus === 'checking' ? 'text-blue-700' : 
          claimStatus === 'valid' ? 'text-green-700' : 
          'text-red-700'
        }`}>
          {claimStatus === 'checking' 
            ? 'The host is currently verifying your bingo claim. Please wait...'
            : claimStatus === 'valid' 
              ? 'Congratulations! Your bingo claim has been verified and approved.'
              : 'Your bingo claim was not approved. Please continue playing.'
          }
        </AlertDescription>
      </Alert>
    </div>
  );
}
