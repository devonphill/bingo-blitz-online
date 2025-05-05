
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';

// Define connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// This is a simplified version of the connection manager that uses Supabase
// database subscriptions instead of custom WebSockets
class ConnectionManager {
  private sessionId: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private playerListeners: Array<(players: any[]) => void> = [];
  private numberCalledListeners: Array<(number: number | null, allNumbers: number[]) => void> = [];
  private lastPing: number | null = null;
  private isInitialized: boolean = false;

  initialize(sessionId: string) {
    // Only initialize once with a specific session ID
    if (this.isInitialized && this.sessionId === sessionId) {
      logWithTimestamp(`ConnectionManager already initialized with session ID: ${sessionId}`);
      return this;
    }
    
    this.sessionId = sessionId;
    this.connectionState = 'connected';
    this.lastPing = Date.now();
    this.isInitialized = true;
    logWithTimestamp(`ConnectionManager initialized with session ID: ${sessionId}`);
    return this;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getLastPing(): number {
    return this.lastPing || 0;
  }

  reconnect() {
    logWithTimestamp('Database reconnection requested');
    // In the database model, there's no explicit reconnection - subscriptions auto-reconnect
    this.lastPing = Date.now();
    return true;
  }

  connect(sessionId: string) {
    // Don't reconnect if already connected to this session
    if (this.sessionId === sessionId && this.isConnected()) {
      logWithTimestamp(`Already connected to session: ${sessionId}`);
      return this;
    }
    
    return this.initialize(sessionId);
  }

  async callNumber(number: number, sessionId?: string) {
    try {
      const targetSessionId = sessionId || this.sessionId;
      if (!targetSessionId) {
        logWithTimestamp('Cannot call number: No session ID', 'error');
        return false;
      }

      // Get current session progress
      const { data: progressData } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', targetSessionId)
        .single();

      // Update the called numbers array
      const calledNumbers = progressData?.called_numbers || [];
      if (!calledNumbers.includes(number)) {
        calledNumbers.push(number);
      }

      // Update the database with the new called numbers
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: calledNumbers,
        })
        .eq('session_id', targetSessionId);

      if (error) {
        logWithTimestamp(`Error calling number: ${error.message}`, 'error');
        return false;
      }

      logWithTimestamp(`Number ${number} called for session ${targetSessionId}`);
      return true;
    } catch (error) {
      logWithTimestamp(`Exception calling number: ${(error as Error).message}`, 'error');
      return false;
    }
  }

  async fetchClaims(sessionId?: string) {
    try {
      const targetSessionId = sessionId || this.sessionId;
      if (!targetSessionId) {
        logWithTimestamp('Cannot fetch claims: No session ID', 'error');
        return [];
      }

      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', targetSessionId)
        .is('validated_at', null);

      if (error) {
        logWithTimestamp(`Error fetching claims: ${error.message}`, 'error');
        return [];
      }

      return data || [];
    } catch (error) {
      logWithTimestamp(`Exception fetching claims: ${(error as Error).message}`, 'error');
      return [];
    }
  }

  onPlayersUpdate(callback: (players: any[]) => void) {
    this.playerListeners.push(callback);
    return this;
  }

  // For compatibility with existing code
  onNumberCalled(callback: (number: number | null, allNumbers: number[]) => void) {
    this.numberCalledListeners.push(callback);
    return this;
  }

  // For compatibility with existing code
  onSessionProgressUpdate(callback: (progress: any) => void) {
    // No-op but return this for method chaining
    return this;
  }

  // For compatibility with existing code
  onConnectionStatusChange(callback: (isConnected: boolean) => void) {
    return this;
  }

  // For compatibility with existing code
  onError(callback: (error: string) => void) {
    return this;
  }

  // No-op methods for compatibility
  startGame() {
    return this;
  }
  
  endGame() {
    return this;
  }
}

// Create a singleton instance
export const connectionManager = new ConnectionManager();
