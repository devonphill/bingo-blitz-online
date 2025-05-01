import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRealTimeUpdates } from './useRealTimeUpdates';

interface GameState {
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
  gameStatus: string | null;
}

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 10:20 - ${message}`);
};

export function useBingoSync(sessionId?: string, playerCode?: string, playerName?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null,
    currentPrize: null,
    currentPrizeDescription: null,
    gameStatus: null
  });
  
  // Use Supabase realtime updates exclusively now
  const realtimeUpdates = useRealTimeUpdates(sessionId, playerCode);
  const { toast } = useToast();
  const instanceId = useRef(Date.now()); // Unique instance identifier

  // Set up subscription to realtime updates - now our primary method
  useEffect(() => {
    if (!sessionId || !playerCode) {
      logWithTimestamp("Missing sessionId or playerCode for realtime subscription");
      return;
    }
    
    logWithTimestamp(`Setting up realtime channel subscription for player: ${playerCode} in session: ${sessionId}`);
    setConnectionState('connecting');
    
    try {
      // Set up main channel for game state updates
      const gameChannel = supabase.channel(`game-updates-${sessionId}`);
      gameChannel
        .on('broadcast', { event: 'game-update' }, (payload) => {
          logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
          
          if (payload.payload) {
            const { lastCalledNumber, calledNumbers, currentWinPattern, currentPrize, currentPrizeDescription, gameStatus } = payload.payload;
            
            setGameState(prev => ({
              ...prev,
              lastCalledNumber: lastCalledNumber ?? prev.lastCalledNumber,
              calledNumbers: calledNumbers ?? prev.calledNumbers,
              currentWinPattern: currentWinPattern ?? prev.currentWinPattern,
              currentPrize: currentPrize ?? prev.currentPrize,
              currentPrizeDescription: currentPrizeDescription ?? prev.currentPrizeDescription,
              gameStatus: gameStatus ?? prev.gameStatus
            }));
            
            // Show toast for new number if it changed
            if (lastCalledNumber && lastCalledNumber !== gameState.lastCalledNumber) {
              toast({
                title: "Number Called",
                description: `Number ${lastCalledNumber} has been called`,
                duration: 3000
              });
            }
            
            // Show toast for pattern change
            if (currentWinPattern && currentWinPattern !== gameState.currentWinPattern) {
              toast({
                title: "Win Pattern Changed",
                description: `New win pattern: ${currentWinPattern}`,
                duration: 3000
              });
            }
          }
        })
        .on('broadcast', { event: 'player-join-ack' }, (payload) => {
          if (payload.payload?.playerCode === playerCode) {
            logWithTimestamp("Join acknowledged by caller");
            setConnectionState('connected');
            setIsConnected(true);
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Realtime subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            // Send join message to caller
            gameChannel.send({
              type: 'broadcast',
              event: 'player-join',
              payload: {
                sessionId,
                playerCode,
                playerName,
                timestamp: Date.now(),
                instanceId: instanceId.current
              }
            }).then(() => {
              logWithTimestamp("Sent player join message via realtime");
            }).catch(err => {
              console.error("Error sending join message:", err);
            });
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionState('error');
            setConnectionError("Error connecting to game channel");
          } else if (status === 'TIMED_OUT') {
            setConnectionState('error');
            setConnectionError("Connection timed out");
          }
        });
      
      // Set up player-specific channel for claim responses
      const claimChannel = supabase.channel(`player-claims-${instanceId.current}`);
      claimChannel
        .on('broadcast', { event: 'claim-result' }, (payload) => {
          if (payload.payload?.playerId === playerCode) {
            const result = payload.payload.result;
            
            if (result === 'valid') {
              toast({
                title: "Bingo Verified!",
                description: "Your bingo has been verified",
                duration: 5000
              });
            } else if (result === 'rejected') {
              toast({
                title: "Bingo Rejected",
                description: "Your bingo claim was not valid",
                variant: "destructive",
                duration: 5000
              });
            }
          }
        })
        .subscribe();
      
      // Cleanup function
      return () => {
        logWithTimestamp("Cleaning up realtime subscriptions");
        supabase.removeChannel(gameChannel);
        supabase.removeChannel(claimChannel);
      };
    } catch (err) {
      console.error("Error setting up realtime channels:", err);
      setConnectionState('error');
      setConnectionError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sessionId, playerCode, playerName, toast, gameState.lastCalledNumber, gameState.currentWinPattern]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp("Manual reconnection attempt");
    setConnectionState('disconnected');
    // Reconnection will be triggered by the useEffect above
  }, []);

  // Function to claim bingo
  const claimBingo = useCallback((ticketData?: any) => {
    if (!sessionId || !playerCode) {
      toast({
        title: "Cannot Claim",
        description: "Missing session or player information",
        variant: "destructive",
        duration: 3000
      });
      return false;
    }
    
    try {
      const channel = supabase.channel('bingo-claims');
      channel
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            sessionId,
            playerCode,
            playerName,
            ticketData,
            timestamp: Date.now(),
            instanceId: instanceId.current
          }
        })
        .then(() => {
          logWithTimestamp("Sent bingo claim via realtime broadcast");
          
          toast({
            title: "Bingo Claimed",
            description: "Your claim has been submitted",
            duration: 3000
          });
          
          // Clean up channel after use
          supabase.removeChannel(channel);
        })
        .catch(err => {
          console.error("Error claiming bingo via realtime broadcast:", err);
          toast({
            title: "Claim Error",
            description: "Failed to submit your claim",
            variant: "destructive",
            duration: 3000
          });
        });
        
      return true;
    } catch (err) {
      console.error("Error setting up realtime claim:", err);
      return false;
    }
  }, [sessionId, playerCode, playerName, toast]);

  // Use combined state from realtime updates
  const effectiveGameState = {
    lastCalledNumber: realtimeUpdates.lastCalledNumber ?? gameState.lastCalledNumber,
    calledNumbers: realtimeUpdates.calledNumbers.length > 0 
      ? realtimeUpdates.calledNumbers 
      : gameState.calledNumbers,
    currentWinPattern: realtimeUpdates.currentWinPattern || gameState.currentWinPattern,
    currentPrize: gameState.currentPrize,
    currentPrizeDescription: gameState.currentPrizeDescription,
    gameStatus: gameState.gameStatus
  };

  return {
    isConnected: isConnected || realtimeUpdates.connectionStatus === 'connected',
    connectionState: isConnected ? connectionState : realtimeUpdates.connectionStatus,
    connectionError,
    gameState: effectiveGameState,
    reconnect,
    claimBingo
  };
}
