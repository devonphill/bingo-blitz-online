
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
  console.log(`[${timestamp}] - CHANGED 09:52 - ${message}`);
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
  
  // Use Supabase realtime updates as fallback
  const realtimeUpdates = useRealTimeUpdates(sessionId, playerCode);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3; // Reduce attempts to fail faster to fallback
  const connectionTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const instanceId = useRef(Date.now()); // Unique instance identifier

  // Function to create WebSocket connection with direct URL
  const createWebSocketConnection = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp("No sessionId provided to useBingoSync");
      setConnectionState('disconnected');
      return;
    }

    // Clear any existing connection
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close(1000, "Normal closure, reconnecting");
      }
      socketRef.current = null;
    }
    
    // Clear any existing connection timeout
    if (connectionTimeoutRef.current !== null) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    logWithTimestamp(`Setting up player WebSocket connection for session: ${sessionId}, player: ${playerCode || 'anonymous'} (attempt ${reconnectAttemptsRef.current + 1})`);
    setConnectionState('connecting');
    setConnectionError(null);

    try {
      // Use direct connection to Supabase Edge Function
      const wsUrl = `wss://weqosgnuiixccghdoccw.supabase.co/functions/v1/bingo-hub?type=player&sessionId=${sessionId}${playerCode ? `&playerCode=${encodeURIComponent(playerCode)}` : ''}${playerName ? `&playerName=${encodeURIComponent(playerName)}` : ''}&instanceId=${instanceId.current}`;
      
      logWithTimestamp(`Connecting to WebSocket URL: ${wsUrl}`);
      
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Set a short connection timeout (5 seconds)
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          logWithTimestamp("WebSocket connection timeout - switching to fallback");
          if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
            socket.close(4000, "Connection timeout");
          }
          setConnectionState('error');
          setConnectionError("Switching to realtime updates...");
          
          // Only try to reconnect if under max attempts
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            reconnectTimerRef.current = window.setTimeout(() => {
              createWebSocketConnection();
            }, 2000);
          } else {
            logWithTimestamp("Maximum reconnection attempts reached, using realtime fallback");
            setConnectionError("Using realtime updates fallback mechanism");
          }
        }
      }, 5000);
      
      socket.onopen = () => {
        logWithTimestamp("Player WebSocket connection established");
        if (connectionTimeoutRef.current !== null) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setConnectionState('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        
        // Set up ping interval - shorter interval (10s)
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({
                type: "ping",
                sessionId
              }));
              logWithTimestamp("Sent ping to server");
            } catch (err) {
              console.error("Error sending ping:", err);
            }
          }
        }, 10000);
        
        // Send join message
        try {
          socket.send(JSON.stringify({
            type: "join",
            sessionId,
            playerCode,
            playerName,
            instanceId: instanceId.current
          }));
          logWithTimestamp(`Sent join message for player ${playerCode}`);
        } catch (err) {
          console.error("Error sending join message:", err);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          switch (message.type) {
            case "connected":
              logWithTimestamp(`Player WebSocket connection confirmed: ${JSON.stringify(message.data)}`);
              break;
              
            case "join_acknowledged":
              logWithTimestamp(`Join acknowledged: ${JSON.stringify(message.data)}`);
              break;
              
            case "game_state":
              logWithTimestamp(`Received game state: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setGameState({
                  lastCalledNumber: message.data.lastCalledNumber,
                  calledNumbers: message.data.calledNumbers || [],
                  currentWinPattern: message.data.currentWinPattern,
                  currentPrize: message.data.currentPrize,
                  currentPrizeDescription: message.data.currentPrizeDescription,
                  gameStatus: message.data.gameStatus
                });
              }
              break;
              
            case "number_called":
              logWithTimestamp(`Number called: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setGameState(prev => ({
                  ...prev,
                  lastCalledNumber: message.data.lastCalledNumber,
                  calledNumbers: message.data.calledNumbers || prev.calledNumbers
                }));
                
                // Show toast for new number
                if (message.data.lastCalledNumber !== null) {
                  toast({
                    title: "Number Called",
                    description: `Number ${message.data.lastCalledNumber} has been called`,
                    duration: 3000
                  });
                }
              }
              break;
              
            case "pattern_changed":
              logWithTimestamp(`Pattern changed: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setGameState(prev => ({
                  ...prev,
                  currentWinPattern: message.data.currentWinPattern,
                  currentPrize: message.data.currentPrize,
                  currentPrizeDescription: message.data.currentPrizeDescription
                }));
                
                // Show toast for pattern change
                toast({
                  title: "Win Pattern Changed",
                  description: `New win pattern: ${message.data.currentWinPattern}`,
                  duration: 3000
                });
              }
              break;
              
            case "game_started":
              logWithTimestamp(`Game started: ${JSON.stringify(message.data)}`);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'active'
              }));
              
              // Show toast for game start
              toast({
                title: "Game Started",
                description: "The game has started",
                duration: 3000
              });
              break;
              
            case "game_ended":
              logWithTimestamp(`Game ended: ${JSON.stringify(message.data)}`);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'completed'
              }));
              
              // Show toast for game end
              toast({
                title: "Game Ended",
                description: "The current game has ended",
                duration: 3000
              });
              break;
              
            case "next_game":
              logWithTimestamp(`Next game: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setGameState({
                  lastCalledNumber: null,
                  calledNumbers: [],
                  currentWinPattern: null,
                  currentPrize: null,
                  currentPrizeDescription: null,
                  gameStatus: 'active'
                });
                
                // Show toast for next game
                toast({
                  title: "Next Game",
                  description: `Game ${message.data.gameNumber} is starting`,
                  duration: 3000
                });
              }
              break;
              
            case "claim_result":
              logWithTimestamp(`Claim result: ${JSON.stringify(message.data)}`);
              if (message.data?.result === 'valid') {
                toast({
                  title: "Bingo Verified!",
                  description: "Your bingo has been verified",
                  duration: 5000
                });
              } else if (message.data?.result === 'rejected') {
                toast({
                  title: "Bingo Rejected",
                  description: "Your bingo claim was not valid",
                  variant: "destructive",
                  duration: 5000
                });
              }
              break;
              
            case "pong":
              // Just update connection status
              setIsConnected(true);
              break;
              
            case "error":
              console.error("Error from server:", message.data);
              toast({
                title: "Server Error",
                description: message.data.message || "Unknown error occurred",
                variant: "destructive",
                duration: 5000
              });
              break;
              
            default:
              logWithTimestamp(`Unknown message type: ${message.type}`);
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };
      
      socket.onclose = (event) => {
        logWithTimestamp(`Player WebSocket connection closed: ${event.code}, ${event.reason}`);
        if (connectionTimeoutRef.current !== null) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Clear ping interval
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Try to reconnect if not a clean closure and under max attempts
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = 2000;
          logWithTimestamp(`Will attempt to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimerRef.current = window.setTimeout(() => {
            createWebSocketConnection();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logWithTimestamp("Maximum reconnection attempts reached, using realtime fallback");
          setConnectionState('error');
          setConnectionError(`Using realtime updates as fallback mechanism`);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        logWithTimestamp(`WebSocket error occurred: ${JSON.stringify(error)}`);
        setIsConnected(false);
        setConnectionState('error');
        setConnectionError("Error connecting to game server, falling back to realtime updates");
      };
    } catch (err: any) {
      console.error("Error creating WebSocket:", err);
      logWithTimestamp(`Error creating WebSocket: ${err.message}`);
      setConnectionState('error');
      setConnectionError(`Error: ${err.message}`);
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = 2000;
        reconnectTimerRef.current = window.setTimeout(() => {
          createWebSocketConnection();
        }, delay);
      } else {
        logWithTimestamp("Maximum reconnection attempts reached, using realtime fallback");
        setConnectionError("Using realtime updates as fallback mechanism");
      }
    }
  }, [sessionId, playerCode, playerName, toast]);

  // Set up connection when sessionId/playerCode changes
  useEffect(() => {
    if (sessionId) {
      reconnectAttemptsRef.current = 0;
      createWebSocketConnection();
    }

    // Cleanup function
    return () => {
      logWithTimestamp("Cleaning up player WebSocket connection");
      
      // Clear intervals and timers
      if (pingIntervalRef.current !== null) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      if (connectionTimeoutRef.current !== null) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      // Close socket
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
          socketRef.current.close(1000, "Component unmounted");
        }
        socketRef.current = null;
      }
    };
  }, [sessionId, playerCode, playerName, createWebSocketConnection]);

  // Merge data from WebSocket and realtime updates
  useEffect(() => {
    if (!isConnected && connectionState === 'error') {
      // Update game state with realtime data when WebSocket is not working
      if (realtimeUpdates.calledNumbers.length > 0) {
        setGameState(prev => ({
          ...prev,
          calledNumbers: realtimeUpdates.calledNumbers,
          lastCalledNumber: realtimeUpdates.lastCalledNumber
        }));
      }
      
      if (realtimeUpdates.currentWinPattern) {
        setGameState(prev => ({
          ...prev,
          currentWinPattern: realtimeUpdates.currentWinPattern,
          currentPrize: realtimeUpdates.prizeInfo?.currentPrize || prev.currentPrize,
          currentPrizeDescription: realtimeUpdates.prizeInfo?.currentPrizeDescription || prev.currentPrizeDescription
        }));
      }
    }
  }, [isConnected, connectionState, realtimeUpdates]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp("Manual reconnection attempt");
    reconnectAttemptsRef.current = 0;
    createWebSocketConnection();
  }, [createWebSocketConnection]);

  // Function to claim bingo - with fallback
  const claimBingo = useCallback((ticketData?: any) => {
    // First try WebSocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "claim",
          sessionId,
          data: {
            ticketData,
            timestamp: Date.now(),
            instanceId: instanceId.current
          }
        }));
        logWithTimestamp("Sent bingo claim via WebSocket");
        
        toast({
          title: "Bingo Claimed",
          description: "Your claim has been submitted",
          duration: 3000
        });
        
        return true;
      } catch (err) {
        console.error("Error claiming bingo via WebSocket:", err);
        // Continue to fallback mechanism
      }
    }
    
    // Fallback: Use Supabase realtime broadcast
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
            description: "Your claim has been submitted via backup channel",
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

  // Use combined state that merges WebSocket and realtime data
  const effectiveGameState = isConnected 
    ? gameState 
    : {
        ...gameState,
        lastCalledNumber: realtimeUpdates.lastCalledNumber ?? gameState.lastCalledNumber,
        calledNumbers: realtimeUpdates.calledNumbers.length > 0 
          ? realtimeUpdates.calledNumbers 
          : gameState.calledNumbers,
        currentWinPattern: realtimeUpdates.currentWinPattern || gameState.currentWinPattern
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
