
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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!sessionId) {
      console.log("No sessionId provided to useBingoSync");
      setConnectionState('disconnected');
      return;
    }

    console.log(`Setting up WebSocket connection for session: ${sessionId}`);
    setConnectionState('connecting');

    // Construct WebSocket URL with query parameters
    let wsUrl = new URL("/functions/v1/bingo-hub", window.location.origin);
    
    // When running in development using localhost, point to the deployed Supabase URL
    if (window.location.hostname === 'localhost') {
      wsUrl = new URL("https://weqosgnuiixccghdoccw.functions.supabase.co/bingo-hub");
    }
    
    wsUrl.searchParams.append('type', 'player');
    wsUrl.searchParams.append('sessionId', sessionId);
    if (playerCode) wsUrl.searchParams.append('playerCode', playerCode);
    if (playerName) wsUrl.searchParams.append('playerName', playerName);
    
    // Upgrade from http to ws protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.protocol = wsProtocol;
    
    // Create WebSocket connection
    const socket = new WebSocket(wsUrl.toString());
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log("WebSocket connection established");
      setIsConnected(true);
      setConnectionState('connected');
      
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
      
      // Try to reconnect
      reconnectTimerRef.current = window.setTimeout(() => {
        console.log("Attempting to reconnect WebSocket...");
        setConnectionState('connecting');
      }, 3000);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
      setConnectionState('error');
      
      toast({
        title: "Connection Error",
        description: "Lost connection to the game server. Trying to reconnect...",
        variant: "destructive",
        duration: 5000
      });
    };

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
    claimBingo
  };
}
