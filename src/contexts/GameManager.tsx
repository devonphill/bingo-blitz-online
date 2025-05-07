
import React, { createContext, useState, useContext } from "react";
import { gameTypes } from "@/config/gameTypes";

type GameType = {
  id: string;
  name: string;
  rules: {
    maxPlayers: number;
    winCondition: string;
  };
  generateNumber: () => number | string;
  customButtons: string[];
};

type GameManagerContextType = {
  currentGameType: GameType;
  switchGameType: (gameTypeId: string) => void;
  getGameTypeById: (gameTypeId: string) => GameType | undefined;
  allGameTypes: GameType[];
};

const GameManagerContext = createContext<GameManagerContextType | undefined>(undefined);

export const GameManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentGameType, setCurrentGameType] = useState<GameType>(gameTypes[0]);

  const switchGameType = (gameTypeId: string) => {
    const gameType = gameTypes.find((type) => type.id === gameTypeId);
    if (gameType) {
      setCurrentGameType(gameType);
    } else {
      console.error(`Game type with ID "${gameTypeId}" not found.`);
    }
  };

  const getGameTypeById = (gameTypeId: string) => {
    return gameTypes.find((type) => type.id === gameTypeId);
  };

  const contextValue = {
    currentGameType,
    switchGameType,
    getGameTypeById,
    allGameTypes: gameTypes,
  };

  return (
    <GameManagerContext.Provider value={contextValue}>
      {children}
    </GameManagerContext.Provider>
  );
};

export const useGameManager = (): GameManagerContextType => {
  const context = useContext(GameManagerContext);
  if (!context) {
    throw new Error("useGameManager must be used within a GameManagerProvider");
  }
  return context;
};
