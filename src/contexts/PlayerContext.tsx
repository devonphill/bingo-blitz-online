
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export interface Player {
  id: string;
  name: string;
  code: string;
  sessionId: string;
  email?: string;
  tickets?: number;
}

interface PlayerContextType {
  player: Player | null;
  setPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  isPlayerLoading: boolean;
  loadPlayerById: (id: string) => Promise<Player | null>;
  loadPlayerByCode: (code: string) => Promise<Player | null>;
}

const PlayerContext = createContext<PlayerContextType>({
  player: null,
  setPlayer: () => {},
  isPlayerLoading: true,
  loadPlayerById: async () => null,
  loadPlayerByCode: async () => null
});

export const PlayerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isPlayerLoading, setIsPlayerLoading] = useState(true);

  // Load player data from storage on mount
  useEffect(() => {
    const loadStoredPlayerData = () => {
      try {
        const storedPlayer = localStorage.getItem('bingo_player');
        if (storedPlayer) {
          const parsedPlayer = JSON.parse(storedPlayer);
          setPlayer(parsedPlayer);
          logWithTimestamp(`Loaded player from storage: ${parsedPlayer.name} (${parsedPlayer.id})`, 'info');
        }
      } catch (error) {
        logWithTimestamp(`Error loading stored player: ${error}`, 'error');
      } finally {
        setIsPlayerLoading(false);
      }
    };

    loadStoredPlayerData();
  }, []);

  // Save player data to storage when it changes
  useEffect(() => {
    if (player) {
      try {
        localStorage.setItem('bingo_player', JSON.stringify(player));
        logWithTimestamp(`Saved player to storage: ${player.name} (${player.id})`, 'info');
      } catch (error) {
        logWithTimestamp(`Error saving player to storage: ${error}`, 'error');
      }
    }
  }, [player]);

  // Load player by ID
  const loadPlayerById = async (id: string): Promise<Player | null> => {
    try {
      setIsPlayerLoading(true);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data) {
        const loadedPlayer = {
          id: data.id,
          name: data.nickname,
          code: data.player_code,
          sessionId: data.session_id,
          email: data.email || '',
          tickets: data.tickets || 1
        };
        
        setPlayer(loadedPlayer);
        return loadedPlayer;
      }
      
      return null;
    } catch (error) {
      logWithTimestamp(`Error loading player by ID: ${error}`, 'error');
      return null;
    } finally {
      setIsPlayerLoading(false);
    }
  };
  
  // Load player by code
  const loadPlayerByCode = async (code: string): Promise<Player | null> => {
    try {
      setIsPlayerLoading(true);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('player_code', code)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data) {
        const loadedPlayer = {
          id: data.id,
          name: data.nickname,
          code: data.player_code,
          sessionId: data.session_id,
          email: data.email || '',
          tickets: data.tickets || 1
        };
        
        setPlayer(loadedPlayer);
        return loadedPlayer;
      }
      
      return null;
    } catch (error) {
      logWithTimestamp(`Error loading player by code: ${error}`, 'error');
      return null;
    } finally {
      setIsPlayerLoading(false);
    }
  };

  return (
    <PlayerContext.Provider 
      value={{ 
        player, 
        setPlayer, 
        isPlayerLoading,
        loadPlayerById,
        loadPlayerByCode
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => useContext(PlayerContext);
