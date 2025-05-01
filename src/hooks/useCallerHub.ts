import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 10:20 - ${message}`);
};

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
  const channelRefs = useRef<{ [key: string]: any }>({});

  // Set up the caller as the central hub using Supabase Realtime
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp("No sessionId provided to useCallerHub");
      setConnectionState('disconnected');
      return;
    }
    
    logWithTimestamp(`Setting up caller hub for session: ${sessionId} using Realtime channels`);
    setConnectionState('connecting');
    
    try {
      // Channel for player joins and game updates
      const gameChannel = supabase.channel(`game-updates-${sessionId}`);
      gameChannel
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
            }).then(() => {
              logWithTimestamp(`Sent join acknowledgment to player: ${playerCode}`);
            }).catch(err => {
              console.error("Error sending join acknowledgment:", err);
            });
            
            toast({
              title: "Player Joined",
              description: `${playerName || playerCode} has joined the game`,
              duration: 3000
            });
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Game updates channel status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setConnectionState('connected');
            setConnectionError(null);
            
            toast({
              title: "Connection Established",
              description: "Successfully connected to the realtime server.",
              duration: 3000
            });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionState('error');
            setConnectionError("Error connecting to realtime server");
          }
        });
      
      // Channel for bingo claims
      const claimChannel = supabase.channel('bingo-claims');
      claimChannel
        .on('broadcast', { event: 'bingo-claim' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { playerCode, playerName, ticketData, timestamp } = payload.payload;
            
            logWithTimestamp(`Bingo claimed by ${playerName || playerCode}`);
            
            setPendingClaims(prev => [
              ...prev,
              {
                playerCode,
                playerName: playerName || playerCode,
                claimedAt: timestamp,
                ticketData
              }
            ]);
            
            toast({
              title: "Bingo Claimed!",
              description: `${playerName || playerCode} has claimed a bingo`,
              duration: 5000
            });
          }
        })
        .subscribe();
      
      channelRefs.current = {
        gameChannel,
        claimChannel
      };
      
      return () => {
        // Cleanup function
        logWithTimestamp("Cleaning up caller realtime connections");
        
        Object.values(channelRefs.current).forEach((channel) => {
          if (channel) {
            supabase.removeChannel(channel);
          }
        });
      };
    } catch (err) {
      console.error("Error setting up realtime channels:", err);
      setConnectionState('error');
      setConnectionError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sessionId, toast]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp("Manual reconnection attempt");
    
    // Clean up existing channels
    Object.values(channelRefs.current).forEach((channel) => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    
    // Reset connection state to trigger reconnection in useEffect
    setConnectionState('disconnected');
  }, []);

  // Function to broadcast game updates to all connected players
  const broadcastGameUpdate = useCallback((updateData: any) => {
    if (!sessionId || !channelRefs.current.gameChannel) {
      logWithTimestamp("Cannot broadcast: missing sessionId or channel");
      return false;
    }
    
    try {
      logWithTimestamp(`Broadcasting game update: ${JSON.stringify(updateData)}`);
      
      channelRefs.current.gameChannel.send({
        type: 'broadcast',
        event: 'game-update',
        payload: {
          ...updateData,
          timestamp: Date.now()
        }
      }).then(() => {
        logWithTimestamp("Game update broadcast successful");
      }).catch(err => {
        console.error("Error broadcasting game update:", err);
      });
      
      return true;
    } catch (err) {
      console.error("Error sending broadcast:", err);
      return false;
    }
  }, [sessionId]);

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
          setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
          logWithTimestamp(`Sent claim result via realtime: ${playerCode} - ${result}`);
          
          // Clean up temporary channel
          supabase.removeChannel(channel);
        })
        .catch(err => {
          console.error("Error sending claim result:", err);
        });
      
      return true;
    } catch (err) {
      console.error("Error with claim response:", err);
      return false;
    }
  }, [sessionId]);
  
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
