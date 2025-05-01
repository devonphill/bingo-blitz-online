
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const callerPresenceRef = useRef<boolean>(false);

  // Set up real-time listener for game updates
  useEffect(() => {
    if (!sessionId) {
      setConnectionState('disconnected');
      return;
    }
    
    // Clear any existing reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    logWithTimestamp(`Setting up bingo sync for session: ${sessionId}`);
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
          reconnectCountRef.current = 0;
          
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
          reconnectCountRef.current = 0;
          
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
          } else if (!callerPresent && callerPresenceRef.current) {
            callerPresenceRef.current = false;
            setConnectionState('disconnected');
            setIsConnected(false);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller joined: ${key}`);
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
            
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
      
      // Subscribe to the channel with better error handling
      channel.subscribe(status => {
        logWithTimestamp(`Bingo sync subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // Even if subscribed, we need to check if caller is actually present
          // for reliable connection status - this will be detected via presence events
          
          if (callerPresenceRef.current) {
            setConnectionState('connected');
            setIsConnected(true);
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
          scheduleReconnect();
        } else if (status === 'TIMED_OUT') {
          logWithTimestamp('Connection timed out in bingo sync');
          setConnectionState('error');
          setIsConnected(false);
          setConnectionError('Connection timed out');
          scheduleReconnect();
        } else if (status === 'CLOSED') {
          logWithTimestamp('Channel closed in bingo sync');
          setConnectionState('disconnected');
          setIsConnected(false);
          scheduleReconnect();
        }
      });
      
      // Check if we have a caller by requesting initial presence state
      channel.track({
        checkPresence: true,
        timestamp: Date.now()
      });
      
      channelRef.current = channel;
    };
    
    const scheduleReconnect = () => {
      // Don't reconnect if we've already tried too many times
      if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
        logWithTimestamp(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        setConnectionState('error');
        setConnectionError('Failed to connect after multiple attempts. Please reload the page.');
        return;
      }
      
      reconnectCountRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 30000);
      
      logWithTimestamp(`Scheduling reconnect attempt ${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      reconnectTimerRef.current = setTimeout(() => {
        logWithTimestamp('Attempting reconnection...');
        setConnectionState('connecting');
        setupChannel();
      }, delay);
    };
    
    // Initialize connection
    setupChannel();
    
    // Clean up
    return () => {
      logWithTimestamp('Cleaning up bingo sync');
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.error("Error removing channel during cleanup:", err);
        }
        channelRef.current = null;
      }
    };
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
  }, [sessionId, channelRef, isConnected, playerCode, playerName, toast]);
  
  // Method to manually reconnect with improved error handling
  const reconnect = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp('Cannot reconnect: No session ID');
      return;
    }
    
    logWithTimestamp('Manual reconnect requested');
    
    // Reset reconnect count to give more chances
    reconnectCountRef.current = 0;
    
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
    
    // Set up new channel with a short delay
    setTimeout(() => {
      if (!sessionId) return;
      
      logWithTimestamp("Setting up new channel during manual reconnect");
      const channel = supabase
        .channel(`game-updates-${sessionId}`)
        .on('broadcast', { event: 'game-update' }, (payload) => {
          // ... same handlers as before ...
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
          logWithTimestamp('Received caller-online broadcast during manual reconnect');
          callerPresenceRef.current = true;
          setConnectionState('connected');
          setIsConnected(true);
          setConnectionError(null);
          
          toast({
            title: "Reconnected",
            description: "Successfully reconnected to game server",
            duration: 3000
          });
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const callerPresent = Object.keys(state).some(key => key.startsWith('caller-'));
          
          logWithTimestamp(`Presence sync during manual reconnect. Caller present: ${callerPresent}`);
          
          if (callerPresent) {
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller joined during manual reconnect: ${key}`);
            callerPresenceRef.current = true;
            setConnectionState('connected');
            setIsConnected(true);
            setConnectionError(null);
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Manual reconnect subscription status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            const state = channel.presenceState();
            const callerPresent = Object.keys(state).some(key => key.startsWith('caller-'));
            
            if (callerPresent) {
              callerPresenceRef.current = true;
              setConnectionState('connected');
              setIsConnected(true);
            } else {
              setConnectionState('connecting');
              setIsConnected(false);
            }
            
            setConnectionError(null);
            
            toast({
              title: "Subscription Successful",
              description: callerPresent 
                ? "Successfully reconnected to the game server" 
                : "Connected to server, waiting for caller to join",
              duration: 3000
            });
            
            // Send player presence if we have player code
            if (playerCode) {
              channel.track({
                playerCode,
                playerName: playerName || playerCode,
                online: true,
                timestamp: Date.now()
              });
              
              // Announce player has rejoined
              channel.send({
                type: 'broadcast',
                event: 'player-join',
                payload: {
                  playerCode,
                  playerName: playerName || playerCode,
                  timestamp: Date.now()
                }
              }).catch(err => {
                console.error("Error sending player join during reconnect:", err);
              });
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionState('error');
            setIsConnected(false);
            setConnectionError('Error reconnecting to game server');
            
            toast({
              title: "Reconnect Failed",
              description: "Could not reconnect to game server. Try refreshing the page.",
              variant: "destructive",
              duration: 5000
            });
          }
        });
      
      channelRef.current = channel;
    }, 100);
  }, [sessionId, playerCode, playerName, toast]);

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
