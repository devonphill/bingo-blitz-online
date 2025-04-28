
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSessionContext } from "@/contexts/SessionProvider";
import { GameType } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function GameTypeChanger() {
  const { currentSession, updateSession } = useSessionContext();
  const { toast } = useToast();
  
  const changeGameType = async (newType: GameType) => {
    if (!currentSession) {
      toast({
        title: "Error",
        description: "No current session found",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log("Changing game type to:", newType);
      console.log("Current session:", currentSession);
      
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
      
      toast({
        title: "Success",
        description: `Game type changed to ${newType}`,
      });
      
    } catch (error) {
      console.error("Error changing game type:", error);
      toast({
        title: "Error",
        description: `Failed to change game type: ${(error as Error).message}`,
        variant: "destructive"
      });
    }
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
