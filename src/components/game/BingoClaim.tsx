
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
  // Generate a consistent instance ID for this component
  const instanceId = useRef(`BingoClaim-${Math.random().toString(36).substring(2, 7)}`);
  
  // State for claim checking UI
  const [isClaimSheetVisible, setIsClaimSheetVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  const [activeClaims, setActiveClaims] = useState(0);
  
  // Channels for real-time communication
  const claimCheckingChannelRef = useRef<any>(null);
  const claimResultChannelRef = useRef<any>(null);
  
  // Reference to track if component is mounted and session ID
  const isMountedRef = useRef(true);
  const sessionIdRef = useRef<string | null>(sessionId);
  
  // Track last received claim ID to avoid duplicates
  const lastClaimIdRef = useRef<string | null>(null);
  
  // Update session ID ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
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
    if (!sessionIdRef.current) {
      log(`No session ID provided, not setting up channels`, 'warn');
      return;
    }
    
    const currentSessionId = sessionIdRef.current;
    isMountedRef.current = true;
    
    // Clean up any existing channels first
    const cleanupExistingChannels = () => {
      if (claimCheckingChannelRef.current) {
        try {
          log('Removing existing claim checking channel', 'info');
          supabase.removeChannel(claimCheckingChannelRef.current);
          claimCheckingChannelRef.current = null;
        } catch (err) {
          log(`Error removing claim checking channel: ${err}`, 'error');
        }
      }
      
      if (claimResultChannelRef.current) {
        try {
          log('Removing existing claim result channel', 'info');
          supabase.removeChannel(claimResultChannelRef.current);
          claimResultChannelRef.current = null;
        } catch (err) {
          log(`Error removing claim result channel: ${err}`, 'error');
        }
      }
    };
    
    cleanupExistingChannels();
    
    // Function to set up communication channels only if they don't exist yet
    const setupChannels = () => {
      log(`Setting up channels for session ${currentSessionId}`, 'info');
      
      // Set up claim checking channel
      try {
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
            if (payload.payload?.sessionId === currentSessionId) {
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
      } catch (err) {
        log(`Error setting up claim checking channel: ${err}`, 'error');
      }
      
      // Set up claim result channel
      try {
        // Set up claim result channel with consistent channel name
        const resultChannel = supabase
          .channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { 
                self: true, // Ensure we receive our own broadcasts
                ack: true  // Request acknowledgment
              }
            }
          })
          .on('broadcast', { event: 'claim-result' }, payload => {
            if (!isMountedRef.current) return;
            
            log(`Received claim result`, 'info');
            
            const result = payload.payload;
            
            // Check if this result is for our session
            if (result.sessionId === currentSessionId) {
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
      } catch (err) {
        log(`Error setting up claim result channel: ${err}`, 'error');
      }
    };
    
    // Add a small delay before setting up channels to prevent race conditions
    const timer = setTimeout(() => {
      if (isMountedRef.current && currentSessionId) {
        setupChannels();
      }
    }, 300);
    
    // Clean up channels on unmount
    return () => {
      clearTimeout(timer);
      cleanupExistingChannels();
    };
  }, []);
  
  // Handle changes to session ID
  useEffect(() => {
    if (sessionIdRef.current !== sessionId && sessionId) {
      log(`Session ID changed from ${sessionIdRef.current} to ${sessionId}, resetting channels`, 'info');
      sessionIdRef.current = sessionId;
      
      // Clean up existing channels
      if (claimCheckingChannelRef.current) {
        try {
          supabase.removeChannel(claimCheckingChannelRef.current);
          claimCheckingChannelRef.current = null;
        } catch (err) {
          log(`Error removing claim checking channel: ${err}`, 'error');
        }
      }
      
      if (claimResultChannelRef.current) {
        try {
          supabase.removeChannel(claimResultChannelRef.current);
          claimResultChannelRef.current = null;
        } catch (err) {
          log(`Error removing claim result channel: ${err}`, 'error');
        }
      }
      
      // Set up new channels after a delay
      setTimeout(() => {
        if (isMountedRef.current && sessionId) {
          // Set up claim checking channel
          try {
            const checkingChannel = supabase
              .channel(CLAIM_CHECKING_CHANNEL, {
                config: { broadcast: { self: true, ack: true } }
              })
              .on('broadcast', { event: 'claim-checking' }, payload => {
                if (!isMountedRef.current) return;
                if (payload.payload?.sessionId === sessionId) {
                  log(`Claim checking broadcast matches updated session`, 'info');
                  const claimId = payload.payload?.claimId;
                  if (claimId && claimId === lastClaimIdRef.current) return;
                  lastClaimIdRef.current = claimId;
                  setClaimCheckData(payload.payload);
                  setIsClaimSheetVisible(true);
                  setClaimResult(null);
                  setActiveClaims(prev => prev + 1);
                }
              })
              .subscribe();
            claimCheckingChannelRef.current = checkingChannel;
          } catch (err) {
            log(`Error setting up new claim checking channel: ${err}`, 'error');
          }
          
          // Set up claim result channel
          try {
            const resultChannel = supabase
              .channel(GAME_UPDATES_CHANNEL, {
                config: { broadcast: { self: true, ack: true } }
              })
              .on('broadcast', { event: 'claim-result' }, payload => {
                if (!isMountedRef.current) return;
                const result = payload.payload;
                if (result.sessionId === sessionId && 
                   (result.isGlobalBroadcast || result.playerId === playerId)) {
                  log(`Setting claim result to: ${result.result}`, 'info');
                  setClaimResult(result.result);
                  setClaimCheckData(prev => ({
                    ...prev,
                    playerName: result.playerName,
                    ticket: result.ticket || prev?.ticket
                  }));
                  setIsClaimSheetVisible(true);
                  setActiveClaims(prev => Math.max(0, prev - 1));
                }
              })
              .subscribe();
            claimResultChannelRef.current = resultChannel;
          } catch (err) {
            log(`Error setting up new claim result channel: ${err}`, 'error');
          }
        }
      }, 300);
    }
  }, [sessionId, playerId]);

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

  // Listen for force open events from other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleForceOpen = (event: any) => {
        if (isMountedRef.current && event.detail?.data) {
          log(`Force open claim drawer with data: ${JSON.stringify(event.detail.data)}`, 'info');
          setClaimCheckData(event.detail.data);
          setIsClaimSheetVisible(true);
          setClaimResult(null); // Reset result
          setActiveClaims(prev => prev + 1);
        }
      };
      
      window.addEventListener('forceOpenClaimDrawer', handleForceOpen);
      
      return () => {
        window.removeEventListener('forceOpenClaimDrawer', handleForceOpen);
      };
    }
  }, []);

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
