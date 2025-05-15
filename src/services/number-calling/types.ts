
/**
 * Number calling service listener function
 */
export type NumberCallingListener = (number: number | null, calledNumbers: number[]) => void;

/**
 * Options for number calling service
 */
export interface NumberCallingOptions {
  sessionId?: string;
  autoConnect?: boolean;
  autoFetch?: boolean;
}
