
import React, { createContext, useContext, useState } from 'react';

export type ClaimStatus = "none" | "pending" | "valid" | "invalid";

interface GameContextType {
  claimStatus: ClaimStatus;
  setClaimStatus: (status: ClaimStatus) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("none");

  return (
    <GameContext.Provider value={{ claimStatus, setClaimStatus }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
