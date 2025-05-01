
import { useState, useEffect, useRef } from 'react';
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
  
  const channelRef = useRef<any>(null);
  const { toast } = useToast();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

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
          logWithTimestamp('Caller is online');
          setConnectionState('connected');
          setIsConnected(true);
          reconnectCountRef.current = 0;
          
          toast({
            title: "Caller Connected",
            description: "The caller is now online and ready to call numbers",
            duration: 3000
          });
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const keys = Object.keys(state);
          
          // Check if caller is present
          const callerPresent = keys.some(key => key.startsWith('caller-'));
          
          logWithTimestamp(`Presence sync. Caller present: ${callerPresent}. Keys: ${keys.join(', ')}`);
          
          if (callerPresent) {
            setConnectionState('connected');
            setIsConnected(true);
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller joined: ${key}`);
            setConnectionState('connected');
            setIsConnected(true);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key.startsWith('caller-')) {
            logWithTimestamp(`Caller left: ${key}`);
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
          setConnectionState('connected');
          setIsConnected(true);
          setConnectionError(null);
          reconnectCountRef.current = 0;
          
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
      
      channelRef.current = channel;
    };
    
    const scheduleReconnect = () => {
      // Don't reconnect if we've already tried too many times
      if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
        logWithTimestamp(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        setConnectionState('error');
        setConnectionError('Failed to connect after multiple attempts');
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
  
  // Method to claim bingo
  const claimBingo = (ticketData: any): boolean => {
    if (!sessionId || !channelRef.current || !isConnected || !playerCode) {
      logWithTimestamp(`Cannot claim bingo: ${!sessionId ? 'No session ID' : !channelRef.current ? 'No channel' : !isConnected ? 'Not connected' : 'No player code'}`);
      return false;
    }
    
    try {
      logWithTimestamp(`Claiming bingo for player ${playerCode} in session ${sessionId}`);
      
      // Use the broadcast channel used by caller
      const result = channelRef.current.send({
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
      
      return true;
    } catch (error) {
      console.error('Error claiming bingo:', error);
      return false;
    }
  };
  
  // Method to manually reconnect
  const reconnect = () => {
    if (sessionId) {
      logWithTimestamp('Manual reconnect requested');
      
      // Reset reconnect count to give more chances
      reconnectCountRef.current = 0;
      
      // Clean up existing channel if any
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.error("Error removing channel during manual reconnect:", err);
        }
        channelRef.current = null;
      }
      
      // Set connecting state and setup a new channel
      setConnectionState('connecting');
      
      // We're wrapping this in a timeout to ensure the component has time to update its state
      setTimeout(() => {
        if (sessionId) {
          const channel = supabase
            .channel(`game-updates-${sessionId}`)
            .on('broadcast', { event: 'game-update' }, (payload) => {
              // ... same handlers as before ...
              logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
              
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
              logWithTimestamp('Caller is online (from manual reconnect)');
              setConnectionState('connected');
              setIsConnected(true);
              
              toast({
                title: "Reconnected",
                description: "Successfully reconnected to game server",
                duration: 3000
              });
            })
            .subscribe((status) => {
              logWithTimestamp(`Manual reconnect subscription status: ${status}`);
              
              if (status === 'SUBSCRIBED') {
                setConnectionState('connected');
                setIsConnected(true);
                setConnectionError(null);
                
                toast({
                  title: "Reconnected",
                  description: "Successfully reconnected to game server",
                  duration: 3000
                });
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
            
          // Send player presence if we have player code
          if (playerCode) {
            channel.track({
              playerCode,
              playerName: playerName || playerCode,
              online: true,
              timestamp: Date.now()
            });
          }
          
          channelRef.current = channel;
        }
      }, 100);
    }
  };

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
    claimBingo,
    reconnect
  };
}
