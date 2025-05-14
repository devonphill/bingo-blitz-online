
import { RealtimeChannel } from '@supabase/supabase-js';

export const CHANNEL_NAMES = {
  GAME_UPDATES: 'game-updates',
  SESSION_UPDATES: 'session-updates',
  CLAIM_UPDATES: 'claim-updates'
};

export const EVENT_TYPES = {
  NUMBER_CALLED: 'number-called',
  GAME_RESET: 'game-reset',
  CLAIM_SUBMITTED: 'claim-submitted',
  CLAIM_VALIDATION: 'claim-validation',
  CLAIM_VALIDATING_TKT: 'claim-validating-tkt',
  SESSION_STATE_CHANGE: 'session-state-change',
  GO_LIVE: 'go-live'
};

export type WebSocketStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export interface SessionStateUpdate {
  status: string;
  lifecycle_state: string;
  updated_at: string;
}

export interface WebSocketChannelEvent<T = any> {
  type: string;
  event: string;
  payload: T;
}
