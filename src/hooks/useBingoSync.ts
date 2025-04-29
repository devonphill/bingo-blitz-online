
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

export function useBingoSync(sessionId?: string, playerCode?: string, playerName?: string) {
  // GameState with default values
  const [gameState, setGameState] = useState<GameState>({
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null,
    currentPrize: null,
    currentPrizeDescription: null,
    gameStatus: null
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 7; // Increased from 5
  const { toast } = useToast();

  // Function to create WebSocket connection
  const createWebSocketConnection = useCallback(() => {
    // Only proceed if we have session ID
    if (!sessionId) {
      console.log("Cannot connect without sessionId");
      return;
    }
    
    // Clear any existing connection
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    
    console.log(`Setting up player WebSocket connection for session: ${sessionId} (attempt ${reconnectAttemptsRef.current + 1})`);
    setConnectionState('connecting');
    setConnectionError(null);

    try {
      // Construct WebSocket URL
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl: URL;
      
      // When running in development using localhost, construct URL manually 
      if (window.location.hostname === 'localhost') {
        // Point to the deployed Supabase function URL
        wsUrl = new URL("wss://weqosgnuiixccghdoccw.functions.supabase.co/bingo-hub");
      } else {
        // Use relative URL when deployed
        wsUrl = new URL(`${wsProtocol}//${window.location.host}/functions/v1/bingo-hub`);
      }
      
      wsUrl.searchParams.append('type', 'player');
      wsUrl.searchParams.append('sessionId', sessionId);
      if (playerCode) wsUrl.searchParams.append('playerCode', playerCode);
      if (playerName) wsUrl.searchParams.append('playerName', playerName);
      
      console.log("Connecting to WebSocket URL:", wsUrl.toString());
      
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl.toString());
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log("Player WebSocket connection established");
        setIsConnected(true);
        setConnectionState('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        
        // Send join message
        socket.send(JSON.stringify({
          type: "join",
          sessionId,
          playerCode,
          playerName
        }));
        
        // Set up ping interval
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "ping",
              sessionId
            }));
          }
        }, 30000); // Send ping every 30 seconds
        
        toast({
          title: "Connected",
          description: "Connected to game server successfully.",
          duration: 3000
        });
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("Player WebSocket connection confirmed:", message.data);
              break;
              
            case "game_state":
              console.log("Received game state:", message.data);
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
              console.log("Number called:", message.data);
              if (message.data) {
                setGameState(prev => ({
                  ...prev,
                  lastCalledNumber: message.data.lastCalledNumber,
                  calledNumbers: message.data.calledNumbers || prev.calledNumbers
                }));
                
                // Show toast for new number
                toast({
                  title: "Number Called",
                  description: `Number ${message.data.lastCalledNumber} has been called`,
                  duration: 3000
                });
              }
              break;
              
            case "pattern_changed":
              console.log("Pattern changed:", message.data);
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
                  description: `New winning pattern: ${message.data.currentWinPattern}`,
                  duration: 3000
                });
              }
              break;
              
            case "game_started":
              console.log("Game started:", message.data);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'active'
              }));
              
              toast({
                title: "Game Started",
                description: "The game has started!",
                duration: 3000
              });
              break;
              
            case "game_ended":
              console.log("Game ended:", message.data);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'completed'
              }));
              
              toast({
                title: "Game Ended",
                description: "The current game has ended.",
                duration: 3000
              });
              break;
              
            case "next_game":
              console.log("Next game:", message.data);
              if (message.data) {
                setGameState({
                  lastCalledNumber: null,
                  calledNumbers: [],
                  currentWinPattern: null,
                  currentPrize: null,
                  currentPrizeDescription: null,
                  gameStatus: 'active'
                });
                
                toast({
                  title: "New Game Started",
                  description: `Game ${message.data.gameNumber} has started`,
                  duration: 3000
                });
              }
              break;
              
            case "claim_result":
              console.log("Claim result:", message.data);
              if (message.data) {
                setClaimStatus(message.data.result === 'valid' ? 'validated' : 'rejected');
                
                toast({
                  title: message.data.result === 'valid' ? "Bingo Verified!" : "Claim Rejected",
                  description: message.data.result === 'valid' 
                    ? "Your bingo claim has been verified!" 
                    : "Your bingo claim was not valid. Please check your numbers.",
                  variant: message.data.result === 'valid' ? "default" : "destructive",
                  duration: 5000
                });
              }
              break;
              
            case "pong":
              // Just update connection status
              setIsConnected(true);
              setConnectionState('connected');
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
              console.log("Received unknown message type:", message.type, message);
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };
      
      socket.onclose = (event) => {
        console.log("Player WebSocket connection closed:", event.code, event.reason);
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
          
          // Show toast for first couple reconnect attempts
          if (reconnectAttemptsRef.current <= 2) {
            toast({
              title: "Connection Lost",
              description: `Connection to game server lost. Reconnecting in ${Math.round(delay/1000)}s...`,
              variant: "destructive",
              duration: 5000
            });
          }
        } else {
          console.log("Maximum reconnection attempts reached. Giving up.");
          setConnectionState('error');
          setConnectionError("Could not establish a connection to the game server after multiple attempts.");
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
        setConnectionError("Error connecting to the game server. Will try to reconnect...");
        
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
      setConnectionError(`Error creating WebSocket: ${err.message}`);
      
      // Try to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimerRef.current = window.setTimeout(() => {
          createWebSocketConnection();
        }, delay);
      }
    }
  }, [sessionId, playerCode, playerName, toast]);

  // Set up connection when sessionId changes
  useEffect(() => {
    if (sessionId) {
      reconnectAttemptsRef.current = 0;
      createWebSocketConnection();
    }

    // Cleanup function
    return () => {
      console.log("Cleaning up player WebSocket connection");
      
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

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    console.log("Manual reconnection attempt");
    reconnectAttemptsRef.current = 0;
    setConnectionError(null);
    createWebSocketConnection();
  }, [createWebSocketConnection]);

  // Function to send a bingo claim
  const claimBingo = useCallback((ticketData?: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId && playerCode) {
      socketRef.current.send(JSON.stringify({
        type: "claim",
        sessionId,
        playerCode,
        data: {
          ticketData,
          timestamp: Date.now()
        }
      }));
      
      // Set claim status to pending
      setClaimStatus('pending');
      
      return true;
    }
    return false;
  }, [sessionId, playerCode]);

  return {
    gameState,
    isConnected,
    connectionState,
    connectionError,
    claimStatus,
    reconnect,
    claimBingo
  };
}
