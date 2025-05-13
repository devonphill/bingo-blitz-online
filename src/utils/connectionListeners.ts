
import { logWithTimestamp } from './logUtils';

/**
 * A utility class to manage connection listeners
 */
export class ConnectionListenerManager {
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private numberCalledListeners: Set<(number: number | null, allNumbers: number[]) => void> = new Set();
  private sessionProgressListeners: Set<(progress: any) => void> = new Set();
  
  /**
   * Register a number called listener
   */
  public onNumberCalled(listener: (number: number | null, allNumbers: number[]) => void) {
    this.numberCalledListeners.add(listener);
    return this;
  }
  
  /**
   * Register a session progress update listener
   */
  public onSessionProgressUpdate(listener: (progress: any) => void) {
    this.sessionProgressListeners.add(listener);
    return this;
  }
  
  /**
   * Register a listener for connection status changes
   */
  public addConnectionListener(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    
    // Return the unsubscribe function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }
  
  /**
   * Notify number called listeners
   */
  public notifyNumberCalledListeners(number: number | null, allNumbers: number[]): void {
    this.numberCalledListeners.forEach(listener => {
      try {
        listener(number, allNumbers);
      } catch (error) {
        logWithTimestamp(`Error in number called listener: ${error}`, 'error');
      }
    });
  }
  
  /**
   * Notify all listeners of connection status change
   */
  public notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        logWithTimestamp(`Error in connection listener: ${error}`, 'error');
      }
    });
  }

  /**
   * Get the connection listener count
   */
  public getConnectionListenerCount(): number {
    return this.connectionListeners.size;
  }

  /**
   * Get the number called listener count
   */
  public getNumberCalledListenerCount(): number {
    return this.numberCalledListeners.size;
  }

  /**
   * Get the session progress listener count
   */
  public getSessionProgressListenerCount(): number {
    return this.sessionProgressListeners.size;
  }
}
