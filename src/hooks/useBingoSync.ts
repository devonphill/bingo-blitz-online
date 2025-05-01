
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { logWithTimestamp, ConnectionManagerClass } from '@/utils/logUtils';

export function useBingoSync(sessionId: string | undefined, playerCode: string = '', playerName: string = '') {
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [currentPrize, setCurrentPrize] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<string>('pending');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);
  
  const channelRef = useRef<any>(null);
  const { toast } = useToast();
  const instanceId = useRef<string>(Date.now().toString());
  const callerPresenceRef = useRef<boolean>(false);
  const connectionManager = useRef<ConnectionManagerClass>(new ConnectionManagerClass(5));
  
  // Clear any active subscriptions on unmount
  useEffect(() => {
    return () => {
      logWithTimestamp('Cleaning up bingo sync connections');
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error("Error cleaning up channel:", err);
        }
      }
      connectionManager.current.reset();
    };
  }, []);

  // Set up real-time listener for game updates when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setConnectionState('disconnected');
      return;
    }
    
    // Don't attempt to connect if already connecting or in cooldown
    if (connectionManager.current.isConnecting || connectionManager.current.isInCooldown) {
      logWithTimestamp(`Skipping connection attempt - ${connectionManager.current.isConnecting ? 'already connecting' : 'in cooldown'}`);
      return;
    }
    
    // Start the connection
    if (!connectionManager.current.startConnection()) {
      return;
    }
    
    logWithTimestamp(`Setting up bingo sync for session: ${sessionId} (instance: ${instanceId.current})`);
    setConnectionState('connecting');
    
    const setupChannel = () => {
      // Clean up any existing channel
      if (channelRef.current) {
        try {
          logWithTimestamp("Removing existing channel before setting up a new one");
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.error("Error removing existing channel:", err);
        }
        channelRef.current = null;
      }

      // Set up new channel
      const channel = supabase
        .channel(`game-updates-${sessionId}`)
        .on('broadcast', { event: 'game-update' }, (payload) => {
          logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
          
          // Reset reconnect count on successful data receiving
          connectionManager.current.reset();
          
          if (payload.payload) {
            const { lastCalledNumber, calledNumbers, currentWinPattern, currentPrize, gameStatus } = payload.payload;
            
            if (calledNumbers && Array.isArray(calledNumbers)) {
              logWithTimestamp(`Updating called numbers: ${calledNumbers.length} total`);
              setCalledNumbers(calledNumbers);
            }
            
            if (lastCalledNumber !== undefined && lastCalledNumber !== null) {
              logWithTimestamp(`New number called: ${lastCalledNumber}`);
              setLastCalledNumber(lastCalledNumber);
              
              toast({
                title: "New Number Called",
                description: `Number ${lastCalledNumber} has been called`,
                duration: 3000
              });
            }
            
            if (currentWinPattern) {
              logWithTimestamp(`New win pattern: ${currentWinPattern}`);
              setCurrentWinPattern(currentWinPattern);
            }
            
            if (currentPrize) {
              logWithTimestamp(`New prize: ${currentPrize}`);
              setCurrentPrize(currentPrize);
            }
            
            if (gameStatus) {
              logWithTimestamp(`Game status updated: ${gameStatus}`);
              setGameStatus(gameStatus);
            }
          }
        })
        .on('broadcast', { event: 'caller-online' }, () => {
          logWithTimestamp('Received caller-online broadcast');
          callerPresenceRef.current = true;
          setConnectionState('connected');
          setIsConnected(true);
          setConnectionError(null);
          connectionManager.current.endConnection(true);
          
          toast({
            title: "Caller Connected",
            description: "The caller is now online and ready to call numbers",
            duration: 3000
          });
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const callerPresent = Object.keys(state).some(key => key.startsWith('caller-'));
          const players = Object.entries(state)
            .filter(([key]) => !key.startsWith('caller-'))
            .flatMap(([_, value]) => value);
          
          logWithTimestamp(`Presence sync. Caller present: ${callerPresent}. Players: ${players.length}`);
          setConnectedPlayers(players);
          
          // Only update connection state if there's a significant change
          if (callerPresent && !callerPresenceRef.current) {
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
            connectionManager.current.endConnection(true);
          } else if (!callerPresent && callerPresenceRef.current) {
            callerPresenceRef.current = false;
            setConnectionState('disconnected');
            setIsConnected(false);
            
            toast({
              title: "Caller Disconnected",
              description: "The caller has disconnected. Waiting for reconnection...",
              duration: 5000,
              variant: "destructive"
            });
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller joined: ${key}`);
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
            connectionManager.current.endConnection(true);
            
            toast({
              title: "Caller Connected",
              description: "The caller has joined the game.",
              duration: 3000
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller left: ${key}`);
            callerPresenceRef.current = false;
            setConnectionState('disconnected');
            setIsConnected(false);
            
            toast({
              title: "Caller Disconnected",
              description: "The caller has disconnected. Waiting for reconnection...",
              duration: 5000,
              variant: "destructive"
            });
          }
        });
        
      // Send player information if we have player code
      if (playerCode) {
        channel.track({
          playerCode,
          playerName: playerName || playerCode,
          online: true,
          timestamp: Date.now()
        });
      }
      
      // Subscribe to the channel
      channel.subscribe(status => {
        logWithTimestamp(`Bingo sync subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // Even if subscribed, we need to check if caller is actually present
          // for reliable connection status - this will be detected via presence events
          
          if (callerPresenceRef.current) {
            setConnectionState('connected');
            setIsConnected(true);
            connectionManager.current.endConnection(true);
          } else {
            // We're connected to Realtime, but no caller is present yet
            setConnectionState('connecting');
            setIsConnected(false);
          }
          
          setConnectionError(null);
          
          // Announce player has joined
          if (playerCode) {
            channel.send({
              type: 'broadcast',
              event: 'player-join',
              payload: {
                playerCode,
                playerName: playerName || playerCode,
                timestamp: Date.now()
              }
            }).catch(err => {
              console.error("Error sending player join:", err);
            });
          }
        } else if (status === 'CHANNEL_ERROR') {
          logWithTimestamp('Channel error in bingo sync');
          setConnectionState('error');
          setIsConnected(false);
          setConnectionError('Error connecting to game server');
          connectionManager.current.endConnection(false);
          connectionManager.current.scheduleReconnect(setupChannel);
        } else if (status === 'TIMED_OUT') {
          logWithTimestamp('Connection timed out in bingo sync');
          setConnectionState('error');
          setIsConnected(false);
          setConnectionError('Connection timed out');
          connectionManager.current.endConnection(false);
          connectionManager.current.scheduleReconnect(setupChannel);
        } else if (status === 'CLOSED') {
          logWithTimestamp('Channel closed in bingo sync');
          setConnectionState('disconnected');
          setIsConnected(false);
          connectionManager.current.endConnection(false);
          connectionManager.current.scheduleReconnect(setupChannel);
        }
      });
      
      // Check if we have a caller by requesting initial presence state
      channel.track({
        checkPresence: true,
        timestamp: Date.now()
      });
      
      channelRef.current = channel;
    };
    
    // Initialize connection
    setupChannel();
    
    // No cleanup here - will be handled by the component unmount effect
  }, [sessionId, playerCode, playerName, toast]);
  
  // Method to claim bingo with improved handling
  const claimBingo = useCallback((ticketData: any): boolean => {
    if (!sessionId || !channelRef.current || !isConnected || !playerCode) {
      logWithTimestamp(`Cannot claim bingo: ${!sessionId ? 'No session ID' : !channelRef.current ? 'No channel' : !isConnected ? 'Not connected' : 'No player code'}`);
      return false;
    }
    
    try {
      logWithTimestamp(`Claiming bingo for player ${playerCode} in session ${sessionId}`);
      
      // Use the broadcast channel for claim
      channelRef.current.send({
        type: 'broadcast',
        event: 'bingo-claim',
        payload: {
          sessionId,
          playerCode,
          playerName: playerName || playerCode,
          ticketData,
          timestamp: Date.now()
        }
      });
      
      // Show immediate feedback to user
      toast({
        title: "Bingo Claim Sent",
        description: "Your claim has been sent to the caller for verification.",
        duration: 3000
      });
      
      return true;
    } catch (error) {
      console.error('Error claiming bingo:', error);
      toast({
        title: "Claim Failed",
        description: "Unable to send your claim. Please try again.",
        variant: "destructive",
        duration: 3000
      });
      return false;
    }
  }, [sessionId, isConnected, playerCode, playerName, toast]);
  
  // Method to manually reconnect
  const reconnect = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp('Cannot reconnect: No session ID');
      return;
    }
    
    logWithTimestamp('Manual reconnect requested');
    
    // Reset reconnect manager to force a new connection
    connectionManager.current.forceReconnect();
    
    // Clean up existing channel if any
    if (channelRef.current) {
      try {
        logWithTimestamp("Removing existing channel during manual reconnect");
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.error("Error removing channel during manual reconnect:", err);
      }
      channelRef.current = null;
    }
    
    // Set connecting state
    setConnectionState('connecting');
    setConnectionError(null);
    
    // Set up new channel with a short delay to ensure clean reconnection
    setTimeout(() => {
      if (!sessionId) return;
      
      logWithTimestamp("Setting up new channel during manual reconnect");
      const channel = supabase
        .channel(`game-updates-${sessionId}`)
        .on('broadcast', { event: 'game-update' }, (payload) => {
          // Process game updates
          if (payload.payload) {
            const { lastCalledNumber, calledNumbers, currentWinPattern, currentPrize, gameStatus } = payload.payload;
            
            if (calledNumbers && Array.isArray(calledNumbers)) {
              setCalledNumbers(calledNumbers);
            }
            
            if (lastCalledNumber !== undefined && lastCalledNumber !== null) {
              setLastCalledNumber(lastCalledNumber);
            }
            
            if (currentWinPattern) {
              setCurrentWinPattern(currentWinPattern);
            }
            
            if (currentPrize) {
              setCurrentPrize(currentPrize);
            }
            
            if (gameStatus) {
              setGameStatus(gameStatus);
            }
          }
        })
        .on('broadcast', { event: 'caller-online' }, () => {
          callerPresenceRef.current = true;
          setConnectionState('connected');
          setIsConnected(true);
          setConnectionError(null);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const callerPresent = Object.keys(state).some(key => key.startsWith('caller-'));
          
          if (callerPresent) {
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Manual reconnect subscription status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            // Send player presence if we have player code
            if (playerCode) {
              channel.track({
                playerCode,
                playerName: playerName || playerCode,
                online: true,
                timestamp: Date.now()
              });
            }
          } 
        });
      
      channelRef.current = channel;
    }, 100);
  }, [sessionId, playerCode, playerName]);

  // Current game state
  const gameState = {
    lastCalledNumber,
    calledNumbers,
    currentWinPattern,
    currentPrize,
    gameStatus
  };
  
  return {
    gameState,
    isConnected,
    connectionState,
    connectionError,
    connectedPlayers,
    claimBingo,
    reconnect
  };
}
