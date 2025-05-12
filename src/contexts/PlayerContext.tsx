
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logWithTimestamp } from '@/utils/logUtils';

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
    logWithTimestamp('PlayerContext: Initializing from localStorage', 'info');
    const storedPlayerCode = localStorage.getItem('playerCode');
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName') || 'Player';
    const storedSessionId = localStorage.getItem('playerSessionId');
    
    if (storedPlayerCode && storedPlayerId) {
      logWithTimestamp(`PlayerContext: Found stored player with code: ${storedPlayerCode}, id: ${storedPlayerId}`, 'info');
      setPlayer({
        id: storedPlayerId,
        name: storedPlayerName,
        code: storedPlayerCode,
        sessionId: storedSessionId || undefined
      });
    } else {
      logWithTimestamp('PlayerContext: No valid player data in localStorage', 'info');
    }
    
    setIsLoading(false);
  }, []);

  // Update localStorage when player changes
  useEffect(() => {
    if (player) {
      logWithTimestamp(`PlayerContext: Updating localStorage with player data, code: ${player.code}`, 'info');
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
    logWithTimestamp('PlayerContext: Logging out player', 'info');
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
