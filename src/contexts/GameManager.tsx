
import React, { createContext, useState, useContext } from "react";
import { gameTypes } from "@/config/gameTypes";
import { supabase } from '@/integrations/supabase/client';

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
  getSessionById?: (sessionId: string) => Promise<any>;
  getCurrentSession: () => Promise<any>; // Added getCurrentSession method
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

  // New method to get session by ID
  const getSessionById = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching session:", error);
      return null;
    }
  };

  // New method to get current session
  const getCurrentSession = async () => {
    try {
      // Check local storage for current session ID
      const sessionId = localStorage.getItem('currentSessionId');
      if (!sessionId) {
        console.warn('No current session ID found in local storage');
        return null;
      }

      // Fetch session data from Supabase
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error fetching current session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCurrentSession:', error);
      return null;
    }
  };

  const contextValue = {
    currentGameType,
    switchGameType,
    getGameTypeById,
    getSessionById,
    getCurrentSession, // Add the new method to context
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
