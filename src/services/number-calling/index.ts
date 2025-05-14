
import { NumberCallingService } from './types';
import { logWithTimestamp } from '@/utils/logUtils';
import { saveCalledNumbersToDatabase } from '@/hooks/playerWebSocket/databaseUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

/**
 * Service for managing bingo number calling
 */
class NumberCallingServiceImpl implements NumberCallingService {
  private listeners: Map<string, Set<(number: number | null, numbers: number[]) => void>> = new Map();
  
  /**
   * Subscribe to number updates for a session
   */
  subscribe(sessionId: string, callback: (number: number | null, numbers: number[]) => void): () => void {
    if (!sessionId) {
      logWithTimestamp('Cannot subscribe without sessionId', 'error');
      return () => {};
    }
    
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    
    this.listeners.get(sessionId)!.add(callback);
    
    logWithTimestamp(`Subscribed to number updates for session ${sessionId}`, 'info');
    
    return () => {
      if (this.listeners.has(sessionId)) {
        this.listeners.get(sessionId)!.delete(callback);
      }
    };
  }
  
  /**
   * Notify all listeners for a session of a new number
   */
  notifyListeners(sessionId: string, number: number | null, numbers: number[]): void {
    if (!sessionId || !this.listeners.has(sessionId)) return;
    
    this.listeners.get(sessionId)!.forEach(callback => {
      try {
        callback(number, numbers);
      } catch (error) {
        logWithTimestamp(`Error in number listener callback: ${error}`, 'error');
      }
    });
  }
  
  /**
   * Reset called numbers for a session
   */
  async resetNumbers(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;
    
    try {
      // Reset in database
      const success = await saveCalledNumbersToDatabase(sessionId, []);
      
      if (success) {
        // Notify listeners
        this.notifyListeners(sessionId, null, []);
        
        // Also broadcast via WebSocket
        const connection = getSingleSourceConnection();
        connection.getWebSocketService().broadcastWithRetry(
          connection.constructor.CHANNEL_NAMES.GAME_UPDATES,
          connection.constructor.EVENT_TYPES.GAME_RESET,
          { sessionId }
        );
        
        return true;
      }
      
      return false;
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Update the called numbers for a session
   */
  async updateCalledNumbers(sessionId: string, numbers: number[]): Promise<boolean> {
    if (!sessionId) return false;
    
    try {
      // Update in database
      const success = await saveCalledNumbersToDatabase(sessionId, numbers);
      
      if (success) {
        // Notify listeners
        const lastNumber = numbers.length > 0 ? numbers[numbers.length - 1] : null;
        this.notifyListeners(sessionId, lastNumber, numbers);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logWithTimestamp(`Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
}

// Create a singleton instance
export const numberCallingService = new NumberCallingServiceImpl();

// Export a getter for consistent access pattern
export const getNumberCallingService = () => numberCallingService;
