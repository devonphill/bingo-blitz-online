import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const maxReconnectAttempts = 3; // Reduced for faster fallback
  const { toast } = useToast();
  const connectionTimeoutRef = useRef<number | null>(null);
  const instanceId = useRef(Date.now()); // Unique instance identifier

  // Listen for realtime claims as fallback
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up realtime claims listener for session: ${sessionId}`);
    
    const channel = supabase.channel('bingo-claims');
    
    channel.on(
      'broadcast', 
      { event: 'bingo-claim' },
      (payload) => {
        if (payload.payload && payload.payload.sessionId === sessionId) {
          const { playerCode, playerName, ticketData, timestamp } = payload.payload;
          
          logWithTimestamp(`Received bingo claim via realtime: ${playerCode}`);
          
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
            description: `${playerName || playerCode} has claimed a bingo (via realtime)`,
            duration: 5000
          });
        }
      }
    ).subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

  // Function to create WebSocket connection with direct URL
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
      // Direct connection to Supabase Edge Function
      const wsUrl = `wss://weqosgnuiixccghdoccw.supabase.co/functions/v1/bingo-hub?type=caller&sessionId=${sessionId}&instanceId=${instanceId.current}`;
      
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
        logWithTimestamp("Caller WebSocket connection established");
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
              setIsConnected(true);
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
          const delay = 2000;
          logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimerRef.current = window.setTimeout(() => {
            createWebSocketConnection();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logWithTimestamp("Maximum reconnection attempts reached, using realtime fallback");
          setConnectionState('error');
          setConnectionError("Using realtime updates as fallback mechanism");
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        logWithTimestamp(`WebSocket error occurred: ${JSON.stringify(error)}`);
        setIsConnected(false);
        setConnectionState('error');
        setConnectionError("Error connecting to the game server. Using realtime fallback.");
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

  // Function to call a new number - with realtime fallback
  const callNumber = useCallback((number: number, allCalledNumbers: number[]) => {
    // First try via WebSocket
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
        logWithTimestamp(`Called number via WebSocket: ${number}`);
        return true;
      } catch (err) {
        console.error("Error calling number via WebSocket:", err);
        // Continue to fallback
      }
    }
    
    // Fallback: Use Supabase realtime broadcast
    try {
      const channel = supabase.channel('number-broadcast');
      channel
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId,
            lastCalledNumber: number,
            calledNumbers: allCalledNumbers,
            timestamp: Date.now()
          }
        })
        .then(() => {
          logWithTimestamp(`Called number via realtime broadcast: ${number}`);
        })
        .catch(err => {
          console.error("Error calling number via realtime:", err);
        });
      
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
      return false;
    }
  }, [sessionId]);
  
  // Function to change the active win pattern - with realtime fallback
  const changePattern = useCallback((pattern: string, prize?: string, prizeDescription?: string) => {
    // First try via WebSocket
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
        logWithTimestamp(`Changed pattern via WebSocket: ${pattern}`);
        return true;
      } catch (err) {
        console.error("Error changing pattern via WebSocket:", err);
        // Continue to fallback
      }
    }
    
    // Fallback: Use Supabase realtime broadcast
    try {
      const channel = supabase.channel('number-broadcast');
      channel
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId,
            activeWinPattern: pattern,
            prizeInfo: {
              currentPrize: prize,
              currentPrizeDescription: prizeDescription
            },
            timestamp: Date.now()
          }
        })
        .then(() => {
          logWithTimestamp(`Changed pattern via realtime broadcast: ${pattern}`);
        })
        .catch(err => {
          console.error("Error changing pattern via realtime:", err);
        });
      
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
      return false;
    }
  }, [sessionId]);
  
  // Other game control functions with realtime fallback
  const startGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "game-start",
          sessionId,
          data: { timestamp: Date.now() }
        }));
        logWithTimestamp(`Started game via WebSocket`);
        return true;
      } catch (err) {
        console.error("Error starting game via WebSocket:", err);
      }
    }
    
    // Try fallback
    try {
      const channel = supabase.channel('number-broadcast');
      channel
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId,
            gameStatus: 'active',
            timestamp: Date.now()
          }
        });
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
      return false;
    }
  }, [sessionId]);
  
  const endGame = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "game-end",
          sessionId,
          data: { timestamp: Date.now() }
        }));
        logWithTimestamp(`Ended game via WebSocket`);
        return true;
      } catch (err) {
        console.error("Error ending game via WebSocket:", err);
      }
    }
    
    // Try fallback
    try {
      const channel = supabase.channel('number-broadcast');
      channel
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId,
            gameStatus: 'completed',
            timestamp: Date.now()
          }
        });
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
      return false;
    }
  }, [sessionId]);
  
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
        logWithTimestamp(`Advanced to next game via WebSocket: ${gameNumber}`);
        return true;
      } catch (err) {
        console.error("Error advancing to next game via WebSocket:", err);
      }
    }
    
    // Try fallback
    try {
      const channel = supabase.channel('number-broadcast');
      channel
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId,
            gameNumber,
            calledNumbers: [],
            lastCalledNumber: null,
            timestamp: Date.now()
          }
        });
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
      return false;
    }
  }, [sessionId]);
  
  // Function to respond to a claim - with realtime fallback
  const respondToClaim = useCallback((playerCode: string, result: 'valid' | 'rejected', instanceId?: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        socketRef.current.send(JSON.stringify({
          type: "claim-result",
          sessionId,
          data: {
            playerCode,
            result,
            instanceId,
            timestamp: Date.now()
          }
        }));
        
        // Remove this claim from the pending claims
        setPendingClaims(prev => prev.filter(claim => claim.playerCode !== playerCode));
        logWithTimestamp(`Responded to claim via WebSocket: ${playerCode} - ${result}`);
        
        return true;
      } catch (err) {
        console.error("Error responding to claim via WebSocket:", err);
      }
    }
    
    // Try fallback via realtime broadcast
    try {
      // Use player-specific channel if we have instanceId
      const channelName = instanceId ? `player-claims-${instanceId}` : 'player-claims';
      const channel = supabase.channel(channelName);
      
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
          logWithTimestamp(`Responded to claim via realtime broadcast: ${playerCode} - ${result}`);
        })
        .catch(err => {
          console.error("Error sending claim result via realtime:", err);
        });
      
      return true;
    } catch (err) {
      console.error("Error with realtime fallback:", err);
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
