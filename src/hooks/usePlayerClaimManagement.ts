
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { processTicketLayout } from '@/utils/ticketUtils';
import { toast as sonnerToast } from 'sonner';

// Define consistent channel names used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const CLAIM_CHECKING_CHANNEL = 'claim_checking_broadcaster';

/**
 * Hook for managing bingo claims from the player perspective
 */
export function usePlayerClaimManagement(
  playerCode: string | null,
  playerId: string | null,
  sessionId: string | null,
  playerName: string | null,
  gameType: string = 'mainstage',
  currentWinPattern: string | null = null,
  gameNumber: number = 1
) {
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [hasActiveClaims, setHasActiveClaims] = useState(false);
  const { toast } = useToast();
  const claimChannelRef = useRef<any>(null);
  const claimCheckingChannelRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const instanceIdRef = useRef(`claim-${Math.random().toString(36).substring(2, 9)}`);
  const sessionIdRef = useRef<string | null>(sessionId);
  
  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
  // Custom logger with instance ID
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`PlayerClaimManagement[${instanceIdRef.current}]: ${message}`, level);
  }, []);
  
  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    log(`Resetting claim status from ${claimStatus} to none`, 'info');
    setClaimStatus('none');
  }, [claimStatus, log]);

  // Set up or clean up channels based on session availability
  const setupCommunicationChannels = useCallback(() => {
    if (!sessionIdRef.current) {
      log('No session ID available for communication channels', 'warn');
      return;
    }
    
    const currentSessionId = sessionIdRef.current;
    
    // Cleanup existing channels first to avoid duplicates
    if (claimChannelRef.current) {
      try {
        log('Removing existing claim result channel before re-creating', 'info');
        supabase.removeChannel(claimChannelRef.current);
        claimChannelRef.current = null;
      } catch (err) {
        console.error('Error removing claim channel:', err);
      }
    }
    
    if (claimCheckingChannelRef.current) {
      try {
        log('Removing existing claim checking channel before re-creating', 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      } catch (err) {
        console.error('Error removing claim checking channel:', err);
      }
    }
    
    // Setup claim result channel
    log(`Setting up claim result channel for session ${currentSessionId}`, 'info');
      
    // Use the consistent channel name with proper configuration
    try {
      const resultChannel = supabase
        .channel(GAME_UPDATES_CHANNEL, {
          config: {
            broadcast: { 
              self: true, // Receive own broadcasts
              ack: true   // Request acknowledgment
            }
          }
        })
        .on('broadcast', { event: 'claim-result' }, payload => {
          if (!isMountedRef.current) return;
          
          log(`Received claim result: ${JSON.stringify(payload.payload)}`, 'info');
          
          const result = payload.payload;
          
          // Check if this result is for us or our session
          if (result.sessionId === currentSessionId) {
            if ((result.playerId === playerId || result.playerId === playerCode) || result.isGlobalBroadcast) {
              log(`Processing claim result: ${result.result}`, 'info');
              
              // Update claim status based on result
              if (result.result === 'valid') {
                setClaimStatus('valid');
                setHasActiveClaims(false);
                
                // Show toast notification for valid claim
                sonnerToast.success('Bingo Verified!', {
                  description: `${result.playerName}'s claim was verified`,
                  duration: 5000
                });
              } else if (result.result === 'invalid' || result.result === 'rejected') {
                setClaimStatus('invalid');
                setHasActiveClaims(false);
                
                // Show toast notification for invalid claim
                sonnerToast.error('Claim Rejected', {
                  description: `${result.playerName}'s claim was rejected`,
                  duration: 5000
                });
              }
            }
          }
        })
        .subscribe((status) => {
          log(`Claim result channel subscription status: ${status}`, 'info');
        });
      
      // Store the channel for cleanup  
      claimChannelRef.current = resultChannel;
    } catch (err) {
      log(`Error creating claim result channel: ${err}`, 'error');
    }
    
    // Setup claim checking channel
    log(`Setting up claim checking channel for session ${currentSessionId}`, 'info');
    
    try {
      // Set up channel for claim checking broadcasts with proper config
      const checkChannel = supabase
        .channel(CLAIM_CHECKING_CHANNEL, {
          config: {
            broadcast: { 
              self: true, // Receive own broadcasts
              ack: true   // Request acknowledgment
            }
          }
        })
        .on('broadcast', { event: 'claim-checking' }, payload => {
          if (!isMountedRef.current) return;
          
          log(`Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
          
          // We don't need additional processing here as the BingoClaim component
          // handles displaying the claim checking dialog
          if (payload.payload?.sessionId === currentSessionId) {
            setHasActiveClaims(true);
          }
        })
        .subscribe((status) => {
          log(`Claim checking channel status: ${status}`, 'info');
        });
      
      // Store channel reference for cleanup
      claimCheckingChannelRef.current = checkChannel;
    } catch (err) {
      log(`Error creating claim checking channel: ${err}`, 'error');
    }
  }, [playerId, playerCode, log]);

  // Set up/clean up effect with proper dependency array  
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;
    
    log(`Initializing claim management for session: ${sessionId || 'none'}`, 'info');
    sessionIdRef.current = sessionId;
    
    // Setup channels with a delay to avoid race conditions
    const setupTimer = setTimeout(() => {
      if (isMountedRef.current && sessionId) {
        setupCommunicationChannels();
      }
    }, 300);
    
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;
      
      // Clear timer
      clearTimeout(setupTimer);
      
      // Clean up channels
      if (claimChannelRef.current) {
        log(`Removing claim result channel`, 'info');
        try {
          supabase.removeChannel(claimChannelRef.current);
        } catch (err) {
          console.error('Error removing claim channel during cleanup:', err);
        }
        claimChannelRef.current = null;
      }
      
      if (claimCheckingChannelRef.current) {
        log(`Removing claim checking channel`, 'info');
        try {
          supabase.removeChannel(claimCheckingChannelRef.current);
        } catch (err) {
          console.error('Error removing claim checking channel during cleanup:', err);
        }
        claimCheckingChannelRef.current = null;
      }
    };
  }, [sessionId, setupCommunicationChannels, log]);

  // Handle session ID changes
  useEffect(() => {
    if (sessionIdRef.current !== sessionId && sessionId && isMountedRef.current) {
      log(`Session ID changed from ${sessionIdRef.current} to ${sessionId}, reconnecting channels`, 'info');
      sessionIdRef.current = sessionId;
      
      // Re-setup channels with delay
      setTimeout(() => {
        if (isMountedRef.current && sessionId) {
          setupCommunicationChannels();
        }
      }, 200);
    }
  }, [sessionId, setupCommunicationChannels, log]);

  // Submit a claim
  const submitClaim = useCallback(async (ticket: any) => {
    const currentSessionId = sessionIdRef.current;
    
    if (!playerCode || !currentSessionId) {
      toast({
        title: "Cannot Claim",
        description: "Missing player information or session ID",
        variant: "destructive"
      });
      return false;
    }
    
    log(`Submitting claim for ${playerCode} in ${currentSessionId}`, 'info');
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // Create payload to send
      const payload = {
        type: validateChannelType('broadcast'),
        event: 'claim-submitted',
        payload: {
          playerCode,
          playerId,
          sessionId: currentSessionId,
          playerName: playerName || playerCode,
          gameType,
          winPattern: currentWinPattern,
          gameNumber,
          timestamp: new Date().toISOString(),
          ticket: {
            serial: ticket.serial,
            perm: ticket.perm,
            position: ticket.position,
            layoutMask: ticket.layout_mask || ticket.layoutMask,
            numbers: ticket.numbers
          }
        }
      };
      
      log(`Submitting claim with payload: ${JSON.stringify(payload.payload)}`, 'info');
      
      // Retry mechanism for more reliable claim submission
      const sendClaimWithRetry = async (attempts = 0): Promise<boolean> => {
        if (attempts >= 3) {
          log(`Failed to submit claim after ${attempts} attempts`, 'error');
          return false;
        }
        
        try {
          // Send claim via real-time channel using the consistent channel name
          const channel = supabase.channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { 
                self: true, // Receive own broadcasts
                ack: true   // Request acknowledgment
              }
            }
          });
          
          await channel.send(payload);
          log(`Claim broadcast sent successfully`, 'info');
          return true;
        } catch (err) {
          log(`Error submitting claim (attempt ${attempts + 1}): ${err}`, 'error');
          
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempts)));
          return sendClaimWithRetry(attempts + 1);
        }
      };
      
      const success = await sendClaimWithRetry();
      
      if (success) {
        // Show success toast
        toast({
          title: "Bingo Submitted!",
          description: "Your claim has been submitted for verification.",
          duration: 3000,
        });
        
        // Update active claims state
        setHasActiveClaims(true);
        
        return true;
      } else {
        throw new Error("Failed to submit claim after multiple attempts");
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      log(`Error submitting claim: ${error}`, 'error');
      
      toast({
        title: "Claim Error",
        description: "Failed to submit your bingo claim.",
        variant: "destructive"
      });
      setClaimStatus('none');
      return false;
    } finally {
      // Keep the claim status as pending but stop the submitting indicator
      setIsSubmittingClaim(false);
    }
  }, [playerCode, playerId, playerName, gameType, currentWinPattern, gameNumber, toast, log]);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  };
}
