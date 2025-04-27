import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession } from '@/types';
import { Json, SessionWithActivePattern } from '@/types/json';

export function useGameProgression(session: GameSession | null, onGameComplete?: () => void) {
  const [isProcessingGame, setIsProcessingGame] = useState(false);
  const { toast } = useToast();

  // Helper to get the appropriate first pattern for a game based on available patterns
  const getFirstPatternForGame = async (sessionId: string, gameNumber: number, gameType: string) => {
    try {
      // Get patterns for this game from the session configuration
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (sessionData?.games_config) {
        const gamesConfig = Array.isArray(sessionData.games_config) ? sessionData.games_config : [];
        const gameConfig = gamesConfig.find((config: any) => config?.gameNumber === gameNumber);
        
        if (gameConfig && typeof gameConfig === 'object' && 
            'selectedPatterns' in gameConfig && 
            Array.isArray(gameConfig.selectedPatterns) &&
            gameConfig.selectedPatterns.length > 0) {
          console.log(`Found specific patterns for game ${gameNumber}:`, gameConfig.selectedPatterns);
          return String(gameConfig.selectedPatterns[0]);
        }
      }
      
      // Fallback to standard pattern
      return 'oneLine';
    } catch (err) {
      console.error(`Error getting patterns for game ${gameNumber}:`, err);
      return 'oneLine'; // Default fallback
    }
  };

  const progressToNextGame = useCallback(async () => {
    if (!session || isProcessingGame || !session.id) {
      console.log("Cannot progress game: missing session or already processing", {
        hasSession: !!session,
        isProcessing: isProcessingGame,
        sessionId: session?.id
      });
      return;
    }
    
    setIsProcessingGame(true);

    try {
      console.log("Progressing to next game for session:", session.id);
      
      // Fetch the latest session data to ensure we have current state
      const { data: latestSessionData, error: fetchError } = await supabase
        .from('game_sessions')
        .select('*, current_game_state')
        .eq('id', session.id)
        .single();
        
      if (fetchError) {
        console.error("Error fetching latest session data:", fetchError);
        toast({
          title: "Error",
          description: "Failed to fetch latest session data for game progression.",
          variant: "destructive"
        });
        setIsProcessingGame(false);
        return;
      }
      
      // Calculate next game number using the fetched data
      const currentGameState = latestSessionData.current_game_state as { gameNumber?: number } || {};
      const currentGameNumber = typeof currentGameState === 'object' && currentGameState && 'gameNumber' in currentGameState 
        ? (currentGameState.gameNumber as number) || 1 
        : latestSessionData.current_game || 1;
      const nextGameNumber = currentGameNumber + 1;
      console.log(`Current game: ${currentGameNumber}, Next game: ${nextGameNumber}`);
      
      // Get total number of games from the session
      const totalGames = latestSessionData.number_of_games || 1;
      const isLastGame = nextGameNumber > totalGames;
      console.log(`Total games: ${totalGames}, Is this the last game? ${isLastGame ? 'Yes' : 'No'}`);
      
      if (isLastGame) {
        // This was the last game, update session status to 'completed'
        const { error } = await supabase
          .from('game_sessions')
          .update({ 
            status: 'completed',
            lifecycle_state: 'completed',
            current_game: totalGames // Ensure current_game is set to the total
          })
          .eq('id', session.id);

        if (error) {
          console.error("Error completing session:", error);
          toast({
            title: "Error",
            description: "Failed to mark session as completed.",
            variant: "destructive"
          });
        } else {
          console.log("Session marked as completed");
          
          // Update sessions_progress to mark completion
          const { error: progressError } = await supabase
            .from('sessions_progress')
            .update({
              current_game_number: totalGames,
              current_win_pattern: 'fullHouse'  // Set to the final pattern
            })
            .eq('session_id', session.id);
            
          if (progressError) {
            console.error("Error updating session progress for completion:", progressError);
          } else {
            console.log("Session progress updated for completion");
          }
          
          toast({
            title: "Session Completed",
            description: "All games in this session have been completed.",
          });
          
          // Trigger the completion callback
          if (onGameComplete) {
            onGameComplete();
          }
          
          // Force refresh the page
          if (typeof window !== 'undefined') {
            console.log('Forcing page refresh after game completion');
            window.location.reload();
          }
        }
      } else {
        // Get the appropriate first pattern for this new game
        const gameType = latestSessionData.game_type || 'mainstage';
        const firstPattern = await getFirstPatternForGame(session.id, nextGameNumber, gameType);
        
        // Setup the next game state with proper default values
        const nextGameState = {
          gameNumber: nextGameNumber,
          gameType: latestSessionData.game_type,
          activePatternIds: [String(firstPattern)], // Ensure we have strings
          calledItems: [],
          lastCalledItem: null,
          status: 'active',
          prizes: {}
        };
        
        console.log("Updating with next game state:", nextGameState);
        
        // Update the session with the new game state
        const updateData: Record<string, any> = {
          current_game_state: nextGameState as Json,
          status: 'active',
          current_game: nextGameNumber
        };
        
        // Add active_pattern_id to the session
        if (typeof updateData === 'object') {
          (updateData as SessionWithActivePattern).active_pattern_id = String(firstPattern);
        }
        
        const { error } = await supabase
          .from('game_sessions')
          .update(updateData)
          .eq('id', session.id);

        if (error) {
          console.error("Error progressing to next game:", error);
          toast({
            title: "Error",
            description: "Failed to progress to next game.",
            variant: "destructive"
          });
          setIsProcessingGame(false);
          return;
        }
        
        console.log(`Successfully progressed to game ${nextGameNumber}`);
        
        // Update session progress for the new game
        const { error: progressError } = await supabase
          .from('sessions_progress')
          .update({
            current_game_number: nextGameNumber,
            current_win_pattern: String(firstPattern)
          })
          .eq('session_id', session.id);
          
        if (progressError) {
          console.error("Error updating session progress:", progressError);
          toast({
            title: "Error",
            description: "Failed to update session progress.",
            variant: "destructive"
          });
        } else {
          console.log(`Session progress updated for new game with pattern ${firstPattern}`);
        }
        
        toast({
          title: "Game Advanced",
          description: `Successfully advanced to game ${nextGameNumber}`,
        });
        
        // Force refresh the page after successful progression
        if (typeof window !== 'undefined') {
          console.log('Forcing page refresh after game progression');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    } catch (err) {
      console.error("Error in progressToNextGame:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while progressing the game.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingGame(false);
    }
  }, [session, isProcessingGame, toast, onGameComplete]);

  return {
    progressToNextGame,
    isProcessingGame
  };
}
