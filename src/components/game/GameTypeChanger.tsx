
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType } from "@/types";
import { useSessionProgress } from "@/hooks/useSessionProgress";

export function GameTypeChanger() {
  const { currentSession, updateSession } = useSessions();
  
  const changeGameType = async (newType: GameType) => {
    if (!currentSession) return;
    
    // Update the game_type in the session
    await updateSession(currentSession.id, {
      gameType: newType
    });
    
    // Update the games_config for the current game
    const currentGameNumber = currentSession.current_game || 1;
    const gamesConfig = Array.isArray(currentSession.games_config) 
      ? [...currentSession.games_config] 
      : [];
    
    const updatedConfig = gamesConfig.map(config => {
      if (config.gameNumber === currentGameNumber) {
        return {
          ...config,
          gameType: newType
        };
      }
      return config;
    });
    
    await updateSession(currentSession.id, {
      games_config: updatedConfig
    });
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3">Change Game Type</h3>
      <div className="flex gap-4">
        <Button 
          variant={currentSession?.gameType === 'mainstage' ? 'default' : 'outline'}
          onClick={() => changeGameType('mainstage')}
        >
          Mainstage Bingo
        </Button>
        <Button 
          variant={currentSession?.gameType === 'party' ? 'default' : 'outline'}
          onClick={() => changeGameType('party')}
        >
          Party Bingo
        </Button>
      </div>
    </div>
  );
}
