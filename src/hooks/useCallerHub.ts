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
  const instanceId = useRef<string>(`caller-${Date.now().toString()}`);
  const connectionManager = useRef(new ConnectionManagerClass());
  
  // Track presence data separately
  const presenceStateRef = useRef<Record<string, any[]>>({});
  const presenceEventsRef = useRef<number>(0);
  
  // Tracking mechanism for player presence specifically
  const playerPresenceMap = useRef<Map<string, ConnectedPlayer>>(new Map());

  // Function to establish WebSocket connection to bingo hub
  const connectToHub = useCallback(() => {
    // Skip if no session ID
    if (!sessionId) return () => {};
    
    // Don't reconnect if we're already connecting
    if (connectionManager.current.isConnecting) {
      logWithTimestamp("Connection attempt already in progress, skipping redundant attempt");
      return () => {};
    }
    
    // Check cooldown
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
      
      // Clean up any existing channel first to avoid duplicates
      if (channelRef.current) {
        logWithTimestamp(`Removing existing channel before creating a new one`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      setConnectionState('connecting');
      
      // Create a channel for this session with unique name to avoid conflicts
      const channelName = `game-updates-${sessionId}-${instanceId.current}`;
      logWithTimestamp(`Creating channel with name: ${channelName}`);
      const channel = supabase.channel(channelName);
      
      // Set up presence handlers with improved logging
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const eventId = ++presenceEventsRef.current;
          logWithTimestamp(`[Event ${eventId}] Presence state synchronized: ${JSON.stringify(state)}`);
          
          // Store the raw presence state for processing
          presenceStateRef.current = state;
          
          // Process players data from presence state
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
          
          // Track presence after successful subscription
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
          
          // Schedule reconnect with exponential backoff
          connectionManager.current.scheduleReconnect(() => {
            reconnect();
          });
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionState('disconnected');
          
          // Schedule reconnect with exponential backoff
          connectionManager.current.scheduleReconnect(() => {
            reconnect();
          });
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
  
  // Improved presence state processing
  const processPresenceState = useCallback((state: Record<string, any[]>, eventId?: number) => {
    // Clear map first to rebuild from scratch with fresh data
    playerPresenceMap.current.clear();
    
    // Extract players from presence state
    Object.entries(state).forEach(([clientId, presences]) => {
      presences.forEach(presence => {
        // Only add players to the list (not callers)
        if (presence.client_type === 'player' && presence.playerCode) {
          // Use playerCode as the unique identifier
          playerPresenceMap.current.set(presence.playerCode, {
            playerCode: presence.playerCode,
            playerName: presence.playerName || presence.playerCode,
            joinedAt: presence.online_at || new Date().toISOString(),
            clientId
          });
          
          // Debug log for player presence
          logWithTimestamp(`Found player in presence data: ${presence.playerCode} (${presence.playerName || 'unnamed'})`);
        } else if (presence.playerCode) {
          // Log other entities with playerCode that don't have client_type = 'player'
          logWithTimestamp(`Found entity with playerCode but not client_type='player': ${JSON.stringify(presence)}`);
        }
      });
    });
    
    // Convert map to array for state update
    const players = Array.from(playerPresenceMap.current.values());
    logWithTimestamp(`Processed ${players.length} players from presence state${eventId ? ` for event ${eventId}` : ''}`);
    
    // Update state
    setConnectedPlayers(players);
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

  // Method to broadcast a number call
  const callNumber = useCallback((number: number, remainingNumbers: number[]) => {
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
          calledNumbers: remainingNumbers,
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
  
  // Method to verify a claim - changed to accept string or boolean
  const verifyClaim = useCallback((playerCode: string, isValid: boolean | string) => {
    if (!channelRef.current || !isConnected) {
      logWithTimestamp('Cannot verify claim: not connected');
      return false;
    }
    
    try {
      // Convert string 'valid' to boolean true and 'rejected' to false if needed
      const validBoolean = typeof isValid === 'string' 
        ? isValid === 'valid' 
        : isValid;
      
      logWithTimestamp(`Broadcasting claim verification for player: ${playerCode}, valid: ${validBoolean}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          sessionId,
          playerId: playerCode,
          result: validBoolean ? 'valid' : 'rejected',
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
  
  // Change pattern
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
    changePattern,
    respondToClaim: verifyClaim // Alias for backward compatibility
  };
}
