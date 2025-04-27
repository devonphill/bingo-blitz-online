
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession } from '@/types';

// Define a recursive Json type for Supabase JSON data
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export function useGameProgression(session: GameSession | null, onGameComplete?: () => void) {
  const [isProcessingGame, setIsProcessingGame] = useState(false);
  const { toast } = useToast();

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
        : 1;
      const nextGameNumber = currentGameNumber + 1;
      console.log(`Current game: ${currentGameNumber}, Next game: ${nextGameNumber}`);
      
      // Get total number of games from the session
      const totalGames = latestSessionData.number_of_games || 1;
      const isLastGame = nextGameNumber > totalGames;
      console.log(`Total games: ${totalGames}, Is this the last game? ${isLastGame ? 'Yes' : 'No'}`);
      
      // Get the next game configuration if available
      let nextGameConfig = null;
      if (latestSessionData.games_config && Array.isArray(latestSessionData.games_config)) {
        nextGameConfig = latestSessionData.games_config.find((game: any) => 
          game && typeof game === 'object' && game.gameNumber === nextGameNumber
        );
      }
      
      console.log("Next game config:", nextGameConfig);
      
      if (isLastGame) {
        // This was the last game, update session status to 'completed'
        const { error } = await supabase
          .from('game_sessions')
          .update({ 
            status: 'completed',
            lifecycle_state: 'completed'
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
          toast({
            title: "Session Completed",
            description: "All games in this session have been completed.",
          });
          
          // Trigger the completion callback
          if (onGameComplete) {
            onGameComplete();
          }
        }
      } else {
        // Setup the next game state with proper default values
        const nextGameState = {
          gameNumber: nextGameNumber,
          gameType: nextGameConfig?.gameType || 
                    (currentGameState && typeof currentGameState === 'object' && 'gameType' in currentGameState ? 
                      currentGameState.gameType : 
                      latestSessionData.game_type),
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
            current_game_state: JSON.parse(JSON.stringify(nextGameState)) as unknown as Json,
            status: 'active',
            current_game: nextGameNumber
          })
          .eq('id', session.id);

        if (error) {
          console.error("Error progressing to next game:", error);
          toast({
            title: "Error",
            description: "Failed to progress to next game.",
            variant: "destructive"
          });
        } else {
          console.log(`Successfully progressed to game ${nextGameNumber}`);
          toast({
            title: "Game Progress",
            description: `Moving to game ${nextGameNumber}`,
          });
          
          // Update session progress for the new game
          const { error: progressError } = await supabase
            .from('sessions_progress')
            .update({
              current_game_number: nextGameNumber,
              current_win_pattern: nextGameConfig?.selectedPatterns?.[0] || null,
              current_game_type: nextGameConfig?.gameType || latestSessionData.game_type
            })
            .eq('session_id', session.id);
            
          if (progressError) {
            console.error("Error updating session progress:", progressError);
          }
          
          // Broadcast game progression to all clients
          try {
            await supabase.channel('player-game-updates')
              .send({
                type: 'broadcast',
                event: 'game-progression',
                payload: {
                  sessionId: session.id,
                  previousGame: currentGameNumber,
                  newGame: nextGameNumber,
                  timestamp: new Date().toISOString()
                }
              });
            
            console.log("Sent game progression broadcast");
          } catch (error) {
            console.error("Error broadcasting game progression:", error);
          }
        }
      }
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
  }, [session, isProcessingGame, toast, onGameComplete]);

  return {
    isProcessingGame,
    progressToNextGame
  };
}
