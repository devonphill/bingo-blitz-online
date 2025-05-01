
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameType } from '@/types';
import { logWithTimestamp } from '@/utils/logUtils';

export interface GameState {
  gameStatus: string;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
}

// Only export if this file already exists, otherwise create it
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
  
  // CRITICAL FIX: Function to properly subscribe to a channel before using presence
  const subscribeToChannel = useCallback(() => {
    if (!sessionId) return;
    
    try {
      // Cleanup any existing channel first
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
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
        });
      
      // Store the channel reference
      channelRef.current = channel;
      
      return () => {
        logWithTimestamp(`Cleaning up channel: ${channelName}`);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
      };
    } catch (error) {
      logWithTimestamp(`Error setting up realtime channel: ${error}`);
      setConnectionState('error');
      setConnectionError(`Failed to connect: ${error}`);
      return () => {};
    }
  }, [sessionId, playerCode, playerName]);
  
  // Setup channel on mount
  useEffect(() => {
    if (sessionId && playerCode) {
      setConnectionState('connecting');
      const cleanup = subscribeToChannel();
      return cleanup;
    }
  }, [sessionId, playerCode, subscribeToChannel]);
  
  // Reconnect function for manual reconnection
  const reconnect = useCallback(() => {
    setConnectionState('connecting');
    subscribeToChannel();
  }, [subscribeToChannel]);
  
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
