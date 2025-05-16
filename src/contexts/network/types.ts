
export interface NetworkProviderProps {
  children: React.ReactNode;
  initialSessionId?: string | null;
}

export interface NetworkContextType {
  isConnected: boolean;
  sessionId: string | null;
  claimStatus: any | null;
  connect: (sessionId: string) => void;
  submitBingoClaim: (ticket: any, playerCode: string, gameSessionId: string) => boolean;
  sendClaimValidation: (claimId: string, isValid: boolean, sessionId: string) => Promise<boolean>;
  updatePlayerPresence: (sessionId: string, playerData: any) => Promise<boolean>;
}

// Re-export this type to avoid TS1205 error
export type { NetworkContextType as NetworkContextExportType };
