import { useState, useEffect, useRef } from 'react';
import { GameType } from '@/types';
import { useToast } from './use-toast';
import { logWithTimestamp, cleanupAllConnections } from '@/utils/logUtils';

// Define WebSocket URL with the correct Supabase project ID
const BINGO_HUB_URL = 'wss://weqosgnuiixccghdoccw.supabase.co/functions/v1/bingo-hub';

export interface PlayerInfo {
  playerCode: string;
  playerName?: string;
}

interface PendingClaim {
  playerCode: string;
  playerName?: string;
  ticketData?: any;
  timestamp: number;
}

export function useCallerHub(sessionId?: string) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const instanceId = useRef<string>(Date.now().toString());
  const isUnmounting = useRef(false);
  const connectionInProgress = useRef(false);
  const isActiveInstance = useRef(true);
  
  useEffect(() => {
    // Reset unmounting flag on mount
    isUnmounting.current = false;
    isActiveInstance.current = true;
    
    // CRITICAL FIX: Force cleanup of all connections on mount to prevent duplication
    cleanupAllConnections();
    
    // Only proceed with connection if we have a sessionId and are the active instance
    if (sessionId && isActiveInstance.current && !connectionInProgress.current) {
      // Add small delay to allow React to render and avoid race conditions
      setTimeout(() => {
        connectToHub(sessionId);
      }, 100);
    }
    
    return () => {
      // Mark as unmounting to prevent reconnection attempts during cleanup
      isUnmounting.current = true;
      isActiveInstance.current = false;
      
      // Clean up WebSocket connection
      disconnectFromHub();
      
      // Clear any pending reconnect timers
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [sessionId]);

  const connectToHub = (sessionId: string) => {
    try {
      // Don't attempt to connect if we're unmounting or a connection is in progress
      if (isUnmounting.current || connectionInProgress.current) {
        return;
      }
      
      // Mark connection as in progress
      connectionInProgress.current = true;
      
      // Clean up any existing connection first
      disconnectFromHub();
      
      setConnectionState('connecting');
      
      // Log connection attempt
      logWithTimestamp(`Caller connecting to WebSocket for session ${sessionId}, instance ${instanceId.current}`);
      
      // Create WebSocket connection with caller type and session ID
      const wsUrl = `${BINGO_HUB_URL}?type=caller&sessionId=${sessionId}&instanceId=${instanceId.current}`;
      socket.current = new WebSocket(wsUrl);
      
      // IMPORTANT: Add proper WebSocket event handlers with timeouts
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (connectionState !== 'connected' && socket.current) {
          logWithTimestamp(`WebSocket connection timed out for session ${sessionId}`);
          socket.current.close(1000, "Connection timeout");
          socket.current = null;
          connectionInProgress.current = false;
          setConnectionState('error');
          setIsConnected(false);
          scheduleReconnect(sessionId);
        }
      }, 10000); // 10 second timeout
      
      socket.current.onopen = () => {
        clearTimeout(connectionTimeout);
        if (isUnmounting.current) return;
        
        logWithTimestamp(`Caller WebSocket connected for session ${sessionId}`);
        setConnectionState('connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectCount.current = 0;
        
        // Connection is no longer in progress
        connectionInProgress.current = false;
        
        // Notify the user
        toast({
          title: "Game Server Connected",
          description: "Connection to game server established",
          duration: 3000
        });
      };
      
      socket.current.onmessage = (event) => {
        if (isUnmounting.current) return;
        
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          switch (message.type) {
            case 'player_joined':
              if (message.data) {
                const { playerCode, playerName } = message.data;
                logWithTimestamp(`Player joined: ${playerCode} (${playerName})`);
                
                // Add to connected players if not already there
                setConnectedPlayers(prev => {
                  const exists = prev.some(p => p.playerCode === playerCode);
                  if (!exists) {
                    return [...prev, { playerCode, playerName }];
                  }
                  return prev;
                });
              }
              break;
              
            case 'player_left':
              if (message.data && message.data.playerCode) {
                logWithTimestamp(`Player left: ${message.data.playerCode}`);
                setConnectedPlayers(prev => 
                  prev.filter(p => p.playerCode !== message.data.playerCode)
                );
              }
              break;
            
            case 'bingo_claimed':
              if (message.data) {
                const { playerCode, playerName, ticketData } = message.data;
                logWithTimestamp(`Bingo claim from player ${playerCode} (${playerName})`);
                
                // Add to pending claims
                setPendingClaims(prev => [...prev, {
                  playerCode, 
                  playerName, 
                  ticketData,
                  timestamp: Date.now()
                }]);
                
                // Show notification
                toast({
                  title: "New Bingo Claim",
                  description: `${playerName || playerCode} has claimed bingo!`,
                  variant: "default",
                  duration: 5000
                });
              }
              break;
            
            case 'pong':
              // Heartbeat response - connection is still alive
              break;
              
            default:
              logWithTimestamp(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      socket.current.onerror = (error) => {
        clearTimeout(connectionTimeout);
        if (isUnmounting.current) return;
        
        console.error('WebSocket error:', error);
        logWithTimestamp(`Caller WebSocket error for session ${sessionId}`);
        
        setConnectionState('error');
        setIsConnected(false);
        setConnectionError('Connection to game server failed. Please try reconnecting.');
        
        // Connection is no longer in progress
        connectionInProgress.current = false;
        
        // Show error toast only if this is the first error
        if (reconnectCount.current === 0) {
          toast({
            title: "Connection Error",
            description: "Failed to connect to game server",
            variant: "destructive",
            duration: 5000
          });
        }
        
        // Try to reconnect
        scheduleReconnect(sessionId);
      };
      
      socket.current.onclose = (event) => {
        clearTimeout(connectionTimeout);
        if (isUnmounting.current) return;
        
        logWithTimestamp(`Caller WebSocket closed for session ${sessionId}: ${event.code} - ${event.reason}`);
        
        setConnectionState('disconnected');
        setIsConnected(false);
        
        // Connection is no longer in progress
        connectionInProgress.current = false;
        
        // Only attempt to reconnect if not closing cleanly
        if (event.code !== 1000) {
          scheduleReconnect(sessionId);
        }
      };
      
      // Set up ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
          try {
            socket.current.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
          } catch (err) {
            console.error('Error sending ping:', err);
          }
        }
      }, 30000); // 30 second ping
      
      // Clean up ping interval on component unmount
      return () => {
        clearInterval(pingInterval);
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      logWithTimestamp(`Error initializing WebSocket: ${error}`);
      
      setConnectionState('error');
      setIsConnected(false);
      setConnectionError(`Connection error: ${error}`);
      
      // Connection is no longer in progress
      connectionInProgress.current = false;
    }
  };

  const disconnectFromHub = () => {
    try {
      if (socket.current) {
        // Only log if socket exists
        logWithTimestamp('Closing caller WebSocket connection');
        
        // Close the socket
        if (socket.current.readyState === WebSocket.OPEN || 
            socket.current.readyState === WebSocket.CONNECTING) {
          socket.current.close(1000, 'Normal closure');
        }
        
        // Clear the socket
        socket.current = null;
      }
    } catch (error) {
      console.error('Error closing WebSocket:', error);
    }
  };

  const scheduleReconnect = (sessionId: string) => {
    // Clear any existing reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    
    // Don't reconnect if we're unmounting or exceeded max attempts
    if (isUnmounting.current || reconnectCount.current >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }
    
    reconnectCount.current++;
    
    // Exponential backoff with maximum of 30 seconds
    const delay = Math.min(2000 * Math.pow(2, reconnectCount.current - 1), 30000);
    
    logWithTimestamp(`Scheduling reconnect in ${delay}ms (attempt ${reconnectCount.current}/${MAX_RECONNECT_ATTEMPTS})`);
    
    reconnectTimer.current = setTimeout(() => {
      if (!isUnmounting.current && isActiveInstance.current) {
        logWithTimestamp(`Attempting reconnect for session ${sessionId} (${reconnectCount.current}/${MAX_RECONNECT_ATTEMPTS})`);
        connectToHub(sessionId);
      }
    }, delay);
  };

  const clearClaim = (playerCode: string) => {
    setPendingClaims(prev => 
      prev.filter(claim => claim.playerCode !== playerCode)
    );
  };
  
  const sendClaimResult = (playerCode: string, result: 'valid' | 'rejected') => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !sessionId) {
      logWithTimestamp(`Cannot send claim result: socket not connected`);
      return false;
    }
    
    try {
      socket.current.send(JSON.stringify({
        type: 'claim-result',
        sessionId,
        data: {
          playerCode,
          result,
          instanceId: instanceId.current
        }
      }));
      
      logWithTimestamp(`Sent claim result for player ${playerCode}: ${result}`);
      
      // Remove from pending claims
      clearClaim(playerCode);
      
      return true;
    } catch (error) {
      console.error('Error sending claim result:', error);
      return false;
    }
  };

  // Method for calling a number
  const callNumber = (number: number, allCalledNumbers: number[]) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !sessionId) {
      logWithTimestamp(`Cannot call number: socket not connected`);
      return false;
    }
    
    try {
      socket.current.send(JSON.stringify({
        type: 'call-number',
        sessionId,
        data: {
          lastCalledNumber: number,
          calledNumbers: allCalledNumbers,
          timestamp: Date.now(),
          instanceId: instanceId.current
        }
      }));
      
      logWithTimestamp(`Called number ${number} via WebSocket`);
      return true;
    } catch (error) {
      console.error('Error calling number:', error);
      return false;
    }
  };

  // Method for starting the game
  const startGame = () => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !sessionId) {
      logWithTimestamp(`Cannot start game: socket not connected`);
      return false;
    }
    
    try {
      socket.current.send(JSON.stringify({
        type: 'start-game',
        sessionId,
        data: {
          gameStatus: 'active',
          timestamp: Date.now(),
          instanceId: instanceId.current
        }
      }));
      
      logWithTimestamp(`Started game via WebSocket`);
      return true;
    } catch (error) {
      console.error('Error starting game:', error);
      return false;
    }
  };

  // Method for responding to a claim
  const respondToClaim = (playerCode: string, result: 'valid' | 'rejected') => {
    return sendClaimResult(playerCode, result);
  };

  // Method for changing the win pattern
  const changePattern = (newPattern: string) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !sessionId) {
      logWithTimestamp(`Cannot change pattern: socket not connected`);
      return false;
    }
    
    try {
      socket.current.send(JSON.stringify({
        type: 'change-pattern',
        sessionId,
        data: {
          currentWinPattern: newPattern,
          timestamp: Date.now(),
          instanceId: instanceId.current
        }
      }));
      
      logWithTimestamp(`Changed win pattern to ${newPattern} via WebSocket`);
      return true;
    } catch (error) {
      console.error('Error changing pattern:', error);
      return false;
    }
  };

  const reconnect = () => {
    if (!sessionId || connectionInProgress.current) return;
    
    logWithTimestamp('Manual reconnect requested');
    
    // Reset reconnect count for a fresh start
    reconnectCount.current = 0;
    
    // CRITICAL FIX: Clean up all connections first to break any loops
    cleanupAllConnections();
    
    // Reset all connection states
    connectionInProgress.current = false;
    
    // Connect after a short delay
    setTimeout(() => {
      connectToHub(sessionId);
    }, 500);
  };

  return {
    connectionState,
    isConnected,
    pendingClaims,
    connectedPlayers,
    connectionError,
    clearClaim,
    sendClaimResult,
    reconnect,
    // Add the new methods
    callNumber,
    startGame,
    respondToClaim,
    changePattern
  };
}
