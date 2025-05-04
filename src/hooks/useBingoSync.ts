
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { toast } from '@/hooks/use-toast';

// Define the connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useBingoSync(playerCode: string | null, sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [gameState, setGameState] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');

  // Keep track of channel subscription
  const channelRef = useRef<any>(null);
  const claimChannelRef = useRef<any>(null);
  
  // Track connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  
  // Track if setup is complete to prevent reconnection loops
  const setupCompleteRef = useRef<boolean>(false);
  
  // Track the connection retry count
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3; // Maximum number of automatic retries
  const reconnectTimeoutRef = useRef<any>(null);
  
  // Function to reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Simple reconnect function with improved handling
  const reconnect = useCallback(() => {
    // Don't reconnect if we've maxed out automatic retries
    if (retryCountRef.current >= maxRetries) {
      logWithTimestamp(`Maximum reconnection attempts (${maxRetries}) reached for player ${playerCode}`);
      setConnectionState('error');
      setError(`Connection failed after ${maxRetries} attempts`);
      return;
    }
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    logWithTimestamp(`Manual reconnection requested for player ${playerCode} (attempt ${retryCountRef.current + 1})`);
    retryCountRef.current++;
    
    // Clean up existing channels
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        logWithTimestamp(`Removed existing channel for player ${playerCode}`);
      } catch (err) {
        console.error("Error removing channel during reconnect:", err);
      }
    }
    
    if (claimChannelRef.current) {
      try {
        supabase.removeChannel(claimChannelRef.current);
        claimChannelRef.current = null;
        logWithTimestamp(`Removed existing claim channel for player ${playerCode}`);
      } catch (err) {
        console.error("Error removing claim channel during reconnect:", err);
      }
    }
    
    // Reset setup complete flag
    setupCompleteRef.current = false;
    
    // Set state to trigger reconnection in useEffect
    setConnectionState('connecting');
  }, [playerCode]);

  // Set up the connection to the session with improved stability
  useEffect(() => {
    // Skip setup if invalid parameters or already set up
    if (!playerCode || !sessionId || setupCompleteRef.current) {
      if (!playerCode || !sessionId) {
        setIsLoading(false);
      }
      return;
    }

    // Clear error state and set connecting state
    setError('');
    setIsLoading(true);
    setIsConnected(false);
    
    // Only log once per setup
    logWithTimestamp(`Setting up connection for player ${playerCode} to session ${sessionId}`);
    
    // Generate a unique channel name with timestamp to prevent reuse issues
    const channelName = `game-updates-${playerCode}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Set up a dedicated channel for game updates
    const gameChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'number-called' }, payload => {
        // Check if this update is for our session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received number-called update for session ${sessionId}: ${payload.payload.lastCalledNumber}`);
          
          // Update game state with called numbers
          setGameState(prev => ({
            ...prev,
            calledNumbers: payload.payload.calledNumbers || [],
            lastCalledNumber: payload.payload.lastCalledNumber
          }));
          
          // Update connection status
          setIsConnected(true);
          setConnectionState('connected');
          
          // Show toast for new number called
          if (payload.payload.lastCalledNumber) {
            toast({
              title: `Number Called: ${payload.payload.lastCalledNumber}`,
              description: "New number has been called",
              duration: 3000
            });
          }
        }
      })
      .on('broadcast', { event: 'pattern-change' }, payload => {
        // Check if this update is for our session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received pattern-change update for session ${sessionId}: ${payload.payload.pattern}`);
          
          // Update game state with new pattern
          setGameState(prev => ({
            ...prev,
            currentWinPattern: payload.payload.pattern
          }));
        }
      })
      .on('presence', { event: 'sync' }, () => {
        logWithTimestamp(`Presence sync event received for channel ${channelName}`);
        setIsConnected(true);
        setConnectionState('connected');
      })
      .on('presence', { event: 'join' }, () => {
        logWithTimestamp(`Presence join event received for channel ${channelName}`);
        setIsConnected(true);
        setConnectionState('connected');
      });

    // Subscribe to the game updates channel
    gameChannel.subscribe(status => {
      logWithTimestamp(`Channel ${channelName} subscription status: ${status}`);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionState('connected');
        setIsLoading(false);
        setupCompleteRef.current = true;
        retryCountRef.current = 0; // Reset retry counter on success
      } else if (status === 'CHANNEL_ERROR') {
        setError('Error connecting to game updates');
        setConnectionState('error');
        setIsConnected(false);
        setIsLoading(false);
        
        // Schedule reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(reconnect, delay);
      } else if (status === 'TIMED_OUT') {
        setError('Connection timed out');
        setConnectionState('error');
        setIsConnected(false);
        setIsLoading(false);
        
        // Schedule reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(reconnect, delay);
      } else if (status === 'CLOSED') {
        // Only trigger reconnect if we were previously connected and setup was complete
        if (setupCompleteRef.current && isConnected) {
          logWithTimestamp(`Channel ${channelName} closed unexpectedly`);
          setConnectionState('disconnected');
          setIsConnected(false);
          
          // Schedule reconnect with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(reconnect, delay);
        }
      }
    });

    // Store the channel reference for cleanup
    channelRef.current = gameChannel;

    // Set up a dedicated channel for claim results
    const claimsChannelName = `claims-${sessionId}-${playerCode}`;
    const claimsChannel = supabase
      .channel(claimsChannelName)
      .on('broadcast', { event: 'claim-result' }, payload => {
        // Process claim results matching our player
        if (payload.payload?.playerId === playerCode || payload.payload?.playerId === playerId) {
          logWithTimestamp(`Received claim result for player ${playerCode}: ${payload.payload.result}`);
          
          const result = payload.payload.result;
          
          if (result === 'valid') {
            setClaimStatus('valid');
            toast({
              title: "Bingo Verified!",
              description: "Your bingo claim has been verified!",
              variant: "default"
            });
          } else if (result === 'rejected' || result === 'invalid') {
            setClaimStatus('invalid');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not verified.",
              variant: "destructive"
            });
          }
          
          setIsSubmittingClaim(false);
        }
      });

    // Subscribe to the claims channel
    claimsChannel.subscribe(status => {
      logWithTimestamp(`Claims channel ${claimsChannelName} subscription status: ${status}`);
    });

    // Store the claims channel reference
    claimChannelRef.current = claimsChannel;

    // Get player info
    const getPlayerInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerCode)
          .single();

        if (error) throw error;

        if (data) {
          setPlayerId(data.id);
          setPlayerName(data.nickname || playerCode);
        }
      } catch (err) {
        console.error('Error fetching player info:', err);
      }
    };

    // Get session info
    const getSessionInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) throw error;

        if (data) {
          setCurrentSession(data);
        }
      } catch (err) {
        console.error('Error fetching session info:', err);
      }
    };

    // Initialize data
    Promise.all([getPlayerInfo(), getSessionInfo()]).then(() => {
      logWithTimestamp(`Initial data loaded for player ${playerCode}`);
    });

    // Send a simple heartbeat every 30 seconds to keep the connection alive
    const heartbeatInterval = setInterval(() => {
      if (channelRef.current && connectionState === 'connected') {
        try {
          // Use Promise.resolve() to get a full Promise object
          Promise.resolve(
            channelRef.current.send({
              type: 'broadcast',
              event: 'heartbeat',
              payload: { playerCode, timestamp: Date.now() }
            })
          ).catch(err => {
            console.error('Heartbeat error:', err);
            reconnect();
          });
        } catch (err) {
          console.error('Error sending heartbeat:', err);
        }
      }
    }, 15000);

    // Cleanup on unmount
    return () => {
      logWithTimestamp(`Cleaning up channels for player ${playerCode}`);
      clearInterval(heartbeatInterval);
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        try {
          logWithTimestamp(`Cleaning up game channel for player ${playerCode}`);
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error("Error removing game channel during cleanup:", err);
        }
      }
      
      if (claimChannelRef.current) {
        try {
          logWithTimestamp(`Cleaning up claims channel for player ${playerCode}`);
          supabase.removeChannel(claimChannelRef.current);
          claimChannelRef.current = null;
        } catch (err) {
          console.error("Error removing claims channel during cleanup:", err);
        }
      }
      
      // Reset the setup complete flag
      setupCompleteRef.current = false;
    };
  }, [playerCode, sessionId, reconnect, playerId, isConnected]);

  // Function to submit a bingo claim with improved error handling
  const submitBingoClaim = useCallback((ticketData: any) => {
    if (!playerCode || !sessionId || !playerName) {
      console.error('Missing player info for claim');
      return false;
    }

    try {
      logWithTimestamp(`Player ${playerCode} submitting bingo claim`);
      
      setIsSubmittingClaim(true);
      setClaimStatus('pending');

      // Add a timestamp to the payload for uniqueness
      const timestamp = new Date().toISOString();
      const uniqueId = `claim-${playerCode}-${timestamp}`;
      
      // Use a global bingo-broadcast channel that callers will be listening to
      const broadcastChannel = supabase.channel('bingo-broadcast');
      
      // Prepare the claim data
      const claimData = {
        id: uniqueId,
        sessionId,
        playerId: playerId || playerCode,
        playerName: playerName || playerCode,
        ticketData,
        timestamp
      };
      
      logWithTimestamp(`Broadcasting bingo claim: ${JSON.stringify(claimData)}`);
      
      // Use Promise.resolve() to get a full Promise object with catch method
      Promise.resolve(
        broadcastChannel.send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: claimData
        })
      ).then(() => {
        logWithTimestamp('Claim broadcast sent successfully');
        
        toast({
          title: "Bingo Claim Submitted",
          description: "Your claim has been submitted and is pending verification.",
          duration: 5000
        });
        
        // Set a timeout to reset claim status if no response
        setTimeout(() => {
          if (claimStatus === 'pending') {
            setClaimStatus('none');
            setIsSubmittingClaim(false);
            
            toast({
              title: "Claim Verification Timeout",
              description: "No response received for your claim. Please try again.",
              variant: "destructive",
              duration: 5000
            });
          }
        }, 10000);
      }).catch(error => {
        console.error('Error broadcasting claim:', error);
        setClaimStatus('none');
        setIsSubmittingClaim(false);
        
        toast({
          title: "Claim Error",
          description: "Failed to submit your bingo claim. Please try again.",
          variant: "destructive"
        });
      });

      return true;
    } catch (error) {
      console.error('Error submitting claim:', error);
      setClaimStatus('none');
      setIsSubmittingClaim(false);
      return false;
    }
  }, [playerCode, sessionId, playerId, playerName, claimStatus]);

  return {
    isLoading,
    isConnected,
    connectionState,
    error,
    playerId,
    playerName,
    gameState,
    currentSession,
    submitBingoClaim,
    isSubmittingClaim,
    claimStatus,
    resetClaimStatus,
    reconnect
  };
}
