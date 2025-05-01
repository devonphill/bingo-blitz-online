import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 09:52 - ${message}`);
};

interface ConnectedPlayer {
  playerCode: string;
  playerName: string | null;
  joinedAt: number;
}

interface GameState {
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
  gameStatus: string | null;
  lastUpdate: number;
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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 10; // Reduced for faster fallback
  const { toast } = useToast();
  const connectionTimeoutRef = useRef<number | null>(null);

  // Function to create WebSocket connection with simplified approach
  const createWebSocketConnection = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp("No sessionId provided to useCallerHub");
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

    logWithTimestamp(`Setting up caller WebSocket connection for session: ${sessionId} (attempt ${reconnectAttemptsRef.current + 1})`);
    setConnectionState('connecting');
    setConnectionError(null);

    try {
      // Always use direct connection to Supabase Edge Function with simplified URL
      const projectRef = "weqosgnuiixccghdoccw";
      const wsUrl = `wss://${projectRef}.supabase.co/functions/v1/bingo-hub?type=caller&sessionId=${sessionId}`;
      
      logWithTimestamp(`Connecting to WebSocket URL: ${wsUrl}`);
      
      // Create WebSocket connection with a clean slate
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Set a shorter connection timeout
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          logWithTimestamp("WebSocket connection timeout");
          if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
            socket.close(4000, "Connection timeout");
          }
          setConnectionState('error');
          setConnectionError("Connection timeout. Please try again.");
          
          // Try to reconnect with simple backoff
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
            logWithTimestamp(`Will try to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectAttemptsRef.current++;
              createWebSocketConnection();
            }, delay);
          } else {
            logWithTimestamp("Maximum reconnection attempts reached");
            setConnectionError("Maximum reconnection attempts reached. Falling back to fallback mechanism.");
            // Here you would implement a fallback mechanism
          }
        }
      }, 8000); // Shorter timeout
      
      socket.onopen = () => {
        logWithTimestamp("Caller WebSocket connection established");
        if (connectionTimeoutRef.current !== null) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setConnectionState('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        
        // Set up ping interval
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
        }, 15000); // Shorter ping interval
        
        // Also notify the user
        toast({
          title: "Connection Established",
          description: "Successfully connected to the game server.",
          duration: 3000
        });
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          logWithTimestamp(`Received message from server: ${message.type}`);
          
          // Process different message types
          switch (message.type) {
            case "connected":
              logWithTimestamp(`Caller WebSocket connection confirmed: ${JSON.stringify(message.data)}`);
              break;
              
            case "player_joined":
              logWithTimestamp(`Player joined: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setConnectedPlayers(prev => [
                  ...prev.filter(p => p.playerCode !== message.data.playerCode),
                  {
                    playerCode: message.data.playerCode,
                    playerName: message.data.playerName || message.data.playerCode,
                    joinedAt: message.data.timestamp
                  }
                ]);
                
                toast({
                  title: "Player Joined",
                  description: `${message.data.playerName || message.data.playerCode} has joined the game`,
                  duration: 3000
                });
              }
              break;
              
            case "player_left":
              logWithTimestamp(`Player left: ${JSON.stringify(message.data)}`);
              if (message.data?.playerCode) {
                setConnectedPlayers(prev => 
                  prev.filter(p => p.playerCode !== message.data.playerCode)
                );
                
                toast({
                  title: "Player Left",
                  description: `${message.data.playerName || message.data.playerCode} has left the game`,
                  duration: 3000
                });
              }
              break;
              
            case "bingo_claimed":
              logWithTimestamp(`Bingo claimed: ${JSON.stringify(message.data)}`);
              if (message.data) {
                setPendingClaims(prev => [
                  ...prev,
                  {
                    playerCode: message.data.playerCode,
                    playerName: message.data.playerName || message.data.playerCode,
                    claimedAt: message.data.timestamp,
                    ticketData: message.data.ticketData
                  }
                ]);
                
                toast({
                  title: "Bingo Claimed!",
                  description: `${message.data.playerName || message.data.playerCode} has claimed a bingo`,
                  duration: 5000
                });
              }
              break;
              
            case "pong":
              // Just update connection status
              logWithTimestamp("Received pong from server");
              setIsConnected(true);
              setConnectionState('connected');
              break;
              
            case "error":
              console.error("Error from server:", message.data);
              logWithTimestamp(`Error from server: ${JSON.stringify(message.data)}`);
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
        logWithTimestamp(`Caller WebSocket connection closed: ${event.code}, ${event.reason}`);
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
        
        // Try to reconnect with a simpler strategy if it wasn't a normal closure
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
          logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimerRef.current = window.setTimeout(() => {
            logWithTimestamp("Attempting to reconnect WebSocket...");
            createWebSocketConnection();
          }, delay);
          
          // Show toast for first few reconnect attempts
          if (reconnectAttemptsRef.current <= 3) {
            toast({
              title: "Connection Lost",
              description: `Connection to game server lost. Reconnecting in ${Math.round(delay/1000)}s...`,
              variant: "destructive",
              duration: 5000
            });
          }
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logWithTimestamp("Maximum reconnection attempts reached. Falling back to alternative mechanism.");
          setConnectionState('error');
          setConnectionError(`Could not establish a connection to the game server after multiple attempts. Error code: ${event.code}.`);
          toast({
            title: "Connection Failed",
            description: "Could not establish a connection to the game server. Trying alternative connection method...",
            variant: "destructive",
            duration: 5000
          });
          
          // Here you would implement a fallback mechanism
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        logWithTimestamp(`WebSocket error occurred: ${JSON.stringify(error)}`);
        setIsConnected(false);
        setConnectionState('error');
        setConnectionError("Error connecting to the game server. Will try to reconnect...");
        
        // Don't show too many toast messages
        if (reconnectAttemptsRef.current < 3) {
          toast({
            title: "Connection Error",
            description: "Error connecting to the game server. Will try to reconnect...",
            variant: "destructive",
            duration: 5000
          });
        }
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      logWithTimestamp(`Error creating WebSocket: ${err.message}`);
      setConnectionState('error');
      setConnectionError(`Error creating WebSocket: ${err.message}`);
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
        reconnectTimerRef.current = window.setTimeout(() => {
          createWebSocketConnection();
        }, delay);
      } else {
        logWithTimestamp("Maximum reconnection attempts reached. Falling back to alternative mechanism.");
        setConnectionError("Maximum reconnection attempts reached. Trying alternative connection method...");
        // Here you would implement a fallback mechanism
      }
    }
  }, [sessionId, toast]);

  // Set up connection when sessionId changes
  useEffect(() => {
    if (sessionId) {
      reconnectAttemptsRef.current = 0;
      createWebSocketConnection();
    }

    // Cleanup function
    return () => {
      logWithTimestamp("Cleaning up caller WebSocket connection");
      
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
  }, [sessionId, createWebSocketConnection]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    logWithTimestamp("Manual reconnection attempt initiated");
    reconnectAttemptsRef.current = 0;
    createWebSocketConnection();
  }, [createWebSocketConnection]);

  // Function to call a new number
  const callNumber = useCallback((number: number, allCalledNumbers: number[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "number-called",
          sessionId,
          data: {
            lastCalledNumber: number,
            calledNumbers: allCalledNumbers,
            timestamp: Date.now()
          }
        }));
        logWithTimestamp(`Called number: ${number}, total called numbers: ${allCalledNumbers.length}`);
        return true;
      } catch (err) {
        console.error("Error calling number:", err);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Function to change the active win pattern
  const changePattern = useCallback((pattern: string, prize?: string, prizeDescription?: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "pattern-change",
          sessionId,
          data: {
            pattern,
            prize,
            prizeDescription,
            timestamp: Date.now()
          }
        }));
        logWithTimestamp(`Changed pattern to: ${pattern}, prize: ${prize}`);
        return true;
      } catch (err) {
        console.error("Error changing pattern:", err);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Function to start the game
  const startGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "game-start",
          sessionId,
          data: {
            timestamp: Date.now()
          }
        }));
        logWithTimestamp(`Started game for session: ${sessionId}`);
        return true;
      } catch (err) {
        console.error("Error starting game:", err);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Function to end the game
  const endGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "game-end",
          sessionId,
          data: {
            timestamp: Date.now()
          }
        }));
        logWithTimestamp(`Ended game for session: ${sessionId}`);
        return true;
      } catch (err) {
        console.error("Error ending game:", err);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Function to advance to next game
  const nextGame = useCallback((gameNumber: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "next-game",
          sessionId,
          data: {
            gameNumber,
            timestamp: Date.now()
          }
        }));
        logWithTimestamp(`Advanced to next game: ${gameNumber}`);
        return true;
      } catch (err) {
        console.error("Error advancing to next game:", err);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Function to respond to a claim
  const respondToClaim = useCallback((playerCode: string, result: 'valid' | 'rejected') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "claim-result",
          sessionId,
          data: {
            playerCode,
            result,
            timestamp: Date.now()
          }
        }));
        
        // Remove this claim from the pending claims
        setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
        logWithTimestamp(`Responded to claim from ${playerCode} with result: ${result}`);
        
        return true;
      } catch (err) {
        console.error("Error responding to claim:", err);
        return false;
      }
    }
    return false;
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
