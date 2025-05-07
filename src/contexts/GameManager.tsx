
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

const GameManagerContext = createContext<GameManagerContextType | null>(null);

export const GameManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ensure we have a valid default game type
  const defaultGameType = gameTypes && gameTypes.length > 0 ? gameTypes[0] : {
    id: "mainstage",
    name: "Mainstage (90 Ball)",
    rules: {
      maxPlayers: 100,
      winCondition: "Complete pattern"
    },
    generateNumber: () => Math.floor(Math.random() * 90) + 1,
    customButtons: []
  };
  
  const [currentGameType, setCurrentGameType] = useState<GameType>(defaultGameType);

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
