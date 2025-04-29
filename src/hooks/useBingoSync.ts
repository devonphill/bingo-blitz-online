import { useState, useEffect, useRef } from 'react';
import { useToast } from './use-toast';

interface GameState {
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
  gameStatus: string | null;
  lastUpdate: number;
}

export function useBingoSync(sessionId?: string, playerCode?: string, playerName?: string) {
  const [gameState, setGameState] = useState<GameState>({
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null,
    currentPrize: null,
    currentPrizeDescription: null,
    gameStatus: null,
    lastUpdate: Date.now()
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const { toast } = useToast();
  
  useEffect(() => {
    // Reset connection error on each new connection attempt
    setConnectionError(null);
    
    // Don't attempt connection if we don't have valid session ID or playerCode
    if (!sessionId || sessionId === '') {
      console.log("Missing sessionId for WebSocket connection");
      setConnectionState('disconnected');
      setConnectionError("Missing game session ID");
      return;
    }

    if (!playerCode || playerCode === '') {
      console.log("Missing playerCode for WebSocket connection");
      setConnectionState('disconnected');
      setConnectionError("Missing player code");
      return;
    }

    console.log(`Setting up WebSocket connection for session: ${sessionId}, player: ${playerCode}`);
    setConnectionState('connecting');

    // Construct WebSocket URL with query parameters
    const domain = window.location.origin;
    const wsUrl = new URL(`${domain}/functions/v1/bingo-hub`);
    
    wsUrl.searchParams.append('type', 'player');
    wsUrl.searchParams.append('sessionId', sessionId);
    if (playerCode) wsUrl.searchParams.append('playerCode', playerCode);
    if (playerName && playerName !== '') wsUrl.searchParams.append('playerName', playerName);
    
    // Upgrade from http to ws protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.protocol = wsProtocol;
    
    console.log("Connecting to WebSocket URL:", wsUrl.toString());
    
    try {
      // Create WebSocket connection
      const socket = new WebSocket(wsUrl.toString());
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        setConnectionError(null);
        
        // Send player join message
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
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("WebSocket connection confirmed:", message.data);
              break;
              
            case "game_state":
              console.log("Received game state update:", message.data);
              if (message.data) {
                const data = message.data;
                setGameState(prev => ({
                  ...prev,
                  calledNumbers: data.calledNumbers || prev.calledNumbers,
                  lastCalledNumber: data.lastCalledNumber !== undefined ? data.lastCalledNumber : prev.lastCalledNumber,
                  currentWinPattern: data.currentWinPattern || prev.currentWinPattern,
                  currentPrize: data.currentPrize || prev.currentPrize,
                  currentPrizeDescription: data.currentPrizeDescription || prev.currentPrizeDescription,
                  gameStatus: data.gameStatus || prev.gameStatus,
                  lastUpdate: data.timestamp || Date.now()
                }));
              }
              break;
              
            case "number_called":
              console.log("Received number called update:", message.data);
              if (message.data) {
                const data = message.data;
                setGameState(prev => ({
                  ...prev,
                  calledNumbers: data.calledNumbers || prev.calledNumbers,
                  lastCalledNumber: data.lastCalledNumber !== undefined ? data.lastCalledNumber : prev.lastCalledNumber,
                  lastUpdate: data.timestamp || Date.now()
                }));
                
                if (data.lastCalledNumber !== null && data.lastCalledNumber !== undefined) {
                  toast({
                    title: "Number Called",
                    description: `Number ${data.lastCalledNumber} has been called!`,
                    duration: 3000
                  });
                }
              }
              break;
              
            case "pattern_changed":
              console.log("Received pattern change update:", message.data);
              if (message.data) {
                const data = message.data;
                setGameState(prev => ({
                  ...prev,
                  currentWinPattern: data.currentWinPattern || prev.currentWinPattern,
                  currentPrize: data.currentPrize || prev.currentPrize,
                  currentPrizeDescription: data.currentPrizeDescription || prev.currentPrizeDescription,
                  lastUpdate: data.timestamp || Date.now()
                }));
                
                toast({
                  title: "Win Pattern Changed",
                  description: `New pattern: ${data.currentWinPattern}`,
                  duration: 3000
                });
              }
              break;
              
            case "game_started":
              console.log("Received game started update:", message.data);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'active',
                lastUpdate: message.data?.timestamp || Date.now()
              }));
              
              toast({
                title: "Game Started",
                description: "The game is now live!",
                duration: 3000
              });
              break;
              
            case "game_ended":
              console.log("Received game ended update:", message.data);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'completed',
                lastUpdate: message.data?.timestamp || Date.now()
              }));
              
              toast({
                title: "Game Ended",
                description: "This game has ended.",
                duration: 3000
              });
              break;
              
            case "next_game":
              console.log("Received next game update:", message.data);
              if (message.data) {
                setGameState({
                  lastCalledNumber: null,
                  calledNumbers: [],
                  currentWinPattern: null,
                  currentPrize: null,
                  currentPrizeDescription: null,
                  gameStatus: 'active',
                  lastUpdate: message.data.timestamp || Date.now()
                });
                
                toast({
                  title: "Next Game",
                  description: `Moving to Game #${message.data.gameNumber}`,
                  duration: 3000
                });
              }
              break;
              
            case "claim_result":
              console.log("Received claim result:", message.data);
              if (message.data) {
                const result = message.data.result;
                if (result === 'valid') {
                  toast({
                    title: "Claim Verified!",
                    description: "Your bingo claim has been verified.",
                    duration: 5000
                  });
                } else if (result === 'rejected') {
                  toast({
                    title: "Claim Rejected",
                    description: "Your claim was not valid.",
                    variant: "destructive",
                    duration: 5000
                  });
                }
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
        console.log("WebSocket connection closed:", event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Clear ping interval
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Try to reconnect with exponential backoff
        const reconnectDelay = Math.min(3000 * Math.pow(1.5, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        console.log(`Reconnect attempt ${reconnectAttemptsRef.current} scheduled in ${reconnectDelay}ms`);
        
        // Try to reconnect
        reconnectTimerRef.current = window.setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          setConnectionState('connecting');
        }, reconnectDelay);
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        setConnectionState('error');
        setConnectionError("Connection to game server failed");
        
        if (reconnectAttemptsRef.current < 5) {
          toast({
            title: "Connection Error",
            description: "Lost connection to the game server. Trying to reconnect...",
            variant: "destructive",
            duration: 5000
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Could not connect to the game server after multiple attempts. Please refresh the page.",
            variant: "destructive",
            duration: 10000
          });
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionState('error');
      setConnectionError("Failed to establish connection to game server");
    }

    // Cleanup function
    return () => {
      console.log("Cleaning up WebSocket connection");
      
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
  }, [sessionId, playerCode, playerName, toast]);
  
  // Function to claim bingo through WebSocket
  const claimBingo = (ticketData?: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: "claim",
        sessionId,
        data: {
          ticketData,
          timestamp: Date.now()
        }
      }));
      
      return true;
    }
    
    toast({
      title: "Claim Failed",
      description: "Could not send claim - not connected to the game server.",
      variant: "destructive",
      duration: 5000
    });
    
    return false;
  };
  
  return {
    gameState,
    isConnected,
    connectionState,
    connectionError,
    claimBingo
  };
}
