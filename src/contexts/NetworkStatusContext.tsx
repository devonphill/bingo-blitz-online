
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
  updatePlayerPresence: async () => false
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
          }
        )
        .subscribe((status) => {
          logWithTimestamp(`Sessions progress subscription status: ${status}`, 'info');
          
          if (status === 'SUBSCRIBED') {
            setConnectionState('connected');
            
            // Notify connection status listeners
            connectionStatusListeners.forEach(listener => {
              try {
                listener(true);
              } catch (err) {
                logWithTimestamp(`Error in connection status listener: ${err}`, 'error');
              }
            });
          } else if (status === 'CHANNEL_ERROR') {
            logWithTimestamp(`Error connecting to sessions_progress channel`, 'error');
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
        });
      
      // Subscribe to player_presence table
      const presenceChannel = supabase
        .channel(`presence_${newSessionId}`)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'player_presence',
            filter: `session_id=eq.${newSessionId}`
          },
          (payload) => {
            // This is a placeholder for player presence updates
            // We'll implement a more detailed presence system later
            logWithTimestamp('Received player presence update', 'debug');
          }
        )
        .subscribe();
      
      // Subscribe to universal_game_logs table for bingo claims
      const claimsChannel = supabase
        .channel(`claims_${newSessionId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'universal_game_logs',
            filter: `session_id=eq.${newSessionId}`
          },
          (payload) => {
            // Process bingo claims
            logWithTimestamp('Received new bingo claim', 'info');
            // This will be processed separately by specialized hooks
          }
        )
        .subscribe();
      
      // Store all subscriptions for cleanup
      setSubscriptions([
        { channel: progressChannel, type: 'progress' },
        { channel: presenceChannel, type: 'presence' },
        { channel: claimsChannel, type: 'claims' }
      ]);
      
    } catch (err) {
      logWithTimestamp(`Error setting up database subscriptions: ${err}`, 'error');
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
  
  // Disconnect by removing all subscriptions
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
  
  // Add a number called listener
  const addNumberCalledListener = useCallback(
    (callback: (number: number, allNumbers: number[]) => void) => {
      numberCalledListeners.push(callback);
      return () => {
        const index = numberCalledListeners.indexOf(callback);
        if (index !== -1) {
          numberCalledListeners.splice(index, 1);
        }
      };
    },
    [numberCalledListeners]
  );
  
  // Add a game state update listener
  const addGameStateUpdateListener = useCallback(
    (callback: (gameState: any) => void) => {
      gameStateListeners.push(callback);
      return () => {
        const index = gameStateListeners.indexOf(callback);
        if (index !== -1) {
          gameStateListeners.splice(index, 1);
        }
      };
    },
    [gameStateListeners]
  );
  
  // Add a connection status listener
  const addConnectionStatusListener = useCallback(
    (callback: (isConnected: boolean) => void) => {
      connectionStatusListeners.push(callback);
      // Immediately call with current state
      callback(connectionState === 'connected');
      return () => {
        const index = connectionStatusListeners.indexOf(callback);
        if (index !== -1) {
          connectionStatusListeners.splice(index, 1);
        }
      };
    },
    [connectionState, connectionStatusListeners]
  );
  
  // Call a number by updating the database directly
  const callNumber = useCallback(
    async (number: number, targetSessionId?: string): Promise<boolean> => {
      const effectiveSessionId = targetSessionId || sessionId;
      
      if (!effectiveSessionId) {
        logWithTimestamp('Cannot call number: No session ID available', 'error');
        toast({
          title: "Error",
          description: "Cannot call number: No active session",
          variant: "destructive"
        });
        return false;
      }
      
      try {
        logWithTimestamp(`Calling number ${number} for session ${effectiveSessionId} via database update`, 'info');
        
        // Get current session progress first
        const { data: progressData, error: progressError } = await supabase
          .from('sessions_progress')
          .select('called_numbers')
          .eq('session_id', effectiveSessionId)
          .single();
        
        if (progressError) {
          throw progressError;
        }
        
        // Add the new number to the called numbers array
        const calledNumbers = progressData.called_numbers || [];
        
        // Check if number is already called
        if (calledNumbers.includes(number)) {
          logWithTimestamp(`Number ${number} already called`, 'info');
          toast({
            title: "Number Already Called",
            description: `Number ${number} has already been called for this game`,
          });
          return false;
        }
        
        // Add the number to the array
        const updatedNumbers = [...calledNumbers, number];
        
        // Update the database
        const { error: updateError } = await supabase
          .from('sessions_progress')
          .update({ called_numbers: updatedNumbers })
          .eq('session_id', effectiveSessionId);
        
        if (updateError) {
          throw updateError;
        }
        
        logWithTimestamp(`Number ${number} called successfully`, 'info');
        return true;
      } catch (error) {
        logWithTimestamp(`Error calling number: ${error}`, 'error');
        toast({
          title: "Error",
          description: `Failed to call number: ${error}`,
          variant: "destructive"
        });
        return false;
      }
    },
    [sessionId, toast]
  );
  
  // Submit a bingo claim by adding to the universal_game_logs table
  const submitBingoClaim = useCallback(
    async (ticket: any, playerCode: string, targetSessionId: string): Promise<boolean> => {
      if (!playerCode || !targetSessionId) {
        logWithTimestamp('Cannot submit claim: Missing player code or session ID', 'error');
        toast({
          title: "Error",
          description: "Cannot submit bingo claim: Missing player information",
          variant: "destructive"
        });
        return false;
      }
      
      try {
        logWithTimestamp(`Submitting bingo claim for player ${playerCode} in session ${targetSessionId} via database insert`, 'info');
        
        // Get player data first
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerCode)
          .single();
        
        if (playerError) {
          throw new Error(`Player data not found: ${playerError.message}`);
        }
        
        // Get session progress to get current game info
        const { data: progressData, error: progressError } = await supabase
          .from('sessions_progress')
          .select('current_game_number, current_win_pattern, called_numbers, current_prize, current_game_type')
          .eq('session_id', targetSessionId)
          .single();
        
        if (progressError) {
          throw new Error(`Session progress not found: ${progressError.message}`);
        }
        
        // Create the claim record
        const { error: claimError } = await supabase
          .from('universal_game_logs')
          .insert({
            session_id: targetSessionId,
            player_id: playerData.id,
            player_name: playerData.nickname || playerCode,
            game_number: progressData.current_game_number,
            win_pattern: progressData.current_win_pattern || 'any',
            prize: progressData.current_prize,
            game_type: progressData.current_game_type,
            called_numbers: progressData.called_numbers || [],
            total_calls: progressData.called_numbers ? progressData.called_numbers.length : 0,
            last_called_number: progressData.called_numbers && progressData.called_numbers.length > 0 
              ? progressData.called_numbers[progressData.called_numbers.length - 1] 
              : null,
            ticket_serial: ticket.serial,
            ticket_perm: ticket.perm,
            ticket_position: ticket.position,
            ticket_layout_mask: ticket.layoutMask || ticket.layout_mask,
            ticket_numbers: ticket.numbers
          });
        
        if (claimError) {
          throw claimError;
        }
        
        logWithTimestamp('Bingo claim submitted successfully', 'info');
        toast({
          title: "Bingo Claim Submitted",
          description: "Your claim has been submitted and is being verified",
        });
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error submitting bingo claim: ${error}`, 'error');
        toast({
          title: "Error",
          description: `Failed to submit bingo claim: ${error}`,
          variant: "destructive"
        });
        return false;
      }
    },
    [toast]
  );
  
  // Validate a claim
  const validateClaim = useCallback(
    async (claim: any, isValid: boolean): Promise<boolean> => {
      if (!claim?.id) {
        logWithTimestamp('Cannot validate claim: Missing claim ID', 'error');
        return false;
      }
      
      try {
        logWithTimestamp(`Validating claim ${claim.id}, result: ${isValid ? 'valid' : 'rejected'} via database update`, 'info');
        
        // Update the claim record
        const { error } = await supabase
          .from('universal_game_logs')
          .update({
            validated_at: new Date().toISOString(),
            // This should be the actual caller ID in a real app
            caller_id: 'system'
          })
          .eq('id', claim.id);
          
        if (error) {
          throw error;
        }
        
        logWithTimestamp(`Claim ${claim.id} validated successfully`, 'info');
        toast({
          title: "Claim Validated",
          description: isValid ? "The bingo claim is valid" : "The bingo claim was rejected",
          variant: isValid ? "default" : "destructive"
        });
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error validating claim: ${error}`, 'error');
        toast({
          title: "Error",
          description: `Failed to validate claim: ${error}`,
          variant: "destructive"
        });
        return false;
      }
    },
    [toast]
  );
  
  // Update player presence
  const updatePlayerPresence = useCallback(
    async (presenceData: any): Promise<boolean> => {
      if (!sessionId || !presenceData?.player_id) {
        logWithTimestamp('Cannot update player presence: Missing session ID or player ID', 'error');
        return false;
      }
      
      try {
        logWithTimestamp('Updating player presence via database upsert', 'debug');
        
        // First check if we already have a presence record
        const { data: existingPresence } = await supabase
          .from('player_presence')
          .select('id')
          .eq('session_id', sessionId)
          .eq('player_id', presenceData.player_id)
          .single();
        
        // Prepare the presence data
        const presenceUpdate = {
          session_id: sessionId,
          player_id: presenceData.player_id,
          player_code: presenceData.player_code,
          nickname: presenceData.nickname,
          last_seen_at: new Date().toISOString()
        };
        
        if (existingPresence) {
          // Update existing record
          const { error } = await supabase
            .from('player_presence')
            .update(presenceUpdate)
            .eq('id', existingPresence.id);
            
          if (error) throw error;
        } else {
          // Create new record
          const { error } = await supabase
            .from('player_presence')
            .insert(presenceUpdate);
            
          if (error) throw error;
        }
        
        return true;
      } catch (error) {
        logWithTimestamp(`Error updating player presence: ${error}`, 'error');
        return false;
      }
    },
    [sessionId]
  );
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, [cleanupSubscriptions]);
  
  return (
    <NetworkContext.Provider
      value={{
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
        updatePlayerPresence
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};
