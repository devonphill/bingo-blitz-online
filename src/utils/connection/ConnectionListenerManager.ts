
import { logWithTimestamp } from '@/utils/logUtils';
import { ConnectionStatusListener, NumberCalledListener, SessionProgressListener } from './connectionTypes';

/**
 * A utility class to manage connection listeners
 */
export class ConnectionListenerManager {
  private connectionListeners: Set<ConnectionStatusListener> = new Set();
  private numberCalledListeners: Set<NumberCalledListener> = new Set();
  private sessionProgressListeners: Set<SessionProgressListener> = new Set();
  
  /**
   * Add a number called listener
   * @param listener Function to call when a number is called
   * @returns Function to remove the listener
   */
  public onNumberCalled(listener: NumberCalledListener): () => void {
    this.numberCalledListeners.add(listener);
    return () => {
      this.numberCalledListeners.delete(listener);
    };
  }
  
  /**
   * Add a session progress update listener
   * @param listener Function to call when session progress is updated
   * @returns Function to remove the listener
   */
  public onSessionProgressUpdate(listener: SessionProgressListener): () => void {
    this.sessionProgressListeners.add(listener);
    return () => {
      this.sessionProgressListeners.delete(listener);
    };
  }
  
  /**
   * Add a connection status listener
   * @param listener Function to call when connection status changes
   * @returns Function to remove the listener
   */
  public addConnectionListener(listener: ConnectionStatusListener): () => void {
    this.connectionListeners.add(listener);
    
    // Return the unsubscribe function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }
  
  /**
   * Notify all number called listeners
   * @param number Number that was called or null if game reset
   * @param allNumbers All called numbers
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
   * Notify all session progress listeners
   * @param progress Session progress data
   */
  public notifySessionProgressListeners(progress: any): void {
    this.sessionProgressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        logWithTimestamp(`Error in session progress listener: ${error}`, 'error');
      }
    });
  }
  
  /**
   * Notify all connection status listeners
   * @param connected Whether connection is established
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
   * @returns Number of connection listeners
   */
  public getConnectionListenerCount(): number {
    return this.connectionListeners.size;
  }

  /**
   * Get the number called listener count
   * @returns Number of number called listeners
   */
  public getNumberCalledListenerCount(): number {
    return this.numberCalledListeners.size;
  }

  /**
   * Get the session progress listener count
   * @returns Number of session progress listeners
   */
  public getSessionProgressListenerCount(): number {
    return this.sessionProgressListeners.size;
  }
}
