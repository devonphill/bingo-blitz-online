
import { logWithTimestamp } from '../logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { ConnectionService, NumberCalledListener, SessionProgressListener } from './connectionTypes';
import { getSingleSourceConnection } from '../SingleSourceTrueConnections';

/**
 * Connection manager class - now a facade for SingleSourceTrueConnections
 * @deprecated Use SingleSourceTrueConnections directly
 */
class ConnectionManager implements ConnectionService {
  /**
   * Initialize the connection with a session ID
   */
  public init(sessionId: string): ConnectionService {
    getSingleSourceConnection().init(sessionId);
    return this;
  }
  
  /**
   * Connect to a session
   */
  public connect(sessionId: string): ConnectionService {
    getSingleSourceConnection().connect(sessionId);
    return this;
  }
  
  /**
   * Register a number called listener
   */
  public onNumberCalled(listener: NumberCalledListener): ConnectionService {
    getSingleSourceConnection().onNumberCalled(listener);
    return this;
  }
  
  /**
   * Register a session progress update listener
   */
  public onSessionProgressUpdate(listener: SessionProgressListener): ConnectionService {
    getSingleSourceConnection().onSessionProgressUpdate(listener);
    return this;
  }
  
  /**
   * Register a connection status listener
   */
  public addConnectionListener(listener: (connected: boolean) => void): () => void {
    return getSingleSourceConnection().addConnectionListener(listener);
  }
  
  /**
   * Call a number
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    return getSingleSourceConnection().callNumber(number, sessionId);
  }
  
  /**
   * Reconnect to the current session
   */
  public reconnect(): void {
    getSingleSourceConnection().reconnect();
  }
  
  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return getSingleSourceConnection().getConnectionState();
  }
  
  /**
   * Get the last ping time
   */
  public getLastPing(): number | null {
    return getSingleSourceConnection().getLastPing();
  }
  
  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return getSingleSourceConnection().isConnected();
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
