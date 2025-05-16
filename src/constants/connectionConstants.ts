
// Define standard connection states
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CONNECTING' | 'JOINED' | 'JOINING';

// WebSocket-specific status
export const WEBSOCKET_STATUS = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  SUBSCRIBED: 'SUBSCRIBED',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
  TIMED_OUT: 'TIMED_OUT'
} as const;

// Make all status values available in a single list for type checking
export const ALL_CONNECTION_STATES: ConnectionState[] = [
  'connected',
  'connecting',
  'disconnected',
  'error',
  'SUBSCRIBED',
  'CLOSED',
  'CHANNEL_ERROR',
  'TIMED_OUT',
  'CONNECTING',
  'JOINED',
  'JOINING'
];

// Heartbeat interval in milliseconds (30 seconds)
export const HEARTBEAT_INTERVAL = 30000;

// Helper function to check if a connection state represents being connected
export const isConnectedState = (state: ConnectionState): boolean => {
  return state === 'connected' || state === 'SUBSCRIBED';
};
