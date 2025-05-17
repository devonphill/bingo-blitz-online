// In src/types/websocket.ts
import { CONNECTION_STATES } from '@/constants/websocketConstants';

export type WebSocketConnectionStatus = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];

// You can also put your payload interfaces like NumberCalledPayload, ClaimSubmittedPayload etc. here
// or keep them in websocketConstants.ts if preferred.
