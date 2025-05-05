
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define connection states for better type safety
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Define the context type
interface NetworkContextType {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  lastPingTime: number | null;
  
  // Connection management methods
  connect: (sessionId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Listeners
  addNumberCalledListener: (callback: (number: number, allNumbers: number[]) => void) => () => void;
  addGameStateUpdateListener: (callback: (gameState: any) => void) => () => void;
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => () => void;
  addPlayersUpdateListener: (callback: (players: any[]) => void) => () => void;
  addTicketsAssignedListener: (callback: (playerCode: string, tickets: any[]) => void) => () => void;
  
  // Channel methods
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => Promise<boolean>;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
  fetchClaims: (sessionId: string) => Promise<any[]>;
  trackPlayerPresence: (presenceData: any) => boolean;
  
  // Additional information
  sessionId: string | null;
  getActiveChannel: () => any;
}

// Create context with default values
const NetworkContext = createContext<NetworkContextType>({
  connectionState: 'disconnected',
  isConnected: false,
  lastPingTime: null,
  connect: () => {},
  disconnect: () => {},
  reconnect: () => {},
  addNumberCalledListener: () => () => {},
  addGameStateUpdateListener: () => () => {},
  addConnectionStatusListener: () => () => {},
  addPlayersUpdateListener: () => () => {},
  addTicketsAssignedListener: () => () => {},
  callNumber: async () => false,
  submitBingoClaim: async () => false,
  validateClaim: async () => false,
  fetchClaims: async () => [],
  trackPlayerPresence: () => false,
  sessionId: null,
  getActiveChannel: () => null,
});

// Custom hook to use the NetworkContext
export const useNetwork = () => useContext(NetworkContext);

// Provider component
export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Private state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  
  // Event listeners storage
  const [numberCalledListeners] = useState<Array<(number: number, allNumbers: number[]) => void>>([]);
  const [gameStateListeners] = useState<Array<(gameState: any) => void>>([]);
  const [connectionStatusListeners] = useState<Array<(isConnected: boolean) => void>>([]);
  const [playersUpdateListeners] = useState<Array<(players: any[]) => void>>([]);
  const [ticketsAssignedListeners] = useState<Array<(playerCode: string, tickets: any[]) => void>>([]);
  
  // Connection tracking ref to prevent multiple connection attempts to the same session
  const connectedSessionRef = React.useRef<string | null>(null);
  
  // Check if we're connected
  const isConnected = connectionState === 'connected';
  
  // Connection lock to prevent multiple connection attempts
  const connectionLockRef = React.useRef<boolean>(false);
  
  // Clean up existing channel
  const cleanupChannel = useCallback(() => {
    if (channel) {
      try {
        logWithTimestamp(`Cleaning up channel in state: ${channel.state}`, 'info');
        
        if (channel.state !== 'CLOSED') {
          channel.unsubscribe();
        }
        
        // Clear the reference
        setChannel(null);
      } catch (err) {
        logWithTimestamp(`Error unsubscribing from channel: ${err}`, 'error');
      }
    }
  }, [channel]);
  
  // Set up channel listeners
  const setupChannelListeners = useCallback((newChannel: any) => {
    if (!newChannel) {
      logWithTimestamp('Cannot set up listeners: No channel available', 'error');
      return;
    }
    
    newChannel
      .on('presence', { event: 'sync' }, () => {
        logWithTimestamp('Received presence sync event', 'debug');
        // Update last ping time
        setLastPingTime(Date.now());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        logWithTimestamp(`Presence join: ${key}`, 'debug');
        // Update players
        playersUpdateListeners.forEach(listener => {
          try {
            const allPresences = newChannel.presenceState();
            const players = Object.values(allPresences).flat();
            listener(players);
          } catch (err) {
            logWithTimestamp(`Error in players update listener: ${err}`, 'error');
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        logWithTimestamp(`Presence leave: ${key}`, 'debug');
        // Update players
        playersUpdateListeners.forEach(listener => {
          try {
            const allPresences = newChannel.presenceState();
            const players = Object.values(allPresences).flat();
            listener(players);
          } catch (err) {
            logWithTimestamp(`Error in players update listener: ${err}`, 'error');
          }
        });
      })
      .on('broadcast', { event: 'game-state-update' }, (payload: any) => {
        logWithTimestamp('Received game state update', 'debug');
        gameStateListeners.forEach(listener => {
          try {
            listener(payload);
          } catch (err) {
            logWithTimestamp(`Error in game state listener: ${err}`, 'error');
          }
        });
      })
      .on('broadcast', { event: 'tickets-assigned' }, (payload: any) => {
        logWithTimestamp(`Received tickets assigned: ${payload?.playerCode}`, 'debug');
        ticketsAssignedListeners.forEach(listener => {
          try {
            listener(payload.playerCode, payload.tickets);
          } catch (err) {
            logWithTimestamp(`Error in tickets assigned listener: ${err}`, 'error');
          }
        });
      })
      .on('broadcast', { event: 'number-called' }, (payload: any) => {
        const { lastCalledNumber, calledNumbers } = payload || {};
        logWithTimestamp(`Received number called: ${lastCalledNumber}`, 'debug');
        
        if (lastCalledNumber && calledNumbers) {
          numberCalledListeners.forEach(listener => {
            try {
              listener(lastCalledNumber, calledNumbers);
            } catch (err) {
              logWithTimestamp(`Error in number called listener: ${err}`, 'error');
            }
          });
        }
      });
      
    return newChannel;
  }, [gameStateListeners, numberCalledListeners, playersUpdateListeners, ticketsAssignedListeners]);
  
  // Connect to the channel - with improved session tracking
  const connect = useCallback((newSessionId: string) => {
    // If we're already connected to this session, do nothing
    if (connectedSessionRef.current === newSessionId && channel && connectionState === 'connected') {
      logWithTimestamp(`Already connected to session ${newSessionId}`, 'info');
      return;
    }
    
    // Don't allow connection if we're in the middle of another operation
    if (connectionLockRef.current) {
      logWithTimestamp('Connection operation in progress, deferring connect', 'info');
      setTimeout(() => connect(newSessionId), 500);
      return;
    }
    
    // Set the lock
    connectionLockRef.current = true;
    
    try {
      // Store the session ID
      setSessionId(newSessionId);
      connectedSessionRef.current = newSessionId;
      
      // Set to connecting state
      setConnectionState('connecting');
      
      // Clean up existing channel if needed
      cleanupChannel();
      
      // Create a new channel
      logWithTimestamp(`Creating new channel for session ${newSessionId}`, 'info');
      const newChannel = supabase.channel(`game-${newSessionId}`);
      
      // Set up channel listeners
      setupChannelListeners(newChannel);
      
      // Store the channel
      setChannel(newChannel);
      
      // Subscribe to the channel
      newChannel.subscribe((status: string) => {
        logWithTimestamp(`Subscription status: ${status}`, 'info');
        
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          setReconnectAttempts(0); // Reset reconnect attempts on successful connection
          setLastPingTime(Date.now());
          
          // Notify connection status listeners
          connectionStatusListeners.forEach(listener => {
            try {
              listener(true);
            } catch (err) {
              logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
            }
          });
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setConnectionState('error');
          
          // Notify connection status listeners
          connectionStatusListeners.forEach(listener => {
            try {
              listener(false);
            } catch (err) {
              logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
            }
          });
          
          // Schedule reconnect
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
          setTimeout(() => {
            reconnect();
          }, delay);
        }
      });
    } catch (error) {
      logWithTimestamp(`Error in connect: ${error}`, 'error');
      setConnectionState('error');
      
      // Notify connection status listeners
      connectionStatusListeners.forEach(listener => {
        try {
          listener(false);
        } catch (err) {
          logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
        }
      });
    } finally {
      // Release the lock
      connectionLockRef.current = false;
    }
  }, [
    channel, 
    cleanupChannel, 
    connectionState,
    connectionStatusListeners, 
    reconnectAttempts, 
    setupChannelListeners
  ]);
  
  // Disconnect from the channel
  const disconnect = useCallback(() => {
    if (connectionState === 'disconnected') {
      logWithTimestamp('Already disconnected', 'info');
      return;
    }
    
    cleanupChannel();
    setConnectionState('disconnected');
    connectedSessionRef.current = null;
    
    // Notify connection status listeners
    connectionStatusListeners.forEach(listener => {
      try {
        listener(false);
      } catch (err) {
        logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
      }
    });
  }, [cleanupChannel, connectionState, connectionStatusListeners]);
  
  // Reconnect to the channel
  const reconnect = useCallback(() => {
    // Don't reconnect if we don't have a session ID
    if (!sessionId) {
      logWithTimestamp('Cannot reconnect: No session ID available', 'error');
      return;
    }
    
    // Don't reconnect if we're already reconnecting
    if (isReconnecting) {
      logWithTimestamp('Reconnection already in progress', 'info');
      return;
    }
    
    setIsReconnecting(true);
    setReconnectAttempts(prev => prev + 1);
    
    logWithTimestamp(`Reconnecting to session ${sessionId}`, 'info');
    
    // If we've tried too many times, give up
    if (reconnectAttempts > 10) {
      logWithTimestamp('Maximum reconnect attempts reached', 'error');
      setConnectionState('error');
      setIsReconnecting(false);
      return;
    }
    
    // Connect again
    connect(sessionId);
    
    // Clear the reconnecting flag after a delay
    setTimeout(() => {
      setIsReconnecting(false);
    }, 2000);
  }, [connect, isReconnecting, reconnectAttempts, sessionId]);
  
  // Add a number called listener
  const addNumberCalledListener = useCallback(
    (callback: (number: number, allNumbers: number[]) => void) => {
      numberCalledListeners.push(callback);
      return () => {
        const index = numberCalledListeners.indexOf(callback);
        if (index !== -1) {
          numberCalledListeners.splice(index, 1);
        }
      };
    },
    [numberCalledListeners]
  );
  
  // Add a game state update listener
  const addGameStateUpdateListener = useCallback(
    (callback: (gameState: any) => void) => {
      gameStateListeners.push(callback);
      return () => {
        const index = gameStateListeners.indexOf(callback);
        if (index !== -1) {
          gameStateListeners.splice(index, 1);
        }
      };
    },
    [gameStateListeners]
  );
  
  // Add a connection status listener
  const addConnectionStatusListener = useCallback(
    (callback: (isConnected: boolean) => void) => {
      connectionStatusListeners.push(callback);
      // Immediately call with current state
      callback(connectionState === 'connected');
      return () => {
        const index = connectionStatusListeners.indexOf(callback);
        if (index !== -1) {
          connectionStatusListeners.splice(index, 1);
        }
      };
    },
    [connectionState, connectionStatusListeners]
  );
  
  // Add a players update listener
  const addPlayersUpdateListener = useCallback(
    (callback: (players: any[]) => void) => {
      playersUpdateListeners.push(callback);
      return () => {
        const index = playersUpdateListeners.indexOf(callback);
        if (index !== -1) {
          playersUpdateListeners.splice(index, 1);
        }
      };
    },
    [playersUpdateListeners]
  );
  
  // Add a tickets assigned listener
  const addTicketsAssignedListener = useCallback(
    (callback: (playerCode: string, tickets: any[]) => void) => {
      ticketsAssignedListeners.push(callback);
      return () => {
        const index = ticketsAssignedListeners.indexOf(callback);
        if (index !== -1) {
          ticketsAssignedListeners.splice(index, 1);
        }
      };
    },
    [ticketsAssignedListeners]
  );
  
  // Call a number
  const callNumber = useCallback(
    async (number: number, targetSessionId?: string): Promise<boolean> => {
      const effectiveSessionId = targetSessionId || sessionId;
      
      if (!effectiveSessionId || !channel) {
        logWithTimestamp('Cannot call number: No session ID or channel available', 'error');
        return false;
      }
      
      try {
        logWithTimestamp(`Calling number ${number} for session ${effectiveSessionId}`, 'info');
        
        // Update the database first
        const { error } = await supabase
          .from('sessions_progress')
          .select('called_numbers')
          .eq('session_id', effectiveSessionId)
          .single();
          
        if (error) {
          throw error;
        }
        
        // Send the event through the channel
        await channel.send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId: effectiveSessionId,
            lastCalledNumber: number,
            calledNumbers: [], // Let the server handle this
            timestamp: new Date().toISOString()
          }
        });
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error calling number: ${error}`, 'error');
        return false;
      }
    },
    [channel, sessionId]
  );
  
  // Submit a bingo claim
  const submitBingoClaim = useCallback(
    async (ticket: any, playerCode: string, targetSessionId: string): Promise<boolean> => {
      if (!channel || !playerCode || !targetSessionId) {
        logWithTimestamp('Cannot submit claim: Missing channel, player code, or session ID', 'error');
        return false;
      }
      
      try {
        logWithTimestamp(`Submitting bingo claim for player ${playerCode} in session ${targetSessionId}`, 'info');
        
        // Send the event through the channel
        await channel.send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            sessionId: targetSessionId,
            playerCode,
            ticket,
            timestamp: new Date().toISOString()
          }
        });
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error submitting bingo claim: ${error}`, 'error');
        return false;
      }
    },
    [channel]
  );
  
  // Validate a claim
  const validateClaim = useCallback(
    async (claim: any, isValid: boolean): Promise<boolean> => {
      if (!channel || !claim?.id) {
        logWithTimestamp('Cannot validate claim: Missing channel or claim ID', 'error');
        return false;
      }
      
      try {
        logWithTimestamp(`Validating claim ${claim.id}, result: ${isValid ? 'valid' : 'rejected'}`, 'info');
        
        // Update the database directly
        const { error } = await supabase
          .from('universal_game_logs')
          .update({
            validated_at: new Date().toISOString(),
            caller_id: 'system', // This should be the actual caller ID in a real app
            win_pattern: claim.win_pattern || 'unknown'
          })
          .eq('id', claim.id);
          
        if (error) {
          throw error;
        }
        
        // Send the event through the channel
        await channel.send({
          type: 'broadcast',
          event: 'claim-validated',
          payload: {
            claimId: claim.id,
            isValid,
            timestamp: new Date().toISOString()
          }
        });
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error validating claim: ${error}`, 'error');
        return false;
      }
    },
    [channel]
  );
  
  // Fetch claims
  const fetchClaims = useCallback(
    async (targetSessionId: string): Promise<any[]> => {
      if (!targetSessionId) {
        logWithTimestamp('Cannot fetch claims: No session ID available', 'error');
        return [];
      }
      
      try {
        logWithTimestamp(`Fetching claims for session ${targetSessionId}`, 'info');
        
        // Query the database directly
        const { data, error } = await supabase
          .from('universal_game_logs')
          .select('*')
          .eq('session_id', targetSessionId)
          .is('validated_at', null)
          .not('claimed_at', 'is', null);
          
        if (error) {
          throw error;
        }
        
        // Process the claims to ensure ticket data is formatted properly
        const processedClaims = data.map((claim: any) => {
          // Add ticket object if we have the necessary fields
          if (claim.ticket_serial) {
            claim.ticket = {
              serial: claim.ticket_serial,
              numbers: claim.ticket_numbers || [],
              layoutMask: claim.ticket_layout_mask || 0,
              perm: claim.ticket_perm || 0,
              position: claim.ticket_position || 0
            };
          }
          
          return claim;
        });
        
        return processedClaims || [];
      } catch (error) {
        logWithTimestamp(`Error fetching claims: ${error}`, 'error');
        return [];
      }
    },
    []
  );
  
  // Track player presence
  const trackPlayerPresence = useCallback(
    (presenceData: any): boolean => {
      if (!channel) {
        logWithTimestamp('Cannot track player presence: No channel available', 'error');
        return false;
      }
      
      try {
        logWithTimestamp('Tracking player presence', 'debug');
        
        // Track presence through the channel
        channel.track(presenceData);
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error tracking player presence: ${error}`, 'error');
        return false;
      }
    },
    [channel]
  );
  
  // Get the active channel
  const getActiveChannel = useCallback(() => channel, [channel]);
  
  // Set up a more conservative heartbeat to check connection status
  // This will prevent excessive reconnection attempts
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      if (connectionState === 'connected' && channel) {
        // If we haven't received a ping in the last 60 seconds, reconnect
        const now = Date.now();
        if (lastPingTime && now - lastPingTime > 60000) {
          logWithTimestamp('No ping received in 60 seconds, attempting reconnect', 'info');
          reconnect();
        }
      }
    }, 20000); // Check less frequently
    
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [channel, connectionState, lastPingTime, reconnect]);
  
  // Return the provider
  return (
    <NetworkContext.Provider
      value={{
        connectionState,
        isConnected,
        lastPingTime,
        connect,
        disconnect,
        reconnect,
        addNumberCalledListener,
        addGameStateUpdateListener,
        addConnectionStatusListener,
        addPlayersUpdateListener,
        addTicketsAssignedListener,
        callNumber,
        submitBingoClaim,
        validateClaim,
        fetchClaims,
        trackPlayerPresence,
        sessionId,
        getActiveChannel,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};
