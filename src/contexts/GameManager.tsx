import React, { createContext, useState, useContext } from "react";
import { gameTypes } from "@/config/gameTypes";

const GameManagerContext = createContext();

export const GameManagerProvider = ({ children }) => {
  const [currentGameType, setCurrentGameType] = useState(gameTypes[0]);

  const switchGameType = (gameTypeId) => {
    const gameType = gameTypes.find((type) => type.id === gameTypeId);
    if (gameType) {
      setCurrentGameType(gameType);
    } else {
      console.error(`Game type with ID "${gameTypeId}" not found.`);
    }
  };

  return (
    <GameManagerContext.Provider value={{ currentGameType, switchGameType }}>
      {children}
    </GameManagerContext.Provider>
  );
};

export const useGameManager = () => useContext(GameManagerContext);