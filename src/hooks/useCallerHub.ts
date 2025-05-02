
import { useState, useEffect, useRef, useCallback } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectedPlayer {
  playerCode: string;
  playerName?: string;
  joinedAt: string;
  clientId?: string;
}

export interface PendingClaim {
  playerCode: string;
  playerName?: string;
  timestamp: number;
  ticketData?: any;
}

// Hook to handle caller WebSocket hub connection and state
export function useCallerHub(sessionId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const channelRef = useRef<any>(null);
  const instanceId = useRef<string>(Date.now().toString());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const connectionInProgressRef = useRef(false); // Track if connection attempt is in progress
  
  // CRITICAL FIX: Track received presence data separately from processed players list
  const presenceStateRef = useRef<Record<string, any[]>>({});

  // Function to establish WebSocket connection to bingo hub
  const connectToHub = useCallback(() => {
    // Don't reconnect if we're already connecting
    if (connectionInProgressRef.current) {
      logWithTimestamp("Connection attempt already in progress, skipping redundant attempt");
      return;
    }
    
    if (!sessionId) return;
    
    try {
      connectionInProgressRef.current = true;
      logWithTimestamp(`Caller connecting to WebSocket for session ${sessionId}, instance ${instanceId.current}`);
      
      // Clean up any existing connection first
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      setConnectionState('connecting');
      
      // Create a channel for this session
      const channel = supabase.channel(`game-updates-${sessionId}`);
      
      // Set up presence handlers
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          logWithTimestamp(`Presence state synchronized: ${JSON.stringify(state)}`);
          
          // CRITICAL FIX: Store the raw presence state for processing
          presenceStateRef.current = state;
          
          // Process and update connected players from presence state
          processPresenceState(state);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          logWithTimestamp(`Presence join: ${key}, ${JSON.stringify(newPresences)}`);
          
          // Add to presence state
          if (!presenceStateRef.current[key]) {
            presenceStateRef.current[key] = [];
          }
          presenceStateRef.current[key].push(...newPresences);
          
          // Update connected players
          processPresenceState(presenceStateRef.current);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          logWithTimestamp(`Presence leave: ${key}, ${JSON.stringify(leftPresences)}`);
          
          // Remove from presence state
          if (presenceStateRef.current[key]) {
            // Filter out the left presences
            presenceStateRef.current[key] = presenceStateRef.current[key].filter(
              presence => !leftPresences.some((left: any) => left.presence_ref === presence.presence_ref)
            );
            
            // Remove key if no presences left
            if (presenceStateRef.current[key].length === 0) {
              delete presenceStateRef.current[key];
            }
          }
          
          // Update connected players
          processPresenceState(presenceStateRef.current);
        });
      
      // Set up message handlers for bingo claims
      channel
        .on('broadcast', { event: 'bingo_claimed' }, (payload) => {
          logWithTimestamp(`Received bingo claim: ${JSON.stringify(payload.payload)}`);
          
          if (payload.payload) {
            const { playerCode, playerName, ticketData, timestamp } = payload.payload;
            
            setPendingClaims(prev => [
              ...prev,
              {
                playerCode,
                playerName,
                timestamp,
                ticketData
              }
            ]);
          }
        });
      
      // Subscribe and track connection status
      channel.subscribe(status => {
        logWithTimestamp(`Caller WebSocket ${status} for session ${sessionId}`);
        connectionInProgressRef.current = false;
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          
          // Broadcast presence as caller
          channel.track({
            caller_id: instanceId.current,
            online_at: new Date().toISOString(),
            client_type: 'caller'
          }).then(() => {
            logWithTimestamp('Caller presence tracked successfully');
          }).catch(err => {
            logWithTimestamp(`Error tracking caller presence: ${err.message}`);
          });
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('error');
          setConnectionError('Channel error connecting to game server');
          
          // Only attempt reconnect if not at max attempts
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            // Schedule reconnect
            handleReconnect();
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionState('disconnected');
          
          // Only attempt reconnect if not at max attempts
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            // Schedule reconnect
            handleReconnect();
          }
        }
      });
      
      // Store channel reference
      channelRef.current = channel;
    } catch (error) {
      connectionInProgressRef.current = false;
      logWithTimestamp(`Error establishing WebSocket connection: ${error}`);
      setIsConnected(false);
      setConnectionState('error');
      setConnectionError(`Connection error: ${error}`);
    }
  }, [sessionId]);
  
  // CRITICAL FIX: Improved presence state processing
  const processPresenceState = useCallback((state: Record<string, any[]>) => {
    // Extract players from presence state
    const players: ConnectedPlayer[] = [];
    
    Object.entries(state).forEach(([clientId, presences]) => {
      presences.forEach(presence => {
        // Only add players to the list (not callers)
        if (presence.client_type === 'player' && presence.playerCode) {
          players.push({
            playerCode: presence.playerCode,
            playerName: presence.playerName || presence.playerCode,
            joinedAt: presence.online_at || new Date().toISOString(),
            clientId
          });
        }
      });
    });
    
    logWithTimestamp(`Processed ${players.length} players from presence state`);
    setConnectedPlayers(players);
  }, []);
  
  // Function to handle reconnect with exponential backoff
  const handleReconnect = useCallback(() => {
    // Only increment if not already at max
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
    
    logWithTimestamp(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
        logWithTimestamp(`Attempting reconnect for session ${sessionId} (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        connectToHub();
      }
    }, delay);
  }, [connectToHub, sessionId]);
  
  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp(`Closing caller WebSocket connection`);
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    connectionInProgressRef.current = false;
    setConnectionState('connecting');
    connectToHub();
  }, [connectToHub]);
  
  // Function to broadcast a number call
  const callNumber = useCallback((number: number, allCalledNumbers: number[]) => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot broadcast number: not connected');
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting called number: ${number}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'number-called',
        payload: {
          sessionId,
          lastCalledNumber: number,
          calledNumbers: allCalledNumbers,
          timestamp: Date.now()
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error broadcasting called number: ${error}`);
      return false;
    }
  }, [isConnected, sessionId]);
  
  // Function to broadcast game start
  const startGame = useCallback(() => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot broadcast game start: not connected');
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting game start for session: ${sessionId}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'game-update',
        payload: {
          sessionId,
          gameStatus: 'active',
          timestamp: Date.now()
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error broadcasting game start: ${error}`);
      return false;
    }
  }, [isConnected, sessionId]);
  
  // Verify claim result
  const verifyClaim = useCallback((playerCode: string, isValid: boolean) => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot verify claim: not connected');
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting claim verification for player: ${playerCode}, valid: ${isValid}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          sessionId,
          playerId: playerCode,
          result: isValid ? 'valid' : 'rejected',
          timestamp: Date.now()
        }
      });
      
      // Remove from pending claims
      setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error verifying claim: ${error}`);
      return false;
    }
  }, [isConnected, sessionId]);
  
  // Method to respond to claim with a specific result (valid or rejected)
  const respondToClaim = useCallback((playerCode: string, result: 'valid' | 'rejected') => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot respond to claim: not connected');
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting claim result for player: ${playerCode}, result: ${result}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          sessionId,
          playerId: playerCode,
          result: result,
          timestamp: Date.now()
        }
      });
      
      // Remove from pending claims if it was responded to
      if (result === 'valid' || result === 'rejected') {
        setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error responding to claim: ${error}`);
      return false;
    }
  }, [isConnected, sessionId]);
  
  // Method to change win pattern
  const changePattern = useCallback((pattern: string) => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot change pattern: not connected');
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting pattern change to: ${pattern}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'pattern-change',
        payload: {
          sessionId,
          pattern: pattern,
          timestamp: Date.now()
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error changing pattern: ${error}`);
      return false;
    }
  }, [isConnected, sessionId]);
  
  // Initialize on first render
  useEffect(() => {
    if (sessionId) {
      connectToHub();
    }
    
    return () => {
      logWithTimestamp(`Cleaning up caller WebSocket connection`);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Reset connection flags on unmount
      connectionInProgressRef.current = false;
    };
  }, [connectToHub, sessionId]);
  
  // Return the caller hub API
  return {
    isConnected,
    connectionState,
    connectionError,
    connectedPlayers,
    pendingClaims,
    reconnect,
    callNumber,
    startGame,
    verifyClaim,
    respondToClaim,
    changePattern
  };
}
