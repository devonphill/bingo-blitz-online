
import { logWithTimestamp } from "@/utils/logUtils";
import { supabase } from "@/integrations/supabase/client";
import { NumberBroadcastPayload } from "./types";

// Define consistent channel names used across the application
export const GAME_UPDATES_CHANNEL = 'game-updates';
export const NUMBER_CALLED_EVENT = 'number-called';
export const GAME_RESET_EVENT = 'game-reset';

/**
 * Creates and manages WebSocket channels for number updates
 */
export class NumbersChannelManager {
  private channels: Map<string, any> = new Map();
  private instanceId: string;
  
  constructor() {
    this.instanceId = `NumChan-${Math.random().toString(36).substring(2, 7)}`;
  }
  
  /**
   * Creates and subscribes to channels for a session
   */
  public setupChannels(
    sessionId: string, 
    onNumberCalled: (payload: NumberBroadcastPayload) => void,
    onGameReset: (payload: NumberBroadcastPayload) => void
  ): void {
    this.removeChannels(sessionId);
    
    logWithTimestamp(`[${this.instanceId}] Setting up channels for session ${sessionId}`, 'info');
    
    // Set up the primary channel for number updates
    const numberChannel = supabase.channel(`number-broadcast-${sessionId}`)
      .on('broadcast', { event: NUMBER_CALLED_EVENT }, payload => {
        try {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            onNumberCalled(payload.payload);
          }
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error handling number update: ${error}`, 'error');
        }
      })
      .subscribe(status => {
        logWithTimestamp(`[${this.instanceId}] Number broadcast channel status: ${status}`, 'debug');
      });
    
    this.channels.set(`number-${sessionId}`, numberChannel);
    
    // Set up backup channel for number updates
    const backupNumberChannel = supabase.channel(`number-broadcast-backup-${sessionId}`)
      .on('broadcast', { event: 'number-called-backup' }, payload => {
        try {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            onNumberCalled(payload.payload);
          }
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error handling backup number update: ${error}`, 'error');
        }
      })
      .subscribe();
    
    this.channels.set(`number-backup-${sessionId}`, backupNumberChannel);
    
    // Set up reset channel
    const resetChannel = supabase.channel(`game-reset-broadcast-${sessionId}`)
      .on('broadcast', { event: GAME_RESET_EVENT }, payload => {
        try {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            onGameReset(payload.payload);
          }
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error handling reset event: ${error}`, 'error');
        }
      })
      .subscribe();
    
    this.channels.set(`reset-${sessionId}`, resetChannel);
    
    // Set up backup reset channel
    const backupResetChannel = supabase.channel(`game-reset-backup-${sessionId}`)
      .on('broadcast', { event: 'game-reset-backup' }, payload => {
        try {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            onGameReset(payload.payload);
          }
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error handling backup reset event: ${error}`, 'error');
        }
      })
      .subscribe();
    
    this.channels.set(`reset-backup-${sessionId}`, backupResetChannel);
  }
  
  /**
   * Removes all channels for a session
   */
  public removeChannels(sessionId: string): void {
    const channelPrefixes = [`number-${sessionId}`, `number-backup-${sessionId}`, `reset-${sessionId}`, `reset-backup-${sessionId}`];
    
    channelPrefixes.forEach(prefix => {
      const channel = this.channels.get(prefix);
      if (channel) {
        try {
          supabase.removeChannel(channel);
          this.channels.delete(prefix);
          logWithTimestamp(`[${this.instanceId}] Removed channel: ${prefix}`, 'debug');
        } catch (e) {
          logWithTimestamp(`[${this.instanceId}] Error removing channel: ${e}`, 'error');
        }
      }
    });
  }
  
  /**
   * Cleans up all channels
   */
  public cleanup(): void {
    this.channels.forEach((channel, key) => {
      try {
        supabase.removeChannel(channel);
        logWithTimestamp(`[${this.instanceId}] Removed channel: ${key}`, 'debug');
      } catch (e) {
        // Ignore errors when cleaning up
      }
    });
    
    this.channels.clear();
  }
}
