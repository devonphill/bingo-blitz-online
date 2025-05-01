
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

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
  console.log(`[${timestamp}] - CHANGED 09:39 - ${message}`);
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
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 50;
  const connectionTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Function to create WebSocket connection
  const createWebSocketConnection = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp("No sessionId provided to useBingoSync");
      setConnectionState('disconnected');
      return;
    }

    // Clear any existing connection
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close(1000, "Normal closure, reconnecting");
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
      const projectRef = "weqosgnuiixccghdoccw";
      let wsUrl = `wss://${projectRef}.supabase.co/functions/v1/bingo-hub?type=player&sessionId=${sessionId}`;
      
      // Add player details if available
      if (playerCode) {
        wsUrl += `&playerCode=${encodeURIComponent(playerCode)}`;
      }
      if (playerName) {
        wsUrl += `&playerName=${encodeURIComponent(playerName)}`;
      }
      
      logWithTimestamp(`Connecting to WebSocket URL: ${wsUrl}`);
      
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Set a connection timeout
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          logWithTimestamp("WebSocket connection timeout");
          socket.close(4000, "Connection timeout");
          setConnectionState('error');
          setConnectionError("Connection timeout. Please try again.");
          
          // Try to reconnect
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(1.3, Math.min(reconnectAttemptsRef.current, 10)), 8000);
            logWithTimestamp(`Will try to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectAttemptsRef.current++;
              createWebSocketConnection();
            }, delay);
          } else {
            logWithTimestamp("Maximum reconnection attempts reached");
            setConnectionError("Maximum reconnection attempts reached. Please reload the page.");
          }
        }
      }, 12000); 
      
      socket.onopen = () => {
        logWithTimestamp("Player WebSocket connection established");
        clearTimeout(connectionTimeoutRef.current!);
        connectionTimeoutRef.current = null;
        setIsConnected(true);
        setConnectionState('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        
        // Set up ping interval
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
        }, 20000); 
        
        // Send join message
        try {
          socket.send(JSON.stringify({
            type: "join",
            sessionId,
            playerCode,
            playerName
          }));
          logWithTimestamp(`Sent join message for player ${playerCode}`);
        } catch (err) {
          console.error("Error sending join message:", err);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          logWithTimestamp(`Received message from server: ${message.type}`);
          
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
              logWithTimestamp("Received pong from server");
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
              logWithTimestamp(`Received unknown message type: ${message.type}, ${JSON.stringify(message)}`);
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
        
        // Try to reconnect if it wasn't a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(1.3, Math.min(reconnectAttemptsRef.current, 10)), 8000);
          logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimerRef.current = window.setTimeout(() => {
            logWithTimestamp("Attempting to reconnect WebSocket...");
            createWebSocketConnection();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logWithTimestamp("Maximum reconnection attempts reached. Giving up.");
          setConnectionState('error');
          setConnectionError(`Could not establish a connection to the game server after multiple attempts.`);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        logWithTimestamp(`WebSocket error occurred: ${JSON.stringify(error)}`);
        setIsConnected(false);
        setConnectionState('error');
        setConnectionError("Error connecting to the game server.");
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      logWithTimestamp(`Error creating WebSocket: ${err.message}`);
      setConnectionState('error');
      setConnectionError(`Error creating WebSocket: ${err.message}`);
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(1.3, Math.min(reconnectAttemptsRef.current, 10)), 8000);
        reconnectTimerRef.current = window.setTimeout(() => {
          createWebSocketConnection();
        }, delay);
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
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, "Component unmounted");
      }
      socketRef.current = null;
    };
  }, [sessionId, playerCode, playerName, createWebSocketConnection]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    logWithTimestamp("Manual reconnection attempt");
    reconnectAttemptsRef.current = 0;
    createWebSocketConnection();
  }, [createWebSocketConnection]);

  // Function to claim bingo
  const claimBingo = useCallback((ticketData?: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "claim",
          sessionId,
          data: {
            ticketData,
            timestamp: Date.now()
          }
        }));
        logWithTimestamp("Sent bingo claim");
        
        // Show toast for claim sent
        toast({
          title: "Bingo Claimed",
          description: "Your claim has been submitted",
          duration: 3000
        });
        
        return true;
      } catch (err) {
        console.error("Error claiming bingo:", err);
        return false;
      }
    }
    return false;
  }, [sessionId, toast]);

  return {
    isConnected,
    connectionState,
    connectionError,
    gameState,
    reconnect,
    claimBingo
  };
}
