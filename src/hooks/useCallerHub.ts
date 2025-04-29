
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
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionId) {
      console.log("No sessionId provided to useCallerHub");
      setConnectionState('disconnected');
      return;
    }

    console.log(`Setting up caller WebSocket connection for session: ${sessionId}`);
    setConnectionState('connecting');

    // Construct WebSocket URL with query parameters
    let wsUrl = new URL("/functions/v1/bingo-hub", window.location.origin);
    
    // When running in development using localhost, point to the deployed Supabase URL
    if (window.location.hostname === 'localhost') {
      wsUrl = new URL("https://weqosgnuiixccghdoccw.functions.supabase.co/bingo-hub");
    }
    
    wsUrl.searchParams.append('type', 'caller');
    wsUrl.searchParams.append('sessionId', sessionId);
    
    // Upgrade from http to ws protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.protocol = wsProtocol;
    
    // Create WebSocket connection
    const socket = new WebSocket(wsUrl.toString());
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log("Caller WebSocket connection established");
      setIsConnected(true);
      setConnectionState('connected');
      
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
  }, [sessionId, toast]);

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
    callNumber,
    changePattern,
    startGame,
    endGame,
    nextGame,
    respondToClaim
  };
}
