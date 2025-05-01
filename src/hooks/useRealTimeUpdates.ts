
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { 
  logWithTimestamp, 
  preventConnectionLoop,
  createDelayedConnectionAttempt,
  suspendConnectionAttempts,
  getStableConnectionState,
  getEffectiveConnectionState
} from '@/utils/logUtils';

export function useRealTimeUpdates(sessionId: string | undefined, playerCode: string | undefined) {
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [prizeInfo, setPrizeInfo] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<string>('pending');
  const lastUpdateTimestamp = useRef<number>(0);
  const { toast } = useToast();
  const instanceId = useRef(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const channelRef = useRef<any>(null);
  const inProgressConnection = useRef<boolean>(false);
  const connectionLoopState = useRef<any>(null);
  const isCleaningUp = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);
  const stableConnectionState = useRef<any>(null);
  
  // Connection management refs
  const connectionManager = useRef<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>({
    pendingTimeout: null,
    isSuspended: false
  });

  // Set up real-time listener for game updates
  useEffect(() => {
    if (!sessionId) return;
    
    // Set mounted flag
    isMounted.current = true;
    isCleaningUp.current = false;
    
    // Check if we're in a connection loop, and if so, prevent further attempts
    if (preventConnectionLoop(connectionLoopState)) {
      logWithTimestamp(`Preventing realtime connection loop for session ${sessionId}`);
      
      // Suspend connection attempts for 10 seconds
      suspendConnectionAttempts(connectionManager, 10000);
      
      // Wait 10 seconds before trying again
      setTimeout(() => {
        if (isMounted.current) {
          connectionLoopState.current = null; // Reset loop detector
          reconnectAttemptsRef.current = 0; // Reset attempt counter
          inProgressConnection.current = false;
          const stableState = getStableConnectionState('disconnected', stableConnectionState);
          setConnectionStatus(stableState); // Force a reconnect by changing state
        }
      }, 10000);
      return;
    }
    
    // Don't attempt to connect if already in progress
    if (inProgressConnection.current) {
      return;
    }
    
    logWithTimestamp(`Setting up real-time updates for session ${sessionId}, instance ${instanceId.current}`);
    const stableState = getStableConnectionState('connecting', stableConnectionState);
    setConnectionStatus(stableState);
    inProgressConnection.current = true;
    
    // Function to set up channel subscription
    const setupChannel = () => {
      // Remove any existing channel
      if (channelRef.current) {
        try {
          logWithTimestamp(`Removing existing channel before setting up new one`);
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          // Silent cleanup error handling
        }
        channelRef.current = null;
      }
      
      const channel = supabase
        .channel(`game-updates-${sessionId}`)
        .on('broadcast', 
          { event: 'game-update' }, 
          (payload) => {
            logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
            
            if (payload.payload) {
              const { lastCalledNumber, calledNumbers, currentWinPattern, currentPrize, currentPrizeDescription, gameStatus, timestamp } = payload.payload;
              
              // Check if this update is newer than our last processed update
              if (timestamp && timestamp <= lastUpdateTimestamp.current) {
                logWithTimestamp(`Ignoring outdated update with timestamp: ${timestamp}`);
                return;
              }
              
              if (timestamp) {
                lastUpdateTimestamp.current = timestamp;
              }
              
              if (calledNumbers && Array.isArray(calledNumbers)) {
                logWithTimestamp(`Updating called numbers: ${calledNumbers.length} total`);
                setCalledNumbers(calledNumbers);
              }
              
              if (lastCalledNumber !== null && lastCalledNumber !== undefined) {
                logWithTimestamp(`New number called: ${lastCalledNumber}`);
                setLastCalledNumber(lastCalledNumber);
                
                // Show toast for new number
                if (isMounted.current) {
                  toast({
                    title: "New Number Called",
                    description: `Number ${lastCalledNumber} has been called`,
                    duration: 3000
                  });
                }
              }
              
              if (currentWinPattern) {
                logWithTimestamp(`New win pattern: ${currentWinPattern}`);
                setCurrentWinPattern(currentWinPattern);
              }
              
              if (currentPrize || currentPrizeDescription) {
                logWithTimestamp(`New prize info: ${JSON.stringify({ currentPrize, currentPrizeDescription })}`);
                setPrizeInfo({
                  currentPrize,
                  currentPrizeDescription
                });
              }
              
              // Add handling for gameStatus updates
              if (gameStatus) {
                logWithTimestamp(`Game status updated: ${gameStatus}`);
                setGameStatus(gameStatus);
              }
            }
          }
        )
        .on('broadcast', { event: 'caller-online' }, () => {
          logWithTimestamp('Caller is online');
          if (isMounted.current) {
            const stableState = getStableConnectionState('connected', stableConnectionState);
            setConnectionStatus(stableState);
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
            
            toast({
              title: "Caller Connected",
              description: "The caller is now online",
              duration: 3000
            });
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Game updates subscription status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            inProgressConnection.current = false;
            if (isMounted.current) {
              const stableState = getStableConnectionState('connected', stableConnectionState);
              setConnectionStatus(stableState);
              setIsConnected(true);
              reconnectAttemptsRef.current = 0;
              connectionLoopState.current = null; // Reset loop detector on success
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            inProgressConnection.current = false;
            if (isMounted.current) {
              const stableState = getStableConnectionState('error', stableConnectionState);
              setConnectionStatus(stableState);
              setIsConnected(false);
            }
            if (!connectionManager.current.isSuspended) {
              handleReconnect();
            }
          } else if (status === 'CLOSED') {
            inProgressConnection.current = false;
            if (isMounted.current) {
              const stableState = getStableConnectionState('disconnected', stableConnectionState);
              setConnectionStatus(stableState);
              setIsConnected(false);
            }
            
            // Only attempt to reconnect if not deliberately closing
            if (!isCleaningUp.current && !connectionManager.current.isSuspended) {
              handleReconnect();
            }
          }
        });
      
      channelRef.current = channel;
      return channel;
    };
    
    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts || 
          inProgressConnection.current || 
          isCleaningUp.current || 
          connectionManager.current.isSuspended) {
        logWithTimestamp(`Max reconnection attempts (${maxReconnectAttempts}) reached or connection in progress or suspended. Giving up.`);
        if (isMounted.current) {
          const stableState = getStableConnectionState('error', stableConnectionState);
          setConnectionStatus(stableState);
          setIsConnected(false);
        }
        return;
      }
      
      // Check if we might be in a reconnection loop
      if (connectionLoopState.current?.inLoop) {
        logWithTimestamp(`Detected potential reconnection loop, pausing reconnects`);
        return;
      }
      
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff with 30s max
      logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
      
      // Use the delayed connection manager
      createDelayedConnectionAttempt(() => {
        if (!inProgressConnection.current && !isCleaningUp.current && isMounted.current) {
          logWithTimestamp("Attempting to reconnect...");
          const stableState = getStableConnectionState('connecting', stableConnectionState);
          setConnectionStatus(stableState);
          setIsConnected(false);
          inProgressConnection.current = true;
          setupChannel();
        }
      }, delay, isMounted, connectionManager);
    };
    
    // Initial setup
    setupChannel();
    
    // Check initial session status from sessions_progress
    const checkInitialStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('game_status, called_numbers, current_win_pattern')
          .eq('session_id', sessionId)
          .single();
          
        if (error) {
          logWithTimestamp(`Error fetching initial game status: ${error.message}`);
          return;
        }
        
        if (data && isMounted.current) {
          logWithTimestamp(`Initial game data from database: ${JSON.stringify(data)}`);
          
          if (data.game_status) {
            logWithTimestamp(`Initial game status from database: ${data.game_status}`);
            setGameStatus(data.game_status);
          }
          
          if (data.called_numbers && Array.isArray(data.called_numbers)) {
            logWithTimestamp(`Initial called numbers from database: ${data.called_numbers.length} numbers`);
            setCalledNumbers(data.called_numbers);
            
            if (data.called_numbers.length > 0) {
              setLastCalledNumber(data.called_numbers[data.called_numbers.length - 1]);
            }
          }
          
          if (data.current_win_pattern) {
            logWithTimestamp(`Initial win pattern from database: ${data.current_win_pattern}`);
            setCurrentWinPattern(data.current_win_pattern);
          }
        }
      } catch (err) {
        logWithTimestamp(`Exception checking initial status: ${err}`);
      }
    };
    
    checkInitialStatus();
    
    return () => {
      // Update refs for cleanup
      isCleaningUp.current = true;
      isMounted.current = false;
      
      logWithTimestamp(`Cleaning up real-time subscription`);
      
      // Clear any pending timeouts
      if (connectionManager.current.pendingTimeout) {
        clearTimeout(connectionManager.current.pendingTimeout);
        connectionManager.current.pendingTimeout = null;
      }
      
      // Clean up channel
      if (channelRef.current) {
        try {
          logWithTimestamp(`Removing channel on cleanup`);
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          // Silently handle cleanup errors
        }
        channelRef.current = null;
      }
      
      inProgressConnection.current = false;
    };
  }, [sessionId, toast]);

  // Set up real-time listener for claim results (specific to this player)
  useEffect(() => {
    if (!sessionId || !playerCode) return;
    
    const claimsChannel = supabase
      .channel(`player-claims-${instanceId.current}`)
      .on('broadcast', 
        { event: 'claim-result' }, 
        (payload) => {
          if (payload.payload && payload.payload.playerId === playerCode) {
            const result = payload.payload.result;
            
            if (result === 'valid' && isMounted.current) {
              toast({
                title: "Claim Verified!",
                description: "Your bingo claim has been verified.",
                duration: 5000
              });
            } else if (result === 'rejected' && isMounted.current) {
              toast({
                title: "Claim Rejected",
                description: "Your claim was not valid. Please check your numbers.",
                variant: "destructive",
                duration: 5000
              });
            }
          }
        })
      .subscribe((status) => {
        logWithTimestamp(`Claims channel status: ${status}`);
      });
      
    return () => {
      try {
        if (claimsChannel) {
          supabase.removeChannel(claimsChannel);
        }
      } catch (err) {
        // Silently handle cleanup errors
      }
    };
  }, [sessionId, playerCode, toast]);

  // Update the actual connection state for consistency
  useEffect(() => {
    // Use the effective connection state to ensure UI consistency
    if (isMounted.current) {
      const effectiveState = getEffectiveConnectionState(connectionStatus, isConnected);
      
      if (effectiveState !== connectionStatus) {
        setConnectionStatus(effectiveState);
      }
    }
  }, [connectionStatus, isConnected]);
  
  return {
    lastCalledNumber,
    calledNumbers,
    currentWinPattern,
    prizeInfo,
    connectionStatus,
    isConnected,
    gameStatus
  };
}
