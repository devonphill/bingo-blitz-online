
// Re-export all websocket-related types and constants
export * from './types';
export * from './WebSocketService';
export * from './broadcastManager';
export * from './channelManager';

import { webSocketService, getWebSocketService } from './WebSocketService';
import { BroadcastManager } from './broadcastManager';
import { ChannelManager } from './channelManager';
import { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from './types';

// Create and export singleton instances
export const broadcastManager = new BroadcastManager();
export const channelManager = new ChannelManager();

// Re-export constants for easier access
export {
  CHANNEL_NAMES,
  EVENT_TYPES,
  WEBSOCKET_STATUS,
  webSocketService,
  getWebSocketService
};
