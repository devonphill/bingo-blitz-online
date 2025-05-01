
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  logWithTimestamp, 
  logConnectionState, 
  isChannelConnected, 
  logConnectionAttempt, 
  logConnectionSuccess, 
  safeLogObject,
  shouldAttemptReconnect,
  logConnectionCleanup,
  preventConnectionLoop,
  createDelayedConnectionAttempt,
  suspendConnectionAttempts,
  getStableConnectionState,
  getEffectiveConnectionState,
  registerSuccessfulConnection,
  unregisterConnectionInstance
} from '@/utils/logUtils';

interface ConnectedPlayer {
  playerCode: string;
  playerName: string | null;
  joinedAt: number;
}

interface BingoClaim {
  playerCode: string;
  playerName: string | null;
  claimedAt: number;
  ticketData?: any;
}

export function useCallerHub(sessionId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [pendingClaims, setPendingClaims] = useState<BingoClaim[]>([]);
  const { toast } = useToast();
  
  // Refs to manage internal state
  const channelRefs = useRef<{ [key: string]: any }>({});
  const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceId = useRef<string>(Date.now().toString());
  const lastConnectionAttempt = useRef<number | null>(null);
  const connectionLoopState = useRef<any>(null);
  const isMounted = useRef<boolean>(true);
  const isCleaningUp = useRef<boolean>(false);
  const stableConnectionState = useRef<any>(null);
  
  // New connection management refs
  const connectionManager = useRef<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>({
    pendingTimeout: null,
    isSuspended: false
  });
  
  // Critical flag to prevent multiple concurrent connection attempts
  const inProgressConnection = useRef<boolean>(false);

  // Set up the caller as the central hub using Supabase Realtime
  useEffect(() => {
    // Skip if no session ID
    if (!sessionId) {
      logWithTimestamp("No sessionId provided to useCallerHub");
      setConnectionState('disconnected');
      return;
    }
    
    logWithTimestamp(`Setting up caller hub for session: ${sessionId} using instance: ${instanceId.current}`);
    
    // On mount
    isMounted.current = true;
    isCleaningUp.current = false;
    
    // Clear things on unmount
    return () => {
      isMounted.current = false;
      isCleaningUp.current = true;
      
      logConnectionCleanup('useCallerHub', 'component unmounting');
      
      // Unregister from the global connection tracker
      unregisterConnectionInstance(sessionId, instanceId.current);
      
      // Clear all timeouts
      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
        connectionTimeout.current = null;
      }
      
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      
      if (connectionManager.current.pendingTimeout) {
        clearTimeout(connectionManager.current.pendingTimeout);
        connectionManager.current.pendingTimeout = null;
      }
      
      // Clean up channels to avoid memory leaks
      Object.values(channelRefs.current).forEach((channel) => {
        if (channel) {
          try {
            logWithTimestamp(`Removing channel on unmount for session ${sessionId}`);
            supabase.removeChannel(channel);
          } catch (err) {
            // Silently handle errors during cleanup
          }
        }
      });
      
      // Reset channels
      channelRefs.current = {};
    };
  }, [sessionId]); // Only re-run on sessionId change
  
  // Effect to handle actual connection setup with loop prevention
  useEffect(() => {
    // Don't attempt to connect if:
    // 1. No sessionId
    // 2. Component unmounted
    // 3. Connection attempt already in progress
    // 4. Cleanup in progress
    if (!sessionId || !isMounted.current || inProgressConnection.current || isCleaningUp.current) {
      return;
    }
    
    // Check if we're in a connection loop using our improved global tracker
    if (preventConnectionLoop(sessionId, instanceId.current, connectionLoopState)) {
      logWithTimestamp(`Preventing connection loop for session ${sessionId}, instance ${instanceId.current}`);
      
      if (isMounted.current) {
        // Suspend connection attempts for 10 seconds
        suspendConnectionAttempts(connectionManager, 10000);
        
        // Reset after suspension period
        setTimeout(() => {
          if (isMounted.current) {
            connectionLoopState.current = null; // Reset loop detector
            reconnectAttempt.current = 0; // Reset attempt counter
            inProgressConnection.current = false;
            setConnectionState('disconnected'); // Force a reconnect by changing state
          }
        }, 10000);
      }
      return;
    }
    
    // Only attempt reconnect if appropriate time has passed
    if (!shouldAttemptReconnect(lastConnectionAttempt.current, connectionState)) {
      return;
    }
    
    // Set up the connection
    const setupConnection = () => {
      if (inProgressConnection.current || isCleaningUp.current) {
        // Prevent multiple simultaneous connection attempts
        return null;
      }
      
      inProgressConnection.current = true;
      lastConnectionAttempt.current = Date.now();
      
      // Log the connection attempt
      logWithTimestamp(`Setting up caller hub for session: ${sessionId} (instance: ${instanceId.current})`);
      setConnectionState('connecting');
      
      // Clear any existing timeout
      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
      }
      
      // Set a timeout to consider connection failed if not connected within 10 seconds
      connectionTimeout.current = setTimeout(() => {
        if (isMounted.current && connectionState === 'connecting') {
          logWithTimestamp(`Connection timeout for session ${sessionId} - setting state to error`);
          setConnectionState('error');
          setConnectionError("Connection timed out");
          inProgressConnection.current = false;
          
          // After a timeout, reset connection loop state to allow new attempts
          connectionLoopState.current = null;
        }
      }, 10000);
      
      try {
        // Clean up any existing channels first to avoid conflicts
        Object.values(channelRefs.current).forEach((channel) => {
          if (channel) {
            try {
              supabase.removeChannel(channel);
            } catch (err) {
              // Silently handle cleanup errors
            }
          }
        });
        
        // Reset channel refs
        channelRefs.current = {};
        
        // Channel for player joins and game updates - use unique channel name with instance ID
        const channelName = `game-updates-${sessionId}`;
        logWithTimestamp(`Creating channel: ${channelName}`);
        
        const gameChannel = supabase.channel(channelName, {
          config: {
            presence: {
              key: `caller-${instanceId.current}`,
            },
          },
        });
        
        // Set up channel event handlers
        gameChannel
          .on('presence', { event: 'sync' }, () => {
            const state = gameChannel.presenceState();
            logWithTimestamp(`Presence sync on ${channelName}: ${safeLogObject(state)}`);
          })
          .on('broadcast', { event: 'player-join' }, (payload) => {
            if (payload.payload) {
              const { playerCode, playerName, timestamp } = payload.payload;
              
              logWithTimestamp(`Player joined: ${playerName || playerCode}`);
              
              // Add to connected players if not already there
              setConnectedPlayers(prev => {
                if (prev.some(p => p.playerCode === playerCode)) {
                  return prev;
                }
                
                return [
                  ...prev,
                  {
                    playerCode,
                    playerName: playerName || playerCode,
                    joinedAt: timestamp
                  }
                ];
              });
              
              // Send acknowledgment back to the player
              gameChannel.send({
                type: 'broadcast',
                event: 'player-join-ack',
                payload: {
                  playerCode,
                  timestamp: Date.now()
                }
              }).catch(err => {
                console.error("Error sending join acknowledgment:", err);
              });
              
              // Show toast notification
              if (isMounted.current) {
                toast({
                  title: "Player Joined",
                  description: `${playerName || playerCode} has joined the game`,
                  duration: 3000
                });
              }
            }
          })
          .subscribe(async (status) => {
            // Log the connection state for debugging
            logConnectionState('Game updates channel', status, isChannelConnected(status));
            
            if (isChannelConnected(status)) {
              // Clear the timeout as we're connected
              if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
                connectionTimeout.current = null;
              }
              
              try {
                // Track caller presence to let players know the game is hosted
                await gameChannel.track({
                  role: 'caller',
                  online: true,
                  session: sessionId,
                  timestamp: Date.now()
                });
                
                // Register successful connection with our global tracker
                registerSuccessfulConnection(sessionId, instanceId.current);
                
                // Update connection state
                if (isMounted.current) {
                  const stableState = getStableConnectionState('connected', stableConnectionState);
                  setIsConnected(true);
                  setConnectionState(stableState);
                  setConnectionError(null);
                  reconnectAttempt.current = 0;
                }
                
                // Log successful connection
                logConnectionSuccess('useCallerHub', sessionId);
                
                // Show success toast
                if (isMounted.current) {
                  toast({
                    title: "Connection Established",
                    description: "Successfully connected to the game server.",
                    duration: 3000
                  });
                }
                
                // Send a ping to all clients to announce the caller is online
                await gameChannel.send({
                  type: 'broadcast',
                  event: 'caller-online',
                  payload: {
                    sessionId,
                    timestamp: Date.now()
                  }
                });
                
                // Reset connection state
                connectionLoopState.current = null;
              } catch (err) {
                console.error("Error during post-connection setup:", err);
              } finally {
                // Mark connection as no longer in progress
                inProgressConnection.current = false;
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Handle connection errors
              if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
                connectionTimeout.current = null;
              }
              
              if (isMounted.current) {
                const stableState = getStableConnectionState('error', stableConnectionState);
                setIsConnected(false);
                setConnectionState(stableState);
                setConnectionError("Error connecting to game server");
              }
              
              logWithTimestamp(`Channel error or timeout for ${channelName}`);
              
              // Mark connection as no longer in progress
              inProgressConnection.current = false;
              
              // Schedule reconnect only if not in a connection loop
              if (!connectionLoopState.current?.inLoop && !connectionManager.current.isSuspended) {
                scheduleReconnect();
              }
            } else if (status === 'CLOSED') {
              // Handle disconnection
              if (isMounted.current && !isCleaningUp.current) {
                const stableState = getStableConnectionState('disconnected', stableConnectionState);
                setIsConnected(false);
                setConnectionState(stableState);
              }
              
              logWithTimestamp(`Channel closed for ${channelName}`);
              
              // Mark connection as no longer in progress
              inProgressConnection.current = false;
              
              // Only attempt reconnect if it wasn't deliberate (cleaning up) and we're not in a loop
              if (isMounted.current && !isCleaningUp.current && !connectionLoopState.current?.inLoop && !connectionManager.current.isSuspended) {
                scheduleReconnect();
              }
            }
          });
        
        // Channel for bingo claims - use unique channel name with instance ID
        const claimChannel = supabase.channel(`bingo-claims-${instanceId.current}`);
        claimChannel
          .on('broadcast', { event: 'bingo-claim' }, (payload) => {
            if (payload.payload && payload.payload.sessionId === sessionId) {
              const { playerCode, playerName, ticketData, timestamp } = payload.payload;
              
              logWithTimestamp(`Bingo claimed by ${playerName || playerCode}`);
              
              if (isMounted.current) {
                setPendingClaims(prev => [
                  ...prev,
                  {
                    playerCode,
                    playerName: playerName || playerCode,
                    claimedAt: timestamp,
                    ticketData
                  }
                ]);
                
                // Show claim toast
                toast({
                  title: "Bingo Claimed!",
                  description: `${playerName || playerCode} has claimed a bingo`,
                  duration: 5000
                });
              }
            }
          })
          .subscribe((status) => {
            logWithTimestamp(`Claim channel status: ${status}`);
          });
        
        // Store channels for later reference - safely update the ref 
        // to avoid race conditions with cleanup functions
        channelRefs.current = {
          gameChannel,
          claimChannel
        };
        
        // Send a ping to test the connection
        gameChannel.send({
          type: 'broadcast',
          event: 'caller-ping',
          payload: {
            timestamp: Date.now()
          }
        }).then(() => {
          logWithTimestamp("Sent ping to test connection");
        }).catch(err => {
          console.error("Error sending ping:", err);
        });
        
        return gameChannel;
      } catch (err) {
        // Handle connection setup errors
        if (connectionTimeout.current) {
          clearTimeout(connectionTimeout.current);
          connectionTimeout.current = null;
        }
        
        console.error("Error setting up realtime channels:", err);
        
        if (isMounted.current) {
          const stableState = getStableConnectionState('error', stableConnectionState);
          setIsConnected(false);
          setConnectionState(stableState);
          setConnectionError(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        
        // Mark connection as no longer in progress
        inProgressConnection.current = false;
        
        // Schedule reconnect if not in a loop
        if (!connectionLoopState.current?.inLoop && !connectionManager.current.isSuspended) {
          scheduleReconnect();
        }
        
        return null;
      }
    };
    
    // Function to schedule reconnect with exponential backoff
    const scheduleReconnect = () => {
      if (!isMounted.current || isCleaningUp.current || reconnectAttempt.current >= maxReconnectAttempts || connectionManager.current.isSuspended) {
        logWithTimestamp(`Max reconnection attempts (${maxReconnectAttempts}) reached for session ${sessionId} or connection suspended. Giving up.`);
        if (isMounted.current) {
          const stableState = getStableConnectionState('error', stableConnectionState);
          setConnectionState(stableState);
        }
        return;
      }
      
      reconnectAttempt.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10000); // Exponential backoff with 10s max
      logConnectionAttempt('useCallerHub', sessionId, reconnectAttempt.current, maxReconnectAttempts);
      
      // Clear any existing reconnect timer
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      
      // Use the delayed connection manager
      createDelayedConnectionAttempt(() => {
        if (isMounted.current && !inProgressConnection.current && !isCleaningUp.current) {
          logWithTimestamp(`Attempting reconnection #${reconnectAttempt.current} for session ${sessionId}...`);
          const stableState = getStableConnectionState('connecting', stableConnectionState);
          setConnectionState(stableState);
          setupConnection();
        }
      }, delay, isMounted, connectionManager);
    };
    
    // Initiate the connection
    setupConnection();
    
  }, [sessionId, connectionState, toast]);

  // Function to manually reconnect (called by UI reconnect button)
  const reconnect = useCallback(() => {
    if (!sessionId || !isMounted.current || inProgressConnection.current || isCleaningUp.current) {
      return;
    }
    
    logWithTimestamp(`Manual reconnection attempt for session ${sessionId}, instance ${instanceId.current}`);
    
    // Reset global connection tracking on manual reconnect
    if (connectionLoopState.current?.inLoop) {
      connectionLoopState.current = null; // Reset loop detector
      suspendConnectionAttempts(connectionManager, 100); // Very brief suspension
    }
    
    // Clean up existing channels
    const existingChannels = { ...channelRefs.current };
    channelRefs.current = {};
    
    // Actually clean up channels one by one
    Object.values(existingChannels).forEach((channel) => {
      if (channel) {
        try {
          logWithTimestamp(`Removing channel for manual reconnect: ${sessionId}`);
          supabase.removeChannel(channel);
        } catch (err) {
          // Silently handle errors during manual cleanup
        }
      }
    });
    
    // Reset connection state
    if (isMounted.current) {
      inProgressConnection.current = false; // Allow new connection
      reconnectAttempt.current = 0; // Reset attempt counter
      setIsConnected(false);
      setConnectionState('connecting'); // Start connection process again
    }
  }, [sessionId]);

  // Function to broadcast game updates to all connected players
  const broadcastGameUpdate = useCallback((updateData: any) => {
    if (!sessionId || !channelRefs.current.gameChannel || !isConnected) {
      logWithTimestamp("Cannot broadcast: missing sessionId or channel, or not connected");
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting game update: ${safeLogObject(updateData)}`);
      
      channelRefs.current.gameChannel.send({
        type: 'broadcast',
        event: 'game-update',
        payload: {
          ...updateData,
          sessionId,
          timestamp: Date.now()
        }
      }).catch(err => {
        console.error("Error broadcasting game update:", err);
        
        // If we got an error while broadcasting, check connection and attempt reconnect
        if (connectionState !== 'connecting' && isMounted.current && !isCleaningUp.current) {
          reconnect();
        }
      });
      
      return true;
    } catch (err) {
      console.error("Error sending broadcast:", err);
      return false;
    }
  }, [sessionId, connectionState, isConnected, reconnect]);
  
  // Function to call a new number
  const callNumber = useCallback((number: number, allCalledNumbers: number[]) => {
    return broadcastGameUpdate({
      lastCalledNumber: number,
      calledNumbers: allCalledNumbers
    });
  }, [broadcastGameUpdate]);
  
  // Function to change the active win pattern
  const changePattern = useCallback((pattern: string, prize?: string, prizeDescription?: string) => {
    return broadcastGameUpdate({
      currentWinPattern: pattern,
      currentPrize: prize,
      currentPrizeDescription: prizeDescription
    });
  }, [broadcastGameUpdate]);
  
  // Other game control functions
  const startGame = useCallback(() => {
    return broadcastGameUpdate({
      gameStatus: 'active'
    });
  }, [broadcastGameUpdate]);
  
  const endGame = useCallback(() => {
    return broadcastGameUpdate({
      gameStatus: 'completed'
    });
  }, [broadcastGameUpdate]);
  
  const nextGame = useCallback((gameNumber: number) => {
    return broadcastGameUpdate({
      gameNumber,
      calledNumbers: [],
      lastCalledNumber: null
    });
  }, [broadcastGameUpdate]);
  
  // Function to respond to a claim
  const respondToClaim = useCallback((playerCode: string, result: 'valid' | 'rejected', instanceId?: string) => {
    if (!sessionId) {
      return false;
    }
    
    try {
      // Use player-specific channel if we have instanceId
      const channelName = instanceId ? `player-claims-${instanceId}` : 'player-claims';
      const channel = supabase.channel(channelName);
      
      logWithTimestamp(`Sending claim result to ${playerCode}: ${result}`);
      
      channel
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: playerCode,
            result,
            timestamp: Date.now()
          }
        })
        .then(() => {
          // Remove this claim from the pending claims
          if (isMounted.current) {
            setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
          }
          logWithTimestamp(`Sent claim result via realtime: ${playerCode} - ${result}`);
          
          // Clean up temporary channel
          supabase.removeChannel(channel);
        })
        .catch(err => {
          console.error("Error sending claim result:", err);
          // Clean up even on error
          supabase.removeChannel(channel);
        });
      
      return true;
    } catch (err) {
      console.error("Error with claim response:", err);
      return false;
    }
  }, [sessionId]);
  
  // Update the effective isConnected state for consistency with connectionState
  useEffect(() => {
    // Use the effective connection state to ensure UI consistency
    const effectiveState = getEffectiveConnectionState(connectionState, isConnected);
    
    if (effectiveState !== connectionState) {
      setConnectionState(effectiveState);
    }
  }, [connectionState, isConnected]);
  
  return {
    isConnected,
    connectionState,
    connectionError,
    connectedPlayers,
    pendingClaims,
    reconnect,
    callNumber,
    changePattern,
    startGame,
    endGame,
    nextGame,
    respondToClaim
  };
}
