
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
  addNumberCalledListener: (callback: (number: number, allNumbers: number[]) => void) => () => void;
  addGameStateUpdateListener: (callback: (gameState: any) => void) => () => void;
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => () => void;
  
  // Action methods
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => Promise<boolean>;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
  
  // Session tracking
  sessionId: string | null;
  updatePlayerPresence: (presenceData: any) => Promise<boolean>;
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
  callNumber: async () => false,
  submitBingoClaim: async () => false,
  validateClaim: async () => false,
  sessionId: null,
  updatePlayerPresence: async () => false,
  fetchClaims: async () => []
});

// Custom hook to use the NetworkContext
export const useNetwork = () => useContext(NetworkContext);

// Provider component
export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const { toast } = useToast();

  // Event listeners storage
  const [numberCalledListeners] = useState<Array<(number: number, allNumbers: number[]) => void>>([]);
  const [gameStateListeners] = useState<Array<(gameState: any) => void>>([]);
  const [connectionStatusListeners] = useState<Array<(isConnected: boolean) => void>>([]);
  
  // Check if we're connected
  const isConnected = connectionState === 'connected';
  
  // Clean up existing subscriptions
  const cleanupSubscriptions = useCallback(() => {
    subscriptions.forEach(subscription => {
      if (subscription && subscription.subscription) {
        try {
          supabase.removeChannel(subscription.channel);
          logWithTimestamp(`Removed subscription channel`, 'info');
        } catch (err) {
          logWithTimestamp(`Error removing subscription: ${err}`, 'error');
        }
      }
    });
    
    setSubscriptions([]);
  }, [subscriptions]);
  
  // Connect to session by subscribing to relevant tables
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
    
    logWithTimestamp(`Connecting to session ${newSessionId} via database subscriptions`, 'info');
    
    try {
      // Subscribe to sessions_progress table
      const progressChannel = supabase
        .channel(`progress_${newSessionId}`)
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
                  logWithTimestamp(`Error in game state listener: ${err}`, 'error');
                }
              });
              
              // If there's a new number called, notify number called listeners
              if (newData.called_numbers && newData.called_numbers.length > 0) {
                const lastNumber = newData.called_numbers[newData.called_numbers.length - 1];
                numberCalledListeners.forEach(listener => {
                  try {
                    listener(lastNumber, newData.called_numbers);
                  } catch (err) {
                    logWithTimestamp(`Error in number called listener: ${err}`, 'error');
                  }
                });
              }
            }
          })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            logWithTimestamp(`Subscribed to sessions_progress for session ${newSessionId}`, 'info');
            setConnectionState('connected');
            
            // Notify connection status listeners
            connectionStatusListeners.forEach(listener => {
              try {
                listener(true);
              } catch (err) {
                logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
              }
            });
          } else {
            logWithTimestamp(`Sessions progress subscription status: ${status}`, 'info');
          }
        });
      
      // Store subscription for cleanup
      setSubscriptions(prev => [...prev, { channel: progressChannel, subscription: progressChannel.subscription }]);
      
      // Subscribe to player_presence table for player updates
      const presenceQueryString = `session_id=eq.${newSessionId}`;
      const presenceChannel = supabase
        .channel(`presence_${newSessionId}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'player_presence',
            filter: presenceQueryString
          },
          async () => {
            // When player presence changes, fetch all players for this session
            try {
              const { data } = await supabase
                .from('player_presence')
                .select('*')
                .eq('session_id', newSessionId);
              
              // Notify any player listeners
              if (data) {
                logWithTimestamp(`Player presence update: ${data.length} players`, 'debug');
              }
            } catch (err) {
              logWithTimestamp(`Error fetching players after presence update: ${err}`, 'error');
            }
          })
        .subscribe();
      
      // Store subscription for cleanup
      setSubscriptions(prev => [...prev, { channel: presenceChannel, subscription: presenceChannel.subscription }]);
    } catch (error) {
      logWithTimestamp(`Error setting up subscriptions: ${error}`, 'error');
      setConnectionState('error');
      
      // Notify connection status listeners
      connectionStatusListeners.forEach(listener => {
        try {
          listener(false);
        } catch (err) {
          logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
        }
      });
    }
  }, [sessionId, isConnected, cleanupSubscriptions, connectionStatusListeners, gameStateListeners, numberCalledListeners]);

  // Disconnect and clean up subscriptions
  const disconnect = useCallback(() => {
    cleanupSubscriptions();
    setConnectionState('disconnected');
    setSessionId(null);
    
    // Notify connection status listeners
    connectionStatusListeners.forEach(listener => {
      try {
        listener(false);
      } catch (err) {
        logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
      }
    });
  }, [cleanupSubscriptions, connectionStatusListeners]);

  // Call a bingo number
  const callNumber = useCallback(async (number: number, targetSessionId?: string) => {
    const sid = targetSessionId || sessionId;
    
    if (!sid) {
      logWithTimestamp('Cannot call number: No session ID', 'error');
      return false;
    }
    
    try {
      // Get current session progress
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sid)
        .single();
        
      if (progressError) {
        logWithTimestamp(`Error getting session progress: ${progressError.message}`, 'error');
        return false;
      }
      
      // Update called numbers array
      const calledNumbers = progressData?.called_numbers || [];
      
      // Don't add the number if it's already been called
      if (!calledNumbers.includes(number)) {
        calledNumbers.push(number);
      }
      
      // Update the database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: calledNumbers })
        .eq('session_id', sid);
        
      if (error) {
        logWithTimestamp(`Error updating called numbers: ${error.message}`, 'error');
        return false;
      }
      
      logWithTimestamp(`Number ${number} called for session ${sid}`);
      return true;
    } catch (error) {
      logWithTimestamp(`Exception calling number: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [sessionId]);

  // Submit a bingo claim
  const submitBingoClaim = useCallback(async (ticket: any, playerCode: string, targetSessionId: string) => {
    if (!ticket || !playerCode || !targetSessionId) {
      logWithTimestamp('Cannot submit claim: missing required data', 'error');
      return false;
    }
    
    try {
      // Get player info
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, nickname')
        .eq('player_code', playerCode)
        .single();
        
      if (playerError) {
        logWithTimestamp(`Error getting player info: ${playerError.message}`, 'error');
        return false;
      }
      
      if (!playerData) {
        logWithTimestamp(`Player not found with code ${playerCode}`, 'error');
        return false;
      }
      
      // Get session progress info
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_game_number, called_numbers, current_game_type, current_win_pattern')
        .eq('session_id', targetSessionId)
        .single();
        
      if (progressError) {
        logWithTimestamp(`Error getting session progress: ${progressError.message}`, 'error');
        return false;
      }
      
      // Submit claim to universal_game_logs
      const { error: claimError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: targetSessionId,
          player_id: playerData.id,
          player_name: playerData.nickname || playerCode,
          game_number: progressData.current_game_number,
          game_type: progressData.current_game_type,
          win_pattern: progressData.current_win_pattern || 'bingo',
          called_numbers: progressData.called_numbers,
          total_calls: progressData.called_numbers ? progressData.called_numbers.length : 0,
          last_called_number: progressData.called_numbers && progressData.called_numbers.length > 0 
            ? progressData.called_numbers[progressData.called_numbers.length - 1] 
            : null,
          ticket_serial: ticket.serial || ticket.id,
          ticket_perm: ticket.perm,
          ticket_position: ticket.position,
          ticket_layout_mask: ticket.layoutMask || ticket.layout_mask,
          ticket_numbers: ticket.numbers,
          claimed_at: new Date().toISOString()
        });
        
      if (claimError) {
        logWithTimestamp(`Error submitting claim: ${claimError.message}`, 'error');
        return false;
      }
      
      toast({
        title: "Bingo Claim Submitted",
        description: "Your claim has been submitted and is being verified.",
      });
      
      logWithTimestamp(`Claim submitted for player ${playerCode} in session ${targetSessionId}`);
      return true;
    } catch (error) {
      logWithTimestamp(`Exception submitting claim: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [toast]);

  // Validate a bingo claim
  const validateClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!claim || !claim.id) {
      logWithTimestamp('Cannot validate claim: No claim ID provided', 'error');
      return false;
    }
    
    try {
      // Update the claim in the database
      const { error } = await supabase
        .from('universal_game_logs')
        .update({
          validated_at: isValid ? new Date().toISOString() : null,
          prize_shared: false
        })
        .eq('id', claim.id);
        
      if (error) {
        logWithTimestamp(`Error validating claim: ${error.message}`, 'error');
        return false;
      }
      
      // Show toast notification
      toast({
        title: isValid ? "Claim Verified" : "Claim Rejected",
        description: isValid
          ? `The bingo claim for ${claim.player_name || claim.playerName} has been verified.`
          : `The bingo claim for ${claim.player_name || claim.playerName} has been rejected.`,
        variant: isValid ? "default" : "destructive",
      });
      
      logWithTimestamp(`Claim ${claim.id} ${isValid ? 'verified' : 'rejected'}`);
      return true;
    } catch (error) {
      logWithTimestamp(`Exception validating claim: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [toast]);

  // Update player presence
  const updatePlayerPresence = useCallback(async (presenceData: any) => {
    if (!sessionId) {
      logWithTimestamp('Cannot update presence: No session ID', 'error');
      return false;
    }
    
    if (!presenceData || !presenceData.player_id) {
      logWithTimestamp('Cannot update presence: Missing player data', 'error');
      return false;
    }
    
    try {
      // Check if the player already has a presence record
      const { data, error: selectError } = await supabase
        .from('player_presence')
        .select('id')
        .eq('session_id', sessionId)
        .eq('player_id', presenceData.player_id)
        .maybeSingle();
        
      if (selectError) {
        logWithTimestamp(`Error checking player presence: ${selectError.message}`, 'error');
        return false;
      }
      
      if (data) {
        // Update existing presence record
        const { error } = await supabase
          .from('player_presence')
          .update({
            last_seen_at: new Date().toISOString()
          })
          .eq('id', data.id);
          
        if (error) {
          logWithTimestamp(`Error updating player presence: ${error.message}`, 'error');
          return false;
        }
      } else {
        // Insert new presence record
        const { error } = await supabase
          .from('player_presence')
          .insert({
            session_id: sessionId,
            player_id: presenceData.player_id,
            player_code: presenceData.player_code,
            nickname: presenceData.nickname,
            last_seen_at: new Date().toISOString()
          });
          
        if (error) {
          logWithTimestamp(`Error inserting player presence: ${error.message}`, 'error');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Exception updating player presence: ${(error as Error).message}`, 'error');
      return false;
    }
  }, [sessionId]);

  // Fetch pending claims
  const fetchClaims = useCallback(async (targetSessionId?: string) => {
    const sid = targetSessionId || sessionId;
    
    if (!sid) {
      logWithTimestamp('Cannot fetch claims: No session ID', 'error');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sid)
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

  // Add number called listener
  const addNumberCalledListener = useCallback((callback: (number: number, allNumbers: number[]) => void) => {
    numberCalledListeners.push(callback);
    return () => {
      const index = numberCalledListeners.indexOf(callback);
      if (index !== -1) {
        numberCalledListeners.splice(index, 1);
      }
    };
  }, [numberCalledListeners]);

  // Add game state update listener
  const addGameStateUpdateListener = useCallback((callback: (gameState: any) => void) => {
    gameStateListeners.push(callback);
    return () => {
      const index = gameStateListeners.indexOf(callback);
      if (index !== -1) {
        gameStateListeners.splice(index, 1);
      }
    };
  }, [gameStateListeners]);

  // Add connection status listener
  const addConnectionStatusListener = useCallback((callback: (isConnected: boolean) => void) => {
    connectionStatusListeners.push(callback);
    return () => {
      const index = connectionStatusListeners.indexOf(callback);
      if (index !== -1) {
        connectionStatusListeners.splice(index, 1);
      }
    };
  }, [connectionStatusListeners]);

  // Provide context value
  const contextValue = {
    connectionState,
    isConnected,
    connect,
    disconnect,
    addNumberCalledListener,
    addGameStateUpdateListener,
    addConnectionStatusListener,
    callNumber,
    submitBingoClaim,
    validateClaim,
    sessionId,
    updatePlayerPresence,
    fetchClaims
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};
