
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import ClaimDrawer from './ClaimDrawer';
import { toast } from 'sonner';

// Define consistent channel names used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const CLAIM_CHECKING_CHANNEL = 'claim_checking_broadcaster';

// Create a global event system for claim events
const claimEvents = {
  listeners: new Set<(data: any) => void>(),
  addListener: (listener: (data: any) => void) => {
    claimEvents.listeners.add(listener);
    return () => claimEvents.listeners.delete(listener);
  },
  dispatch: (data: any) => {
    logWithTimestamp(`ClaimEvents: Dispatching ${data.type} event`, 'info');
    console.log('ClaimEvents dispatch:', data);
    claimEvents.listeners.forEach(listener => listener(data));
  }
};

// Export the event system so it can be used from anywhere
export { claimEvents };

interface BingoClaimProps {
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  resetClaimStatus?: () => void;
  playerName?: string;
  currentTicket?: any;
  calledNumbers?: number[];
  sessionId?: string | null;
  playerId?: string | null;
}

export default function BingoClaim({
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  resetClaimStatus,
  playerName = 'Player',
  currentTicket,
  calledNumbers = [],
  sessionId,
  playerId
}: BingoClaimProps) {
  // Debugging info
  const instanceId = useRef(`BingoClaim-${Math.random().toString(36).substring(2, 7)}`);
  
  // State for claim checking UI
  const [isClaimSheetVisible, setIsClaimSheetVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  const [activeClaims, setActiveClaims] = useState(0);
  
  // Channels for real-time communication
  const claimCheckingChannelRef = useRef<any>(null);
  const claimResultChannelRef = useRef<any>(null);
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Track last received claim ID to avoid duplicates
  const lastClaimIdRef = useRef<string | null>(null);
  
  // Custom logger with instance ID
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`BingoClaim (${instanceId.current}): ${message}`, level);
  };
  
  // Log component lifecycle
  useEffect(() => {
    log(`Component mounted - playerName=${playerName}, sessionId=${sessionId || 'none'}, playerId=${playerId || 'none'}`, 'info');
    
    return () => {
      isMountedRef.current = false;
      log(`Component unmounting`, 'info');
    };
  }, [playerName, sessionId, playerId]);
  
  // Set up channels for claim checking and results
  useEffect(() => {
    if (!sessionId) {
      log(`No session ID provided, not setting up channels`, 'warn');
      return;
    }
    
    // Function to set up communication channels only if they don't exist yet
    const setupChannels = () => {
      log(`Setting up channels for session ${sessionId}`, 'info');
      
      // Only create the claim checking channel if it doesn't exist
      if (!claimCheckingChannelRef.current) {
        // Set up claim checking channel with improved configuration
        const checkingChannel = supabase
          .channel(CLAIM_CHECKING_CHANNEL, {
            config: {
              broadcast: { 
                self: true, // Ensure we receive our own broadcasts 
                ack: true  // Request acknowledgment for debugging
              }
            }
          })
          .on('broadcast', { event: 'claim-checking' }, payload => {
            if (!isMountedRef.current) return;
            
            log(`Received claim checking broadcast`, 'info');
            
            // Check if this broadcast is for our session
            if (payload.payload?.sessionId === sessionId) {
              log(`Claim checking broadcast matches current session`, 'info');
              
              // Prevent duplicate claims (check claim ID)
              const claimId = payload.payload?.claimId;
              if (claimId && claimId === lastClaimIdRef.current) {
                log(`Ignoring duplicate claim with ID ${claimId}`, 'info');
                return;
              }
              
              // Update last claim ID
              lastClaimIdRef.current = claimId;
              
              // Set claim data and force visibility to true
              setClaimCheckData(payload.payload);
              setIsClaimSheetVisible(true);
              setClaimResult(null); // Clear any previous result
              setActiveClaims(prev => prev + 1); // Increment active claims
              
              // Show toast notification for better visibility
              toast.info("Bingo Claim Being Checked", {
                description: `${payload.payload.playerName || 'Player'}'s ticket is being verified`,
                duration: 4000
              });
              
              // Dispatch to global event system
              claimEvents.dispatch({
                type: 'claim-checking',
                data: payload.payload
              });
              
              // Debug logs
              log(`Set claim sheet visible`, 'info');
            }
          })
          .subscribe((status) => {
            log(`Claim checking channel status: ${status}`, 'info');
          });
          
        // Store channel reference
        claimCheckingChannelRef.current = checkingChannel;
      }
      
      // Only create the result channel if it doesn't exist
      if (!claimResultChannelRef.current) {
        // Set up claim result channel with consistent channel name
        const resultChannel = supabase
          .channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { self: true } // Ensure we receive our own broadcasts
            }
          })
          .on('broadcast', { event: 'claim-result' }, payload => {
            if (!isMountedRef.current) return;
            
            log(`Received claim result`, 'info');
            
            const result = payload.payload;
            
            // Check if this result is for our session
            if (result.sessionId === sessionId) {
              log(`Claim result broadcast matches current session`, 'info');
              
              // If global broadcast or specific to this player
              if (result.isGlobalBroadcast || result.playerId === playerId) {
                const isValidClaim = result.result === 'valid';
                
                // Dispatch to global event system
                claimEvents.dispatch({
                  type: 'claim-result',
                  data: result
                });
                
                // Show result in the drawer
                log(`Setting claim result to: ${result.result}`, 'info');
                setClaimResult(result.result);
                setClaimCheckData(prev => ({
                  ...prev,
                  playerName: result.playerName,
                  ticket: result.ticket || prev?.ticket
                }));
                setIsClaimSheetVisible(true);
                
                // Decrement active claims after result is received
                setActiveClaims(prev => Math.max(0, prev - 1));
                
                // Show toast notification as well for better visibility
                toast[isValidClaim ? 'success' : 'error'](
                  isValidClaim ? "Bingo Verified!" : "Invalid Claim", 
                  { 
                    description: `${result.playerName}'s claim was ${isValidClaim ? 'verified' : 'rejected'}`,
                    duration: 5000
                  }
                );
                
                // Reset claim status if this was our claim and we have the function
                if (result.playerId === playerId && resetClaimStatus) {
                  setTimeout(() => {
                    if (isMountedRef.current && resetClaimStatus) {
                      resetClaimStatus();
                    }
                  }, 5000); // Match the auto-close timing
                }
              }
            }
          })
          .subscribe((status) => {
            log(`Claim result channel status: ${status}`, 'info');
          });
        
        // Store channel reference
        claimResultChannelRef.current = resultChannel;
      }
    };
    
    // Add a small delay before setting up channels to prevent race conditions
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setupChannels();
      }
    }, 100);
    
    // Clean up channels on unmount
    return () => {
      clearTimeout(timer);
      
      if (claimCheckingChannelRef.current) {
        log(`Removing claim checking channel during cleanup`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current)
          .then(() => {
            claimCheckingChannelRef.current = null;
            log('Claim checking channel removed successfully', 'debug');
          })
          .catch(err => {
            log(`Error removing claim checking channel: ${err}`, 'error');
          });
      }
      
      if (claimResultChannelRef.current) {
        log(`Removing claim result channel during cleanup`, 'info');
        supabase.removeChannel(claimResultChannelRef.current)
          .then(() => {
            claimResultChannelRef.current = null;
            log('Claim result channel removed successfully', 'debug');
          })
          .catch(err => {
            log(`Error removing claim result channel: ${err}`, 'error');
          });
      }
    };
  }, [sessionId, playerId, resetClaimStatus, playerName]);

  // Handle drawer state changes
  const handleOpenChange = (open: boolean) => {
    log(`Drawer open state changed to: ${open}`, 'info');
    
    if (!open) {
      // Only close if there are no active claims
      if (activeClaims === 0) {
        setIsClaimSheetVisible(false);
        setClaimResult(null);
      } else {
        // If there are active claims, don't allow manual closing
        log(`Preventing drawer close - ${activeClaims} active claims`, 'warn');
      }
    } else {
      setIsClaimSheetVisible(open);
    }
  };
  
  // Effect to auto-close when no active claims
  useEffect(() => {
    if (activeClaims === 0 && isClaimSheetVisible && claimResult !== null) {
      // Auto-close after result is shown and no more active claims
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          log(`Auto-closing drawer - no active claims`, 'info');
          setIsClaimSheetVisible(false);
        }
      }, 5000); // Match the ClaimDrawer auto-close timing
      
      return () => clearTimeout(timer);
    }
  }, [activeClaims, isClaimSheetVisible, claimResult]);

  // Only render the drawer if there are claims to show
  return (
    <>
      <ClaimDrawer
        isOpen={isClaimSheetVisible && (!!claimCheckData || activeClaims > 0)}
        onOpenChange={handleOpenChange}
        playerName={claimCheckData?.playerName || playerName}
        ticketData={claimCheckData?.ticket || currentTicket}
        winPattern={claimCheckData?.winPattern}
        validationResult={claimResult}
        autoClose={activeClaims === 0} // Only auto-close when no active claims
      />
    </>
  );
}
