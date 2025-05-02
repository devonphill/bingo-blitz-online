
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameType } from '@/types';
import { logWithTimestamp, ConnectionManagerClass } from '@/utils/logUtils';

export interface GameState {
  gameStatus: string;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
}

// Global registry of active connections to prevent duplicates
const activeConnections = new Map<string, string>();

export function useBingoSync(sessionId: string, playerCode: string, playerName: string = '') {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    gameStatus: 'pending',
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null, 
    currentPrize: null,
    currentPrizeDescription: null,
  });

  // Store channel reference
  const channelRef = useRef<any>(null);
  
  // Use connection manager for better connection stability
  const connectionManager = useRef(new ConnectionManagerClass());
  
  // Create a unique instance ID for this hook instance to track connections
  const instanceId = useRef<string>(`${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // IMPROVED: Function to properly subscribe to a channel before using presence
  const subscribeToChannel = useCallback(() => {
    // Skip if missing required params
    if (!sessionId || !playerCode) {
      logWithTimestamp("Missing required params for connection");
      return () => {};
    }
    
    // Don't reconnect if we're already connecting or in cooldown
    if (connectionManager.current.isConnecting) {
      logWithTimestamp("Connection attempt already in progress, skipping redundant attempt");
      return () => {};
    }
    
    if (connectionManager.current.isInCooldown) {
      const remainingCooldown = Math.ceil((connectionManager.current.cooldownUntil - Date.now()) / 1000);
      logWithTimestamp(`In cooldown period, ${remainingCooldown}s remaining before next attempt`);
      return () => {};
    }
    
    // Check for duplicate connection from this same session/player
    const connectionKey = `${sessionId}:${playerCode}`;
    if (activeConnections.has(connectionKey) && activeConnections.get(connectionKey) !== instanceId.current) {
      logWithTimestamp(`Another active connection exists for ${connectionKey}, skipping`);
      return () => {};
    }
    
    try {
      connectionManager.current.startConnection();
      setConnectionState('connecting');
      
      // Register this instance as the active connection
      activeConnections.set(connectionKey, instanceId.current);
      
      // Cleanup any existing channel first
      if (channelRef.current) {
        logWithTimestamp(`Cleaning up existing channel before reconnect`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Create a unique channel name for this session
      const channelName = `game-updates-${sessionId}`;
      logWithTimestamp(`Creating realtime channel: ${channelName}`);
      
      // Create the channel
      const channel = supabase.channel(channelName);
      
      // CRITICAL: First subscribe to the channel
      channel.subscribe((status) => {
        logWithTimestamp(`Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // Only after subscription is confirmed, try to use presence
          if (playerCode) {
            // Now it's safe to track presence
            channel.track({
              playerCode,
              playerName: playerName || playerCode,
              online_at: new Date().toISOString(),
              client_type: 'player'
            }).then(() => {
              logWithTimestamp('Player presence tracked successfully');
            }).catch(err => {
              logWithTimestamp(`Error tracking presence: ${err.message}`);
            });
          }
          
          setIsConnected(true);
          setConnectionState('connected');
          setConnectionError(null);
          connectionManager.current.endConnection(true);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('error');
          setConnectionError('Channel error connecting to game server');
          connectionManager.current.endConnection(false);
          
          // Schedule reconnect with backoff through manager
          connectionManager.current.scheduleReconnect(reconnect);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionState('disconnected');
          connectionManager.current.endConnection(false);
          
          // Schedule reconnect with backoff through manager
          connectionManager.current.scheduleReconnect(reconnect);
        }
      });
      
      // Set up presence handlers for synchronized state
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          logWithTimestamp(`Presence sync: ${JSON.stringify(state)}`);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          logWithTimestamp(`Presence join: ${key}, ${JSON.stringify(newPresences)}`);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          logWithTimestamp(`Presence leave: ${key}, ${JSON.stringify(leftPresences)}`);
        });
        
      // Set up broadcast handlers for game events
      channel
        .on('broadcast', { event: 'game-update' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
            
            // Update game state based on payload
            setGameState(prevState => ({
              ...prevState,
              gameStatus: payload.payload.gameStatus || prevState.gameStatus,
              currentWinPattern: payload.payload.currentWinPattern || prevState.currentWinPattern,
              currentPrize: payload.payload.currentPrize || prevState.currentPrize,
              currentPrizeDescription: payload.payload.currentPrizeDescription || prevState.currentPrizeDescription,
            }));
          }
        })
        .on('broadcast', { event: 'number-called' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            logWithTimestamp(`Received number: ${payload.payload.lastCalledNumber}`);
            
            // Update called numbers
            setGameState(prevState => ({
              ...prevState,
              lastCalledNumber: payload.payload.lastCalledNumber,
              calledNumbers: payload.payload.calledNumbers || prevState.calledNumbers,
            }));
          }
        })
        .on('broadcast', { event: 'pattern-change' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            logWithTimestamp(`Received pattern change: ${payload.payload.pattern}`);
            
            // Update win pattern
            setGameState(prevState => ({
              ...prevState,
              currentWinPattern: payload.payload.pattern,
            }));
          }
        })
        .on('broadcast', { event: 'claim-result' }, (payload) => {
          if (payload.payload && payload.payload.playerId === playerCode) {
            logWithTimestamp(`Received claim result: ${payload.payload.result}`);
          }
        });
      
      // Store the channel reference
      channelRef.current = channel;
      
      return () => {
        logWithTimestamp(`Cleaning up channel: ${channelName}`);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        
        // Remove from active connections registry
        activeConnections.delete(connectionKey);
      };
    } catch (error) {
      logWithTimestamp(`Error setting up realtime channel: ${error}`);
      setConnectionState('error');
      setConnectionError(`Failed to connect: ${error}`);
      connectionManager.current.endConnection(false);
      
      // Remove from active connections registry on error
      activeConnections.delete(connectionKey);
      
      return () => {};
    }
  }, [sessionId, playerCode, playerName]);
  
  // Reconnect function for manual reconnection
  const reconnect = useCallback(() => {
    // Reset connection manager state
    connectionManager.current.forceReconnect();
    
    setConnectionState('connecting');
    subscribeToChannel();
  }, [subscribeToChannel]);
  
  // Setup channel on mount and cleanup on unmount
  useEffect(() => {
    if (sessionId && playerCode) {
      setConnectionState('connecting');
      const cleanup = subscribeToChannel();
      
      return () => {
        logWithTimestamp(`Cleaning up player connection for ${playerCode} from session ${sessionId}`);
        
        // Remove from active connections registry
        const connectionKey = `${sessionId}:${playerCode}`;
        activeConnections.delete(connectionKey);
        
        // Clean up the connection
        cleanup();
        
        // Reset connection manager
        connectionManager.current.reset();
      };
    }
    
    return () => {};
  }, [sessionId, playerCode, subscribeToChannel]);
  
  // Claim bingo function
  const claimBingo = useCallback((ticket: any) => {
    if (!channelRef.current || !isConnected || !playerCode) {
      logWithTimestamp("Cannot claim bingo: not connected");
      return false;
    }
    
    try {
      logWithTimestamp(`Sending bingo claim for player: ${playerCode}`);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'bingo_claimed',
        payload: {
          playerCode,
          playerName: playerName || playerCode,
          ticketData: ticket,
          timestamp: Date.now()
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error claiming bingo: ${error}`);
      return false;
    }
  }, [isConnected, playerCode, playerName]);
  
  return {
    isConnected,
    connectionState,
    connectionError,
    gameState,
    reconnect,
    claimBingo
  };
}
