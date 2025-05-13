
import { ConnectionState } from '@/constants/connectionConstants';

/**
 * Connection manager interfaces and types
 */

// Listener interfaces
export interface NumberCalledListener {
  (number: number | null, allNumbers: number[]): void;
}

export interface SessionProgressListener {
  (progress: any): void;
}

export interface ConnectionStatusListener {
  (connected: boolean): void;
}

// Connection service interface
export interface ConnectionService {
  init(sessionId: string): ConnectionService;
  connect(sessionId: string): ConnectionService;
  onNumberCalled(listener: NumberCalledListener): ConnectionService;
  onSessionProgressUpdate(listener: SessionProgressListener): ConnectionService;
  addConnectionListener(listener: ConnectionStatusListener): () => void;
  callNumber(number: number, sessionId?: string): Promise<boolean>;
  reconnect(): void;
  getConnectionState(): ConnectionState;
  getLastPing(): number | null;
  isConnected(): boolean;
}

