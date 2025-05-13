
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType } from '@/utils/typeUtils';
import { GameStateUpdatePayload } from './types';

/**
 * Add a listener for game state updates
 * 
 * @param sessionId Current session ID
 * @param callback Callback function to receive updates
 * @returns Function to remove the listener
 */
export function addGameStateUpdateListener(
  sessionId: string | null,
  callback: (gameState: GameStateUpdatePayload) => void
): () => void {
  // Using a unique ID for the listener
  const listenerId = `gamestate-${Math.random().toString(36).substring(2, 9)}`;
  
  // Set up database subscription for session progress
  const channel = supabase
    .channel(`progress-${listenerId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sessions_progress',
      filter: sessionId ? `session_id=eq.${sessionId}` : undefined
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
}

/**
 * Add a listener for connection status changes
 * 
 * @param isConnectedGetter Function to get current connection status
 * @param callback Callback function to receive status updates
 * @returns Function to remove the listener
 */
export function addConnectionStatusListener(
  isConnectedGetter: () => boolean,
  callback: (isConnected: boolean) => void
): () => void {
  // Set up an interval to check connection status
  const interval = setInterval(() => {
    callback(isConnectedGetter());
  }, 5000);
  
  // Call immediately once
  callback(isConnectedGetter());
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
  };
}

/**
 * Add a listener for number called events
 * 
 * @param sessionId Current session ID
 * @param callback Callback function to receive updates
 * @returns Function to remove the listener
 */
export function addNumberCalledListener(
  sessionId: string | null,
  callback: (number: number | null, calledNumbers: number[]) => void
): () => void {
  // Set up subscription for called numbers
  const channel = supabase
    .channel(`numbercalls-${Math.random().toString(36).substring(2, 9)}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sessions_progress',
      filter: sessionId ? `session_id=eq.${sessionId}` : undefined
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
}
