import { useState, useEffect, useRef, useCallback } from 'react';
import { logWithTimestamp, ConnectionManagerClass } from '@/utils/logUtils';
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

// Global registry of active caller connections to prevent duplicates
const activeCallerConnections = new Map<string, string>();

// Hook to handle caller WebSocket hub connection and state
export function useCallerHub(sessionId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const channelRef = useRef<any>(null);
  const instanceId = useRef<string>(`${Date.now().toString()}`);
  const connectionManager = useRef(new ConnectionManagerClass());
  
  // CRITICAL FIX: Track received presence data separately from processed players list
  const presenceStateRef = useRef<Record<string, any[]>>({});
  
  // Debug event counter for tracking presence updates
  const presenceEventsRef = useRef<number>(0);

  // Function to establish WebSocket connection to bingo hub
  const connectToHub = useCallback(() => {
    // Skip if no session ID
    if (!sessionId) return () => {};
    
    // Don't reconnect if we're already connecting
    if (connectionManager.current.isConnecting) {
      logWithTimestamp("Connection attempt already in progress, skipping redundant attempt");
      return () => {};
    }
    
    if (connectionManager.current.isInCooldown) {
      const remainingCooldown = Math.ceil((connectionManager.current.cooldownUntil - Date.now()) / 1000);
      logWithTimestamp(`In cooldown period, ${remainingCooldown}s remaining before next attempt`);
      return () => {};
    }
    
    // Check for duplicate connection from this same session
    const connectionKey = `caller:${sessionId}`;
    if (activeCallerConnections.has(connectionKey) && activeCallerConnections.get(connectionKey) !== instanceId.current) {
      logWithTimestamp(`Another active caller connection exists for ${connectionKey}, skipping`);
      return () => {};
    }
    
    try {
      connectionManager.current.startConnection();
      logWithTimestamp(`Caller connecting to WebSocket for session ${sessionId}, instance ${instanceId.current}`);
      
      // Register this instance as the active connection
      activeCallerConnections.set(connectionKey, instanceId.current);
      
      // Clean up any existing channel first
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      setConnectionState('connecting');
      
      // Create a channel for this session
      const channel = supabase.channel(`game-updates-${sessionId}`);
      
      // Set up presence handlers with improved logging
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const eventId = ++presenceEventsRef.current;
          logWithTimestamp(`[Event ${eventId}] Presence state synchronized: ${JSON.stringify(state)}`);
          
          // CRITICAL FIX: Store the raw presence state for processing
          presenceStateRef.current = state;
          
          // Process and update connected players from presence state
          processPresenceState(state, eventId);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          const eventId = ++presenceEventsRef.current;
          logWithTimestamp(`[Event ${eventId}] Presence join: ${key}, ${JSON.stringify(newPresences)}`);
          
          // Add to presence state
          if (!presenceStateRef.current[key]) {
            presenceStateRef.current[key] = [];
          }
          presenceStateRef.current[key].push(...newPresences);
          
          // Log complete state after join
          logWithTimestamp(`[Event ${eventId}] Updated presence state after join: ${JSON.stringify(presenceStateRef.current)}`);
          
          // Update connected players
          processPresenceState(presenceStateRef.current, eventId);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          const eventId = ++presenceEventsRef.current;
          logWithTimestamp(`[Event ${eventId}] Presence leave: ${key}, ${JSON.stringify(leftPresences)}`);
          
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
          
          // Log complete state after leave
          logWithTimestamp(`[Event ${eventId}] Updated presence state after leave: ${JSON.stringify(presenceStateRef.current)}`);
          
          // Update connected players
          processPresenceState(presenceStateRef.current, eventId);
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
        connectionManager.current.endConnection(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setConnectionError(null);
          
          // CRITICAL FIX: Explicitly track presence after successful subscription
          const presenceData = {
            caller_id: instanceId.current,
            online_at: new Date().toISOString(),
            client_type: 'caller'
          };
          
          logWithTimestamp(`Tracking caller presence: ${JSON.stringify(presenceData)}`);
          
          // Broadcast presence as caller
          channel.track(presenceData).then(() => {
            logWithTimestamp('Caller presence tracked successfully');
          }).catch(err => {
            logWithTimestamp(`Error tracking caller presence: ${err.message}`);
          });
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('error');
          setConnectionError('Channel error connecting to game server');
          
          // Schedule reconnect through connection manager
          connectionManager.current.scheduleReconnect(reconnect);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionState('disconnected');
          
          // Schedule reconnect through connection manager
          connectionManager.current.scheduleReconnect(reconnect);
        }
      });
      
      // Store channel reference
      channelRef.current = channel;
      
      return () => {
        logWithTimestamp(`Cleaning up caller WebSocket connection`);
        
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        
        // Remove from active connections registry
        activeCallerConnections.delete(connectionKey);
      };
    } catch (error) {
      connectionManager.current.endConnection(false);
      logWithTimestamp(`Error establishing WebSocket connection: ${error}`);
      setIsConnected(false);
      setConnectionState('error');
      setConnectionError(`Connection error: ${error}`);
      
      // Remove from active connections registry on error
      const connectionKey = `caller:${sessionId}`;
      activeCallerConnections.delete(connectionKey);
      
      return () => {};
    }
  }, [sessionId]);
  
  // CRITICAL FIX: Improved presence state processing
  const processPresenceState = useCallback((state: Record<string, any[]>, eventId?: number) => {
    // Extract players from presence state
    const players: ConnectedPlayer[] = [];
    
    Object.entries(state).forEach(([clientId, presences]) => {
      presences.forEach(presence => {
        // Only add players to the list (not callers)
        if (presence.client_type === 'player' && presence.playerCode) {
          // Add the player to our list
          players.push({
            playerCode: presence.playerCode,
            playerName: presence.playerName || presence.playerCode,
            joinedAt: presence.online_at || new Date().toISOString(),
            clientId
          });
          
          // Debug log for player presence
          logWithTimestamp(`Found player in presence data: ${presence.playerCode} (${presence.playerName || 'unnamed'})`);
        }
      });
    });
    
    logWithTimestamp(`Processed ${players.length} players from presence state${eventId ? ` for event ${eventId}` : ''}`);
    
    // Only update state if players array has changed
    setConnectedPlayers(prevPlayers => {
      // Simple check for change: different length or different order/content
      const hasChanged = 
        prevPlayers.length !== players.length ||
        JSON.stringify(prevPlayers.map(p => p.playerCode).sort()) !== 
        JSON.stringify(players.map(p => p.playerCode).sort());
      
      return hasChanged ? players : prevPlayers;
    });
  }, []);
  
  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp(`Manually triggered caller WebSocket reconnect`);
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Reset connection manager
    connectionManager.current.forceReconnect();
    setConnectionState('connecting');
    connectToHub();
  }, [connectToHub]);
  
  // Method to broadcast a number call
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
  
  // Method to broadcast game start
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
      
      // Clean up connection registration
      if (sessionId) {
        const connectionKey = `caller:${sessionId}`;
        activeCallerConnections.delete(connectionKey);
      }
      
      // Reset connection manager
      connectionManager.current.reset();
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
    callNumber: (number: number, allCalledNumbers: number[]) => {
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
    },
    startGame: () => {
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
    },
    verifyClaim: (playerCode: string, isValid: boolean) => {
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
    },
    respondToClaim: (playerCode: string, result: 'valid' | 'rejected') => {
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
    },
    changePattern: (pattern: string) => {
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
    }
  };
}
