
import { supabase } from "@/integrations/supabase/client";
import { logWithTimestamp } from "@/utils/logUtils";

type ProgressCallback = (progress: any) => void;
type NumberCallback = (number: number, allNumbers: number[]) => void;
type PlayersCallback = (players: any[]) => void;

class ConnectionManager {
  private sessionId: string | null = null;
  private channel: any | null = null;
  private progressUpdateCallback: ProgressCallback | null = null;
  private numberCalledCallback: NumberCallback | null = null;
  private playersUpdateCallback: PlayersCallback | null = null;

  constructor() {
    logWithTimestamp("ConnectionManager created");
  }

  public initialize(sessionId: string) {
    this.sessionId = sessionId;
    logWithTimestamp(`Initializing connection manager with session ID: ${sessionId}`);
    return this;
  }

  public onSessionProgressUpdate(callback: ProgressCallback) {
    this.progressUpdateCallback = callback;
    return this;
  }

  public onNumberCalled(callback: NumberCallback) {
    this.numberCalledCallback = callback;
    return this;
  }
  
  public onPlayersUpdate(callback: PlayersCallback) {
    this.playersUpdateCallback = callback;
    this.setupPlayerMonitoring();
    return this;
  }

  private setupListeners() {
    if (!this.sessionId) {
      logWithTimestamp("Cannot setup listeners: no session ID");
      return;
    }

    this.cleanup(); // Clean up existing subscription before creating a new one

    this.channel = supabase
      .channel(`session-updates-${this.sessionId}`)
      .on(
        'broadcast',
        { event: 'number-called' },
        (payload) => {
          logWithTimestamp(`Received number broadcast: ${JSON.stringify(payload)}`);
          if (
            payload.payload &&
            payload.payload.sessionId === this.sessionId &&
            this.numberCalledCallback
          ) {
            const { lastCalledNumber, calledNumbers } = payload.payload;
            this.numberCalledCallback(lastCalledNumber, calledNumbers);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'session-progress' },
        (payload) => {
          logWithTimestamp(`Received session progress broadcast: ${JSON.stringify(payload)}`);
          if (
            payload.payload &&
            payload.payload.sessionId === this.sessionId &&
            this.progressUpdateCallback
          ) {
            this.progressUpdateCallback(payload.payload);
          }
        }
      )
      .subscribe((status, error) => {
        logWithTimestamp(`Channel subscription status: ${status}`);
        if (error) {
          logWithTimestamp(`Channel subscription error: ${JSON.stringify(error)}`);
        }
      });
  }
  
  private setupPlayerMonitoring() {
    if (!this.sessionId || !this.playersUpdateCallback) {
      return;
    }
    
    // Initial fetch
    this.fetchConnectedPlayers();
    
    // Set up polling
    setInterval(() => {
      this.fetchConnectedPlayers();
    }, 10000);
  }

  public async fetchConnectedPlayers() {
    if (!this.sessionId || !this.playersUpdateCallback) {
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, nickname, player_code')
        .eq('session_id', this.sessionId);
        
      if (error) {
        logWithTimestamp(`Error fetching players: ${JSON.stringify(error)}`);
        return [];
      }
      
      if (data && this.playersUpdateCallback) {
        this.playersUpdateCallback(data);
      }
      
      return data || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching players: ${err}`);
      return [];
    }
  }
  
  public async fetchClaims() {
    if (!this.sessionId) {
      return [];
    }
    
    try {
      logWithTimestamp(`Fetching claims for session ${this.sessionId}`);
      
      // Use the get_pending_claims RPC function
      const { data, error } = await supabase.rpc(
        'get_pending_claims', 
        { p_session_id: this.sessionId }
      );
      
      if (error) {
        logWithTimestamp(`Error fetching claims: ${JSON.stringify(error)}`);
        return [];
      }
      
      return data || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching claims: ${err}`);
      return [];
    }
  }

  public callNumber(number: number, sessionId?: string) {
    const targetSessionId = sessionId || this.sessionId;
    if (!targetSessionId) {
      logWithTimestamp("Cannot call number: no session ID");
      return;
    }
    
    logWithTimestamp(`Calling number ${number} for session ${targetSessionId}`);
    
    // Calculate the current called numbers
    this.fetchSessionProgress().then(progressData => {
      const currentCalledNumbers = progressData?.called_numbers || [];
      const updatedCalledNumbers = [...currentCalledNumbers, number];
      
      // Update the database
      supabase
        .from('sessions_progress')
        .update({ called_numbers: updatedCalledNumbers })
        .eq('session_id', targetSessionId)
        .then(({ error }) => {
          if (error) {
            logWithTimestamp(`Error updating called numbers: ${JSON.stringify(error)}`);
          } else {
            logWithTimestamp(`Successfully updated called numbers in database`);
          }
        });
      
      // Broadcast the number in real-time
      supabase
        .channel('number-broadcast')
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId: targetSessionId,
            lastCalledNumber: number,
            calledNumbers: updatedCalledNumbers,
            timestamp: new Date().getTime()
          }
        })
        .then(() => {
          logWithTimestamp(`Successfully broadcast number ${number}`);
        })
        .catch(err => {
          logWithTimestamp(`Error broadcasting number: ${err}`);
        });
    });
  }

  private async fetchSessionProgress() {
    if (!this.sessionId) {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`Error fetching session progress: ${JSON.stringify(error)}`);
        return null;
      }
      
      return data;
    } catch (err) {
      logWithTimestamp(`Exception fetching session progress: ${err}`);
      return null;
    }
  }

  public reconnect() {
    logWithTimestamp("Attempting to reconnect");
    this.setupListeners();
  }

  public cleanup() {
    if (this.channel) {
      logWithTimestamp("Cleaning up connection manager");
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
