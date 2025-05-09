
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { connectionManager } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';
import { claimService } from '@/services/ClaimManagementService';

// Export the ConnectionState type so it can be used by other components
// Fix: Use 'export type' for re-exporting when isolatedModules is enabled
export type { ConnectionState } from '@/utils/connectionManager';

// Extended interface to include all required methods
interface NetworkContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastPingTime: number | null;
  sessionId: string | null;  // Add sessionId property
  connect: (sessionId: string) => void;
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  fetchClaims: (sessionId?: string) => Promise<any[]>;
  
  // Add missing methods for all the components
  updatePlayerPresence: (presenceData: any) => Promise<boolean>;
  addGameStateUpdateListener: (callback: (gameState: any) => void) => () => void;
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => () => void;
  addNumberCalledListener: (callback: (number: number | null, calledNumbers: number[]) => void) => () => void;
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => boolean;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
}

// Type import to avoid the isolatedModules error
import type { ConnectionState } from '@/utils/connectionManager';

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const connectedSessionId = useRef<string | null>(null);
  
  // Update local state based on connection manager state
  const updateConnectionState = useCallback(() => {
    const state = connectionManager.getConnectionState();
    setConnectionState(state);
    setLastPingTime(connectionManager.getLastPing());
  }, []);
  
  // Connect to a session
  const connect = useCallback((sessionId: string) => {
    // Don't reconnect if already connected to this session
    if (connectedSessionId.current === sessionId && connectionManager.isConnected()) {
      logWithTimestamp(`Already connected to session: ${sessionId}`, 'info');
      return;
    }
    
    logWithTimestamp(`Connecting to session: ${sessionId}`, 'info');
    connectionManager.connect(sessionId);
    connectedSessionId.current = sessionId;
    updateConnectionState();
  }, [updateConnectionState]);
  
  // Call a bingo number
  const callNumber = useCallback(async (number: number, sessionId?: string): Promise<boolean> => {
    const result = await connectionManager.callNumber(number, sessionId);
    updateConnectionState();
    return result;
  }, [updateConnectionState]);
  
  // Fetch pending claims
  const fetchClaims = useCallback(async (sessionId?: string): Promise<any[]> => {
    return await connectionManager.fetchClaims(sessionId);
  }, []);
  
  // Add implementation for updatePlayerPresence
  const updatePlayerPresence = useCallback(async (presenceData: any): Promise<boolean> => {
    try {
      // FIX: Use the 'players' table instead of 'player_presence'
      // Since 'updated_at' doesn't exist, use joined_at which is a timestamp field
      const { error } = await supabase
        .from('players')
        .update({
          joined_at: new Date().toISOString() // Use joined_at instead of updated_at
        })
        .eq('id', presenceData.player_id)
        .eq('player_code', presenceData.player_code);
        
      return !error;
    } catch (err) {
      logWithTimestamp(`Error updating player presence: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);
  
  // Add implementation for addGameStateUpdateListener
  const addGameStateUpdateListener = useCallback((callback: (gameState: any) => void): (() => void) => {
    // Using a unique ID for the listener
    const listenerId = `gamestate-${Math.random().toString(36).substring(2, 9)}`;
    
    // Set up database subscription for session progress
    const channel = supabase
      .channel(`progress-${listenerId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions_progress',
        filter: connectedSessionId.current ? `session_id=eq.${connectedSessionId.current}` : undefined
      }, (payload) => {
        const newData = payload.new as any;
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
          
          callback(gameState);
        }
      })
      .subscribe();
      
    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Add implementation for addConnectionStatusListener
  const addConnectionStatusListener = useCallback((callback: (isConnected: boolean) => void): (() => void) => {
    // Set up an interval to check connection status
    const interval = setInterval(() => {
      callback(connectionManager.isConnected());
    }, 5000);
    
    // Call immediately once
    callback(connectionManager.isConnected());
    
    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Add implementation for addNumberCalledListener
  const addNumberCalledListener = useCallback((callback: (number: number | null, calledNumbers: number[]) => void): (() => void) => {
    // Set up subscription for called numbers
    const channel = supabase
      .channel(`numbercalls-${Math.random().toString(36).substring(2, 9)}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions_progress',
        filter: connectedSessionId.current ? `session_id=eq.${connectedSessionId.current}` : undefined
      }, (payload) => {
        const newData = payload.new as any;
        if (newData && newData.called_numbers) {
          const calledNumbers = newData.called_numbers;
          const lastCalledNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;
          callback(lastCalledNumber, calledNumbers);
        }
      })
      .subscribe();
      
    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Add implementation for submitBingoClaim - UPDATED to use claim service
  const submitBingoClaim = useCallback((ticket: any, playerCode: string, sessionId: string): boolean => {
    try {
      logWithTimestamp(`Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
      
      // First, we need to fetch the actual player ID
      supabase
        .from('players')
        .select('id, nickname')
        .eq('player_code', playerCode)
        .eq('session_id', sessionId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            logWithTimestamp(`Error finding player by code: ${error.message}`, 'error');
            return false;
          }
          
          if (!data) {
            logWithTimestamp(`No player found with code ${playerCode}`, 'error');
            return false;
          }
          
          // Submit the claim using the claim service
          return claimService.submitClaim({
            playerId: data.id,
            playerName: data.nickname || playerCode,
            sessionId: sessionId,
            ticket: {
              serial: ticket.serial,
              perm: ticket.perm,
              position: ticket.position,
              layoutMask: ticket.layout_mask || ticket.layoutMask,
              numbers: ticket.numbers
            },
            gameType: 'mainstage', // Default, can be changed later
            calledNumbers: ticket.calledNumbers || [],
            lastCalledNumber: ticket.lastCalledNumber || null
          });
        });
      
      return true; // Return true to indicate claim submission attempt started
    } catch (err) {
      logWithTimestamp(`Exception submitting bingo claim: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);
  
  // Add implementation for validateClaim - UPDATED to use claim service
  const validateClaim = useCallback(async (claim: any, isValid: boolean): Promise<boolean> => {
    try {
      if (!claim || !claim.id) {
        logWithTimestamp(`Cannot validate claim: invalid claim data`, 'error');
        return false;
      }
      
      // Use claim service to process claim
      return await claimService.processClaim(claim.id, claim.sessionId, isValid);
    } catch (err) {
      logWithTimestamp(`Exception validating claim: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);
  
  return (
    <NetworkContext.Provider
      value={{
        connectionState,
        isConnected: connectionState === 'connected',
        lastPingTime,
        sessionId: connectedSessionId.current,
        connect,
        callNumber,
        fetchClaims,
        updatePlayerPresence,
        addGameStateUpdateListener,
        addConnectionStatusListener,
        addNumberCalledListener,
        submitBingoClaim,
        validateClaim
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
