import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

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
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [pendingClaims, setPendingClaims] = useState<BingoClaim[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const { toast } = useToast();

  // Function to create WebSocket connection
  const createWebSocketConnection = useCallback(() => {
    if (!sessionId) {
      console.log("No sessionId provided to useCallerHub");
      setConnectionState('disconnected');
      return;
    }

    // Clear any existing connection
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }

    console.log(`Setting up caller WebSocket connection for session: ${sessionId} (attempt ${reconnectAttemptsRef.current + 1})`);
    setConnectionState('connecting');

    // Construct WebSocket URL with query parameters
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl: URL;

    // When running in development using localhost, point to the deployed Supabase URL
    if (window.location.hostname === 'localhost') {
      wsUrl = new URL("https://weqosgnuiixccghdoccw.functions.supabase.co/bingo-hub");
    } else {
      // Use relative URL when deployed
      wsUrl = new URL("/functions/v1/bingo-hub", window.location.origin);
    }
    
    wsUrl.searchParams.append('type', 'caller');
    wsUrl.searchParams.append('sessionId', sessionId);
    
    // Upgrade from http to ws protocol
    wsUrl.protocol = wsProtocol;
    
    try {
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl.toString());
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log("Caller WebSocket connection established");
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        
        // Set up ping interval
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "ping",
              sessionId
            }));
          }
        }, 30000); // Send ping every 30 seconds
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("Caller WebSocket connection confirmed:", message.data);
              break;
              
            case "player_joined":
              console.log("Player joined:", message.data);
              if (message.data) {
                setConnectedPlayers(prev => [
                  ...prev.filter(p => p.playerCode !== message.data.playerCode),
                  {
                    playerCode: message.data.playerCode,
                    playerName: message.data.playerName,
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
              console.log("Player left:", message.data);
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
              console.log("Bingo claimed:", message.data);
              if (message.data) {
                setPendingClaims(prev => [
                  ...prev,
                  {
                    playerCode: message.data.playerCode,
                    playerName: message.data.playerName,
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
              setIsConnected(true);
              setConnectionState('connected');
              break;
              
            default:
              console.log("Received unknown message type:", message.type, message);
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };
      
      socket.onclose = (event) => {
        console.log("Caller WebSocket connection closed:", event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Clear ping interval
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Try to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff with 30s max
          console.log(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimerRef.current = window.setTimeout(() => {
            console.log("Attempting to reconnect WebSocket...");
            createWebSocketConnection();
          }, delay);
        } else {
          console.log("Maximum reconnection attempts reached. Giving up.");
          setConnectionState('error');
          toast({
            title: "Connection Failed",
            description: "Could not establish a connection to the game server after multiple attempts.",
            variant: "destructive",
            duration: 5000
          });
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        setConnectionState('error');
        
        toast({
          title: "Connection Error",
          description: "Error connecting to the game server. Will try to reconnect...",
          variant: "destructive",
          duration: 5000
        });
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setConnectionState('error');
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimerRef.current = window.setTimeout(() => {
          createWebSocketConnection();
        }, delay);
      }
    }
  }, [sessionId, toast]);

  // Set up connection when sessionId changes
  useEffect(() => {
    reconnectAttemptsRef.current = 0;
    createWebSocketConnection();

    // Cleanup function
    return () => {
      console.log("Cleaning up caller WebSocket connection");
      
      // Clear intervals and timers
      if (pingIntervalRef.current !== null) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      // Close socket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, [sessionId, createWebSocketConnection]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log("Manual reconnection attempt");
    reconnectAttemptsRef.current = 0;
    createWebSocketConnection();
  }, [createWebSocketConnection]);

  // Function to call a new number
  const callNumber = useCallback((number: number, allCalledNumbers: number[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: "number-called",
        sessionId,
        data: {
          lastCalledNumber: number,
          calledNumbers: allCalledNumbers,
          timestamp: Date.now()
        }
      }));
      return true;
    }
    return false;
  }, [sessionId]);
  
  // Function to change the active win pattern
  const changePattern = useCallback((pattern: string, prize?: string, prizeDescription?: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
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
      return true;
    }
    return false;
  }, [sessionId]);
  
  // Function to start the game
  const startGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: "game-start",
        sessionId,
        data: {
          timestamp: Date.now()
        }
      }));
      return true;
    }
    return false;
  }, [sessionId]);
  
  // Function to end the game
  const endGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: "game-end",
        sessionId,
        data: {
          timestamp: Date.now()
        }
      }));
      return true;
    }
    return false;
  }, [sessionId]);
  
  // Function to advance to next game
  const nextGame = useCallback((gameNumber: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: "next-game",
        sessionId,
        data: {
          gameNumber,
          timestamp: Date.now()
        }
      }));
      return true;
    }
    return false;
  }, [sessionId]);
  
  // Function to respond to a claim
  const respondToClaim = useCallback((playerCode: string, result: 'valid' | 'rejected') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
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
      
      return true;
    }
    return false;
  }, [sessionId]);
  
  return {
    isConnected,
    connectionState,
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
