
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { ChannelConfig, WebSocketChannel } from './types';

/**
 * Handles creation and management of WebSocket channels
 */
export class ChannelManager {
  private channels: Map<string, any> = new Map();
  private instanceId: string;
  
  constructor() {
    this.instanceId = `chMgr-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Creates a channel with proper configuration
   */
  public createChannel(channelName: string, config: ChannelConfig = {}): WebSocketChannel {
    try {
      // First check if we already have this channel - if so, remove it to avoid duplicates
      const channelKey = this.getChannelKey(channelName);
      if (this.channels.has(channelKey)) {
        logWithTimestamp(`[${this.instanceId}] Channel ${channelName} already exists, removing before recreating`, 'info');
        try {
          const existingChannel = this.channels.get(channelKey);
          if (existingChannel) {
            supabase.removeChannel(existingChannel);
          }
          this.channels.delete(channelKey);
        } catch (err) {
          logWithTimestamp(`[${this.instanceId}] Error removing existing channel: ${err}`, 'error');
        }
      }
      
      // Default configuration with improved resilience
      const defaultConfig: ChannelConfig = {
        config: {
          broadcast: { 
            self: true, // Receive own broadcasts
            ack: true   // Request acknowledgment
          },
          presence: {
            key: this.instanceId
          }
        }
      };
      
      // Merge with custom config
      const mergedConfig = { ...defaultConfig, ...config };
      
      // Create the channel
      // @ts-ignore Type compatibility issues between RealtimeChannel and WebSocketChannel
      const channel = supabase.channel(channelName, mergedConfig);
      
      // Store the channel
      this.channels.set(channelKey, channel);
      
      logWithTimestamp(`[${this.instanceId}] Created channel: ${channelName}`, 'info');
      
      // @ts-ignore Type compatibility issues between RealtimeChannel and WebSocketChannel
      return channel;
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error creating channel: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Get a channel by name
   */
  public getChannel(channelName: string): WebSocketChannel | undefined {
    const channelKey = this.getChannelKey(channelName);
    // @ts-ignore Type compatibility issues between RealtimeChannel and WebSocketChannel
    return this.channels.get(channelKey);
  }

  /**
   * Remove a channel
   */
  public removeChannel(channelName: string): void {
    const channelKey = this.getChannelKey(channelName);
    
    if (this.channels.has(channelKey)) {
      try {
        const channel = this.channels.get(channelKey);
        if (channel) {
          supabase.removeChannel(channel);
        }
        this.channels.delete(channelKey);
        logWithTimestamp(`[${this.instanceId}] Removed channel ${channelName}`, 'info');
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error removing channel ${channelName}: ${error}`, 'error');
      }
    }
  }

  /**
   * Clean up all channels
   */
  public cleanupAllChannels(): void {
    // Clean up all channels
    for (const [key, channel] of this.channels.entries()) {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
        logWithTimestamp(`[${this.instanceId}] Removed channel ${key}`, 'info');
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error removing channel ${key}: ${error}`, 'error');
      }
    }
    
    // Clear all channels
    this.channels.clear();
  }

  /**
   * Get a unique key for a channel
   */
  private getChannelKey(channelName: string): string {
    return `${channelName}`;
  }
}
