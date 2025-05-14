
/**
 * Interface for the NumberCallingService
 */
export interface NumberCallingService {
  /**
   * Subscribe to number updates for a session
   * @param sessionId The session to subscribe to
   * @param callback Function called when numbers are updated
   * @returns Unsubscribe function
   */
  subscribe(sessionId: string, callback: (number: number | null, numbers: number[]) => void): () => void;
  
  /**
   * Notify all listeners for a session of a new number
   * @param sessionId The session to notify
   * @param number The latest number called
   * @param numbers All called numbers
   */
  notifyListeners(sessionId: string, number: number | null, numbers: number[]): void;
  
  /**
   * Reset called numbers for a session
   * @param sessionId The session to reset
   * @returns Success status
   */
  resetNumbers(sessionId: string): Promise<boolean>;
  
  /**
   * Update the called numbers for a session
   * @param sessionId The session to update
   * @param numbers The new array of called numbers
   * @returns Success status
   */
  updateCalledNumbers(sessionId: string, numbers: number[]): Promise<boolean>;
}
