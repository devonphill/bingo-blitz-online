
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PlayerContextType {
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  logout: () => void;
  isLoading: boolean;
}

interface Player {
  id: string;
  name: string;
  code: string;
  sessionId?: string;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerContextProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load player from localStorage on mount
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    const storedPlayerName = localStorage.getItem('playerName');
    const storedPlayerId = localStorage.getItem('playerId');
    const storedSessionId = localStorage.getItem('playerSessionId');
    
    if (storedPlayerCode && storedPlayerName) {
      setPlayer({
        id: storedPlayerId || `temp-${Date.now()}`,
        name: storedPlayerName,
        code: storedPlayerCode,
        sessionId: storedSessionId || undefined
      });
    }
    
    setIsLoading(false);
  }, []);

  // Update localStorage when player changes
  useEffect(() => {
    if (player) {
      localStorage.setItem('playerCode', player.code);
      localStorage.setItem('playerName', player.name);
      localStorage.setItem('playerId', player.id);
      if (player.sessionId) {
        localStorage.setItem('playerSessionId', player.sessionId);
      }
    }
  }, [player]);

  // Logout function
  const logout = () => {
    localStorage.removeItem('playerCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerId');
    localStorage.removeItem('playerSessionId');
    setPlayer(null);
    navigate('/player/join');
  };

  return (
    <PlayerContext.Provider value={{ player, setPlayer, logout, isLoading }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayerContext must be used within a PlayerContextProvider');
  }
  return context;
}
