
import { WEBSOCKET_STATUS } from '@/constants/websocketConstants';

export interface WebSocketChannel {
  on: (eventType: string, options: any, callback: (payload: any) => void) => any;
  subscribe: (callback?: (status: string) => void) => any;
}

export interface BroadcastOptions {
  maxRetries?: number;
}

export interface ChannelConfig {
  config?: {
    broadcast?: {
      self?: boolean;
      ack?: boolean;
    };
    presence?: {
      key?: string;
    };
  };
}

export type ConnectionListener = (status: string) => void;
