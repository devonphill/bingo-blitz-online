
import { getPlayerNumbersService } from './player-numbers/PlayerNumbersService';

/**
 * Unified number calling service
 * Manages number calls, broadcasts, and synchronization
 */
export class NumberCallingService {
  private static instance: NumberCallingService;
  
  private constructor() {
    // Initialize service
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): NumberCallingService {
    if (!this.instance) {
      this.instance = new NumberCallingService();
    }
    return this.instance;
  }
  
  /**
   * Subscribe to number updates for a session
   */
  public subscribeToSession(sessionId: string, callback: (number: number, numbers: number[]) => void): () => void {
    // Use player numbers service internally
    return getPlayerNumbersService().subscribe(sessionId, callback);
  }
  
  /**
   * Get current called numbers for a session
   */
  public getCalledNumbers(sessionId: string): number[] {
    return getPlayerNumbersService().getCalledNumbers(sessionId);
  }
  
  /**
   * Get last called number for a session
   */
  public getLastCalledNumber(sessionId: string): number | null {
    return getPlayerNumbersService().getLastCalledNumber(sessionId);
  }
  
  /**
   * Force reconnection for a session
   */
  public reconnect(sessionId: string): void {
    getPlayerNumbersService().reconnect(sessionId);
  }
}

// Export singleton getter
export const getNumberCallingService = () => NumberCallingService.getInstance();
