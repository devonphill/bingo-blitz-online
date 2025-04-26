
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession } from '@/types';

export function useGameProgression(session: GameSession | null, onGameComplete?: () => void) {
  const [isProcessingGame, setIsProcessingGame] = useState(false);
  const { toast } = useToast();

  const progressToNextGame = async () => {
    if (!session || isProcessingGame || !session.id) return;
    setIsProcessingGame(true);

    try {
      console.log("Progressing to next game for session:", session.id);
      
      // Calculate next game number
      const currentGameNumber = session.current_game_state?.gameNumber || 1;
      const nextGameNumber = currentGameNumber + 1;
      console.log(`Current game: ${currentGameNumber}, Next game: ${nextGameNumber}`);
      
      const isLastGame = nextGameNumber > (session.numberOfGames || 1);
      console.log(`Is this the last game? ${isLastGame ? 'Yes' : 'No'}`);
      
      // Get the next game configuration if available
      let nextGameConfig = null;
      if (session.games_config && Array.isArray(session.games_config) && session.games_config.length > 0) {
        nextGameConfig = session.games_config.find(game => game.gameNumber === nextGameNumber);
      }
      
      console.log("Next game config:", nextGameConfig);
      
      // Setup the next game state
      const nextGameState = {
        gameNumber: nextGameNumber,
        gameType: nextGameConfig?.gameType || session.current_game_state?.gameType || session.gameType,
        activePatternIds: nextGameConfig?.selectedPatterns || [],
        calledItems: [],
        lastCalledItem: null,
        status: 'active',
        prizes: nextGameConfig?.prizes || {}
      };
      
      console.log("Updating with next game state:", nextGameState);
      
      // Update the session with the new game state
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          current_game_state: JSON.parse(JSON.stringify(nextGameState)),
          status: isLastGame ? 'completed' : 'active'
        })
        .eq('id', session.id);

      if (error) {
        console.error("Error progressing to next game:", error);
        toast({
          title: "Error",
          description: "Failed to progress to next game.",
          variant: "destructive"
        });
        return;
      }

      if (isLastGame && onGameComplete) {
        onGameComplete();
      }

      toast({
        title: "Game Progress",
        description: isLastGame ? "Session completed!" : `Moving to game ${nextGameNumber}`,
      });
    } catch (err) {
      console.error("Game progression error:", err);
      toast({
        title: "Error",
        description: "An error occurred while trying to progress to the next game.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingGame(false);
    }
  };

  return {
    isProcessingGame,
    progressToNextGame
  };
}
