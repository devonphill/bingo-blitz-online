
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';

// Define connection states for better type safety
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Define the context type
interface NetworkContextType {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  
  // Connection management methods
  connect: (sessionId: string) => void;
  disconnect: () => void;
  
  // Listeners
  addNumberCalledListener: (callback: (number: number, allNumbers: number[]) => void) => (() => void);
  addGameStateUpdateListener: (callback: (gameState: any) => void) => (() => void);
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => (() => void);
  addTicketsAssignedListener: (callback: (playerCode: string, tickets: any[]) => void) => (() => void);
  
  // Action methods
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => Promise<boolean>;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
  
  // Session tracking
  sessionId: string | null;
  updatePlayerPresence: (presenceData: any) => Promise<boolean>;
  trackPlayerPresence: (presenceData: any) => Promise<boolean>;
  fetchClaims: (sessionId?: string) => Promise<any[]>;
}

// Create context with default values
const NetworkContext = createContext<NetworkContextType>({
  connectionState: 'disconnected',
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  addNumberCalledListener: () => () => {},
  addGameStateUpdateListener: () => () => {},
  addConnectionStatusListener: () => () => {},
  addTicketsAssignedListener: () => () => {},
  callNumber: async () => false,
  submitBingoClaim: async () => false,
  validateClaim: async () => false,
  sessionId: null,
  updatePlayerPresence: async () => false,
  trackPlayerPresence: async () => false,
  fetchClaims: async () => []
});

// Custom hook to use the NetworkContext
export const useNetwork = () => useContext(NetworkContext);

// Provider component
export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [lastPingTime, setLastPingTime] = useState<number>(0);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [numberCalledListeners] = useState<Array<(number: number, allNumbers: number[]) => void>>([]);
  const [gameStateListeners] = useState<Array<(gameState: any) => void>>([]);
  const [connectionStatusListeners] = useState<Array<(isConnected: boolean) => void>>([]);
  const [ticketsAssignedListeners] = useState<Array<(playerCode: string, tickets: any[]) => void>>([]);
  
  const { toast } = useToast();
  
  // Check if we're connected
  const isConnected = connectionState === 'connected';
  
  // Clean up existing subscriptions
  const cleanupSubscriptions = useCallback(() => {
    channels.forEach(channel => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
          logWithTimestamp(`Removed subscription channel`, 'info');
        } catch (err) {
          logWithTimestamp(`Error removing subscription: ${err}`, 'error');
        }
      }
    });
    
    setChannels([]);
  }, [channels]);
  
  // Connect to session by subscribing to relevant tables and broadcast channels
  const connect = useCallback((newSessionId: string) => {
    // If already connected to this session, do nothing
    if (sessionId === newSessionId && isConnected) {
      logWithTimestamp(`Already connected to session ${newSessionId}`, 'info');
      return;
    }
    
    // Clean up existing subscriptions
    cleanupSubscriptions();
    
    // Set to connecting state
    setConnectionState('connecting');
    setSessionId(newSessionId);
    
    logWithTimestamp(`Connecting to session ${newSessionId}`, 'info');
    
    try {
      // Create a broadcast channel for real-time number calls
      const numberBroadcastChannel = supabase.channel(`number-broadcast-${newSessionId}`);
      
      // Subscribe to broadcast events
      numberBroadcastChannel
        .on('broadcast', { event: 'number-called' }, (payload) => {
          // Only process events meant for this session
          if (payload.payload && payload.payload.sessionId === newSessionId) {
            const { lastCalledNumber, calledNumbers } = payload.payload;
            
            logWithTimestamp(`Received broadcast number: ${lastCalledNumber}`, 'info');
            setLastPingTime(Date.now());
            
            // Notify all listeners
            numberCalledListeners.forEach(listener => {
              try {
                listener(lastCalledNumber, calledNumbers || []);
              } catch (err) {
                console.error('Error in number called listener:', err);
              }
            });
          }
        })
        .on('broadcast', { event: 'game-reset' }, (payload) => {
          // Reset the game state when requested
          if (payload.payload && payload.payload.sessionId === newSessionId) {
            logWithTimestamp(`Received game reset event`, 'info');
            
            // Notify all listeners with null to indicate reset
            numberCalledListeners.forEach(listener => {
              try {
                listener(null, []);
              } catch (err) {
                console.error('Error in game reset listener:', err);
              }
            });
          }
        })
        .on('broadcast', { event: 'game-state-update' }, (payload) => {
          // Process game state updates
          if (payload.payload && payload.payload.sessionId === newSessionId) {
            logWithTimestamp(`Received game state update event`, 'info');
            
            // Notify all game state listeners
            gameStateListeners.forEach(listener => {
              try {
                listener(payload.payload);
              } catch (err) {
                console.error('Error in game state update listener:', err);
              }
            });
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`Broadcast channel subscription status: ${status}`, 'info');
          
          if (status === "SUBSCRIBED") {
            setConnectionState('connected');
            setReconnectAttempts(0);
            
            // Notify connection status listeners
            connectionStatusListeners.forEach(listener => {
              try {
                listener(true);
              } catch (err) {
                console.error('Error in connection status listener:', err);
              }
            });
          } else if (status === "CHANNEL_ERROR") {
            setConnectionState('error');
            
            // Notify connection status listeners
            connectionStatusListeners.forEach(listener => {
              try {
                listener(false);
              } catch (err) {
                console.error('Error in connection status listener:', err);
              }
            });
            
            // Auto-reconnect with exponential backoff
            const delay = Math.min(1000 * (2 ** reconnectAttempts), 30000);
            setTimeout(() => {
              if (reconnectAttempts < 5) {
                setReconnectAttempts(prev => prev + 1);
                connect(newSessionId);
              }
            }, delay);
          }
        });
      
      // Store the channel for cleanup
      setChannels(prev => [...prev, numberBroadcastChannel]);
      
      // Listen for session progress updates through database changes
      const progressChannel = supabase
        .channel(`progress-${newSessionId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'sessions_progress',
            filter: `session_id=eq.${newSessionId}`
          }, 
          (payload) => {
            logWithTimestamp('Received sessions_progress update', 'debug');
            
            // Extract game state from payload
            const newData = payload.new as any;
            
            // Process the update
            if (newData) {
              const gameState = {
                sessionId: newData.session_id,
                gameNumber: newData.current_game_number,
                maxGameNumber: newData.max_game_number,
                gameType: newData.current_game_type,
                calledNumbers: newData.called_numbers || [],
                lastCalledNumber: newData.called_numbers && newData.called_numbers.length > 0 
                  ? newData.called_numbers[newData.called_numbers.length - 1] 
                  : null,
                currentWinPattern: newData.current_win_pattern,
                currentPrize: newData.current_prize,
                gameStatus: newData.game_status
              };
              
              // Notify game state listeners
              gameStateListeners.forEach(listener => {
                try {
                  listener(gameState);
                } catch (err) {
                  console.error('Error in game state listener:', err);
                }
              });
            }
          })
        .subscribe();
      
      // Store the channel for cleanup
      setChannels(prev => [...prev, progressChannel]);
      
      // Listen for claim validation updates
      const claimsChannel = supabase
        .channel(`claims-${newSessionId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'universal_game_logs',
            filter: `session_id=eq.${newSessionId}`
          },
          (payload) => {
            logWithTimestamp('New claim detected', 'info');
            
            // Show notification (to caller)
            toast({
              title: "New Bingo Claim!",
              description: "A new bingo claim has been submitted for verification.",
              duration: 5000
            });
          })
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'universal_game_logs',
            filter: `session_id=eq.${newSessionId}`
          },
          (payload) => {
            logWithTimestamp('Claim update detected', 'info');
            
            // Check if this is a validation update (validated_at is not null)
            if (payload.new && (payload.new as any).validated_at) {
              // This is a claim that has been validated
              // Format a notification based on this
              const claimData = payload.new as any;
              
              toast({
                title: "Claim Validated",
                description: `The bingo claim from ${claimData.player_name || 'a player'} has been processed.`,
                duration: 5000
              });
            }
          })
        .subscribe();
        
      // Store the channel for cleanup  
      setChannels(prev => [...prev, claimsChannel]);
      
      // Start a heartbeat mechanism to check connection health
      const heartbeatInterval = setInterval(() => {
        // Check if the last ping time is too old
        const now = Date.now();
        const lastPing = lastPingTime;
        
        // If we haven't received a ping in 30 seconds, try to reconnect
        if (lastPing > 0 && now - lastPing > 30000 && connectionState === 'connected') {
          logWithTimestamp('Connection heartbeat failed, attempting reconnect', 'warn');
          
          // Clean up and reconnect
          cleanupSubscriptions();
          setConnectionState('connecting');
          connect(newSessionId);
        }
      }, 10000);  // Check every 10 seconds
      
      // Store the interval for cleanup
      const heartbeatIntervalId = heartbeatInterval;
      
      // Return cleanup function
      return () => {
        clearInterval(heartbeatIntervalId);
      };
      
    } catch (err) {
      logWithTimestamp(`Error connecting to session: ${err}`, 'error');
      setConnectionState('error');
      
      // Try to reconnect with exponential backoff
      const delay = Math.min(1000 * (2 ** reconnectAttempts), 30000);
      setTimeout(() => {
        if (reconnectAttempts < 5) {
          setReconnectAttempts(prev => prev + 1);
          connect(newSessionId);
        }
      }, delay);
    }
  }, [sessionId, isConnected, cleanupSubscriptions, numberCalledListeners, 
      gameStateListeners, connectionStatusListeners, lastPingTime, 
      reconnectAttempts, toast]);
  
  // Disconnect method
  const disconnect = useCallback(() => {
    logWithTimestamp('Disconnecting from session', 'info');
    cleanupSubscriptions();
    setSessionId(null);
    setConnectionState('disconnected');
  }, [cleanupSubscriptions]);
  
  // Add Number Called Listener
  const addNumberCalledListener = useCallback((callback: (number: number, allNumbers: number[]) => void) => {
    numberCalledListeners.push(callback);
    logWithTimestamp('Added number called listener', 'debug');
    
    // Return a function to remove this listener
    return () => {
      const index = numberCalledListeners.indexOf(callback);
      if (index !== -1) {
        numberCalledListeners.splice(index, 1);
        logWithTimestamp('Removed number called listener', 'debug');
      }
    };
  }, [numberCalledListeners]);
  
  // Add Game State Update Listener
  const addGameStateUpdateListener = useCallback((callback: (gameState: any) => void) => {
    gameStateListeners.push(callback);
    logWithTimestamp('Added game state listener', 'debug');
    
    // Return a function to remove this listener
    return () => {
      const index = gameStateListeners.indexOf(callback);
      if (index !== -1) {
        gameStateListeners.splice(index, 1);
        logWithTimestamp('Removed game state listener', 'debug');
      }
    };
  }, [gameStateListeners]);
  
  // Add Connection Status Listener
  const addConnectionStatusListener = useCallback((callback: (isConnected: boolean) => void) => {
    connectionStatusListeners.push(callback);
    logWithTimestamp('Added connection status listener', 'debug');
    
    // Return a function to remove this listener
    return () => {
      const index = connectionStatusListeners.indexOf(callback);
      if (index !== -1) {
        connectionStatusListeners.splice(index, 1);
        logWithTimestamp('Removed connection status listener', 'debug');
      }
    };
  }, [connectionStatusListeners]);
  
  // Add Tickets Assigned Listener
  const addTicketsAssignedListener = useCallback((callback: (playerCode: string, tickets: any[]) => void) => {
    ticketsAssignedListeners.push(callback);
    logWithTimestamp('Added tickets assigned listener', 'debug');
    
    // Return a function to remove this listener
    return () => {
      const index = ticketsAssignedListeners.indexOf(callback);
      if (index !== -1) {
        ticketsAssignedListeners.splice(index, 1);
        logWithTimestamp('Removed tickets assigned listener', 'debug');
      }
    };
  }, [ticketsAssignedListeners]);
  
  // Call a bingo number
  const callNumber = useCallback(async (number: number, sessionIdParam?: string) => {
    const targetSessionId = sessionIdParam || sessionId;
    
    if (!targetSessionId) {
      logWithTimestamp('Cannot call number: No session ID', 'error');
      return false;
    }
    
    try {
      // Get current called numbers
      const { data: progressData, error: getError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', targetSessionId)
        .single();
      
      if (getError) {
        logWithTimestamp(`Error getting called numbers: ${getError.message}`, 'error');
        return false;
      }
      
      // Update the called numbers array
      const calledNumbers = progressData?.called_numbers || [];
      if (!calledNumbers.includes(number)) {
        calledNumbers.push(number);
      }
      
      // First, broadcast the number to all connected clients
      // This ensures immediate notification regardless of database latency
      const broadcastChannel = supabase.channel('number-broadcast');
      await broadcastChannel.send({
        type: 'broadcast', 
        event: 'number-called',
        payload: {
          sessionId: targetSessionId,
          lastCalledNumber: number,
          calledNumbers: calledNumbers,
          timestamp: new Date().getTime()
        }
      });
      
      // Then update the database for persistence
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: calledNumbers,
        })
        .eq('session_id', targetSessionId);
      
      if (error) {
        logWithTimestamp(`Error updating called numbers: ${error.message}`, 'error');
        // Even if the database update fails, we still return true because the broadcast was sent
        // The next time we call a number, we'll try to get the current state again
        return true;
      }
      
      logWithTimestamp(`Number ${number} called for session ${targetSessionId}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Exception calling number: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [sessionId]);
  
  // Submit bingo claim
  const submitBingoClaim = useCallback(async (ticket: any, playerCode: string, claimSessionId: string) => {
    if (!ticket || !playerCode || !claimSessionId) {
      logWithTimestamp('Cannot submit claim: Missing required data', 'error');
      return false;
    }
    
    try {
      // Get player info
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('player_code', playerCode)
        .single();
      
      if (playerError) {
        logWithTimestamp(`Error fetching player: ${playerError.message}`, 'error');
        return false;
      }
      
      // Get session info
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', claimSessionId)
        .single();
      
      if (sessionError) {
        logWithTimestamp(`Error fetching session: ${sessionError.message}`, 'error');
        return false;
      }
      
      // Get session progress for current game number and called numbers
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', claimSessionId)
        .single();
      
      if (progressError) {
        logWithTimestamp(`Error fetching progress: ${progressError.message}`, 'error');
        return false;
      }
      
      // Insert claim record
      const { data: claimData, error: claimError } = await supabase
        .from('universal_game_logs')
        .insert([
          {
            session_id: claimSessionId,
            player_id: playerData.id,
            player_name: playerData.nickname || playerCode,
            player_email: playerData.email,
            game_number: progressData.current_game_number,
            game_type: sessionData.game_type,
            win_pattern: progressData.current_win_pattern,
            prize: progressData.current_prize,
            prize_amount: progressData.current_prize,
            called_numbers: progressData.called_numbers,
            total_calls: progressData.called_numbers?.length || 0,
            last_called_number: progressData.called_numbers?.length > 0 
              ? progressData.called_numbers[progressData.called_numbers.length - 1]
              : null,
            ticket_serial: ticket.serial,
            ticket_perm: ticket.perm,
            ticket_position: ticket.position,
            ticket_layout_mask: ticket.layoutMask,
            ticket_numbers: ticket.numbers
          }
        ])
        .select()
        .single();
        
      if (claimError) {
        logWithTimestamp(`Error submitting claim: ${claimError.message}`, 'error');
        return false;
      }
      
      // Broadcast the claim event through a separate channel
      const broadcastChannel = supabase.channel('claim-broadcast');
      await broadcastChannel.send({
        type: 'broadcast', 
        event: 'bingo-claimed',
        payload: {
          sessionId: claimSessionId,
          claimId: claimData.id,
          playerCode,
          playerName: playerData.nickname || playerCode,
          timestamp: new Date().getTime()
        }
      });
      
      logWithTimestamp(`Bingo claim submitted successfully by ${playerCode}`, 'info');
      
      // Show notification to player submitting claim
      toast({
        title: "Bingo Claim Submitted!",
        description: "Your claim has been submitted for verification.",
        duration: 5000
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Exception submitting claim: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [toast]);
  
  // Validate a claim
  const validateClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!claim || !claim.id) {
      logWithTimestamp('Cannot validate claim: Invalid claim data', 'error');
      return false;
    }
    
    try {
      // Update the claim record
      const { error } = await supabase
        .from('universal_game_logs')
        .update({
          validated_at: new Date().toISOString(),
          prize_shared: false  // Default to false, can be updated later
        })
        .eq('id', claim.id);
      
      if (error) {
        logWithTimestamp(`Error validating claim: ${error.message}`, 'error');
        return false;
      }
      
      // Broadcast the validation result
      const broadcastChannel = supabase.channel('claim-validation-broadcast');
      await broadcastChannel.send({
        type: 'broadcast', 
        event: isValid ? 'claim-validated' : 'claim-rejected',
        payload: {
          claimId: claim.id,
          playerId: claim.player_id,
          playerCode: claim.player_code,
          playerName: claim.player_name,
          isValid,
          timestamp: new Date().getTime()
        }
      });
      
      logWithTimestamp(`Claim ${claim.id} ${isValid ? 'validated' : 'rejected'}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Exception validating claim: ${(error as Error).message}`, 'error');
      return false;
    }
  }, []);
  
  // Update player presence without using the presence table
  const updatePlayerPresence = useCallback(async (presenceData: any) => {
    if (!presenceData || !sessionId) {
      logWithTimestamp('Cannot update presence: Missing data', 'error');
      return false;
    }
    
    try {
      // Instead of storing in a database, broadcast presence to the caller
      const broadcastChannel = supabase.channel('player-presence-broadcast');
      await broadcastChannel.send({
        type: 'broadcast', 
        event: 'player-presence-update',
        payload: {
          sessionId,
          ...presenceData,
          timestamp: new Date().getTime()
        }
      });
      
      logWithTimestamp(`Player presence broadcast sent for ${presenceData.player_code || presenceData.nickname}`, 'debug');
      return true;
    } catch (error) {
      logWithTimestamp(`Exception updating player presence: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [sessionId]);
  
  // Legacy method for backward compatibility
  const trackPlayerPresence = useCallback(async (presenceData: any) => {
    return updatePlayerPresence(presenceData);
  }, [updatePlayerPresence]);
  
  // Fetch pending claims for a session
  const fetchClaims = useCallback(async (fetchSessionId?: string) => {
    try {
      const targetSessionId = fetchSessionId || sessionId;
      if (!targetSessionId) {
        logWithTimestamp('Cannot fetch claims: No session ID', 'error');
        return [];
      }
      
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', targetSessionId)
        .is('validated_at', null);
      
      if (error) {
        logWithTimestamp(`Error fetching claims: ${error.message}`, 'error');
        return [];
      }
      
      return data || [];
    } catch (error) {
      logWithTimestamp(`Exception fetching claims: ${(error as Error).message}`, 'error');
      return [];
    }
  }, [sessionId]);

  // Context value
  const contextValue = {
    connectionState,
    isConnected,
    connect,
    disconnect,
    addNumberCalledListener,
    addGameStateUpdateListener,
    addConnectionStatusListener,
    addTicketsAssignedListener,
    callNumber,
    submitBingoClaim,
    validateClaim,
    sessionId,
    updatePlayerPresence,
    trackPlayerPresence,
    fetchClaims
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};
