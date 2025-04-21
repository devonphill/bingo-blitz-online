
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession } from '@/types';

export function useGameProgression(session: GameSession | null, onGameComplete?: () => void) {
  const [isProcessingGame, setIsProcessingGame] = useState(false);
  const { toast } = useToast();

  const progressToNextGame = async () => {
    if (!session || isProcessingGame) return;
    setIsProcessingGame(true);

    try {
      const nextGameNumber = session.numberOfGames + 1;
      const isLastGame = nextGameNumber > session.numberOfGames;

      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          current_game: nextGameNumber,
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
    } finally {
      setIsProcessingGame(false);
    }
  };

  return {
    isProcessingGame,
    progressToNextGame
  };
}
