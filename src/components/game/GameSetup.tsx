
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType, PrizeDetails, GameConfig } from "@/types";
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameConfigForm } from '@/components/caller/GameConfigForm';
import { supabase } from "@/integrations/supabase/client";

export function GameSetup() {
  const { currentSession, updateCurrentGameState } = useSessions();
  const { toast } = useToast();
  
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  // Debug logging for current session
  useEffect(() => {
    if (currentSession) {
      console.log("Current session loaded:", {
        id: currentSession.id,
        name: currentSession.name,
        numberOfGames: currentSession.numberOfGames,
        games_config: currentSession.games_config,
      });
    }
  }, [currentSession]);

  // Initialize game configs when session loads
  useEffect(() => {
    if (!currentSession) return;
    
    const numberOfGames = currentSession.numberOfGames || 1;
    
    // Check if games_config already exists and is not empty
    const existingConfigs = Array.isArray(currentSession.games_config) 
      ? currentSession.games_config as unknown as GameConfig[] 
      : [];
    
    console.log("Existing configs from database:", existingConfigs);
    
    if (existingConfigs.length < numberOfGames) {
      console.log("Creating new configs with preset prizes");
      
      // Initialize configs for all games with a preset prize for One Line
      const newConfigs: GameConfig[] = Array.from({ length: numberOfGames }, (_, index) => {
        // Use existing config if available, otherwise create new one
        const existingConfig = existingConfigs[index];
        return {
          gameNumber: index + 1,
          gameType: (existingConfig?.gameType || currentSession.gameType || 'mainstage') as GameType,
          selectedPatterns: existingConfig?.selectedPatterns || ['oneLine'],
          prizes: existingConfig?.prizes || {
            'oneLine': {
              amount: '10.00', 
              isNonCash: false,
              description: 'One Line Prize'
            }
          }
        };
      });
      
      setGameConfigs(newConfigs);
      setInitialSetupDone(false);
    } else {
      // Use existing configs from the database
      console.log("Using existing configs from database");
      setGameConfigs(existingConfigs);
      setInitialSetupDone(true);
    }
  }, [currentSession]);

  // Effect to handle the initial save of preset values to the database
  useEffect(() => {
    const saveInitialConfig = async () => {
      // Only run this once when component loads and we have configs and currentSession
      if (!initialSetupDone && gameConfigs.length > 0 && currentSession) {
        console.log("Attempting to save initial configuration");
        
        try {
          setIsSaving(true);
          
          // First update games_config
          console.log("Saving initial games_config:", gameConfigs);
          
          // Convert gameConfigs to a JSON-compatible object
          const gameConfigsJson = JSON.stringify(gameConfigs);
          
          const { data, error: gamesConfigError } = await supabase
            .from('game_sessions')
            .update({ 
              games_config: JSON.parse(gameConfigsJson)
            })
            .eq('id', currentSession.id)
            .select('games_config');
            
          if (gamesConfigError) {
            console.error("Error saving games_config:", gamesConfigError);
            toast({
              title: "Error",
              description: "Failed to save game configuration.",
              variant: "destructive"
            });
            return;
          }
          
          console.log("Initial games_config saved response:", data);
          
          // Then update current_game_state
          console.log("Saving to current_game_state");
          const success = await updateCurrentGameState({
            gameNumber: gameConfigs[0].gameNumber,
            gameType: gameConfigs[0].gameType,
            activePatternIds: gameConfigs[0].selectedPatterns,
            prizes: gameConfigs[0].prizes,
            status: 'pending',
          });
          
          if (!success) {
            console.error("Error updating current game state");
            toast({
              title: "Error",
              description: "Failed to update current game state.",
              variant: "destructive"
            });
            return;
          }
            
          console.log("Initial game config saved successfully");
          toast({
            title: "Success",
            description: "Initial game setup completed.",
          });
          
          // Mark initial setup as done
          setInitialSetupDone(true);
        } catch (error) {
          console.error("Exception during initial setup:", error);
          toast({
            title: "Error",
            description: "An unexpected error occurred during setup.",
            variant: "destructive"
          });
        } finally {
          setIsSaving(false);
        }
      }
    };
    
    saveInitialConfig();
  }, [gameConfigs, currentSession, updateCurrentGameState, initialSetupDone, toast]);

  const handleGameTypeChange = (gameIndex: number, newType: GameType) => {
    setGameConfigs(prev => prev.map((config, index) => 
      index === gameIndex ? { ...config, gameType: newType } : config
    ));
  };

  const handlePatternSelect = (gameIndex: number, pattern: WinPattern) => {
    setGameConfigs(prev => prev.map((config, index) => {
      if (index !== gameIndex) return config;
      
      const selectedPatterns = [...config.selectedPatterns];
      const patternIndex = selectedPatterns.indexOf(pattern.id);
      
      if (patternIndex >= 0) {
        selectedPatterns.splice(patternIndex, 1);
      } else {
        selectedPatterns.push(pattern.id);
      }
      
      return { ...config, selectedPatterns };
    }));
  };

  const handlePrizeChange = (gameIndex: number, patternId: string, prizeDetails: PrizeDetails) => {
    console.log(`Changing prize for game ${gameIndex + 1}, pattern ${patternId}:`, prizeDetails);
    
    setGameConfigs(prev => {
      const newConfigs = prev.map((config, index) => {
        if (index !== gameIndex) return config;
        
        // Create a new prizes object to ensure React detects the change
        const updatedPrizes = {
          ...config.prizes,
          [patternId]: {...prizeDetails}
        };
        
        return {
          ...config,
          prizes: updatedPrizes
        };
      });
      
      console.log("Updated game configs after prize change:", newConfigs);
      return newConfigs;
    });
  };

  const saveGameSettings = async () => {
    if (!currentSession) return;
    
    const hasEmptyPatterns = gameConfigs.some(config => config.selectedPatterns.length === 0);
    if (hasEmptyPatterns) {
      toast({
        title: "No win patterns selected",
        description: "Please select at least one win pattern for each game before saving.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    
    try {
      console.log("Saving game settings:");
      console.log("Game configs to save:", gameConfigs);
      
      // First update the current game state with prizes
      const updateResult = await updateCurrentGameState({
        gameNumber: gameConfigs[0].gameNumber,
        gameType: gameConfigs[0].gameType,
        activePatternIds: gameConfigs[0].selectedPatterns,
        prizes: gameConfigs[0].prizes,
        status: 'pending',
      });

      if (!updateResult) {
        throw new Error("Failed to update current game state");
      }

      // Then update all game configs
      // Convert gameConfigs to a JSON-compatible object
      const gameConfigsJson = JSON.stringify(gameConfigs);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          games_config: JSON.parse(gameConfigsJson)
        })
        .eq('id', currentSession.id)
        .select('games_config');

      if (error) {
        console.error("Error saving games_config:", error);
        throw error;
      }
      
      console.log("Games config saved response:", data);
      
      toast({
        title: "Success",
        description: "Game settings saved successfully.",
      });
      
      // Verify that data was saved correctly
      const { data: verifyData, error: verifyError } = await supabase
        .from('game_sessions')
        .select('games_config, current_game_state')
        .eq('id', currentSession.id)
        .single();
        
      if (verifyError) {
        console.error("Error verifying saved data:", verifyError);
      } else {
        console.log("Verified saved data:", verifyData);
      }
    } catch (error) {
      console.error("Error saving game settings:", error);
      toast({
        title: "Error",
        description: "Failed to save game settings.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {gameConfigs.map((config, index) => (
        <GameConfigForm
          key={index}
          gameNumber={config.gameNumber}
          gameType={config.gameType}
          onGameTypeChange={(type) => handleGameTypeChange(index, type)}
          winPatterns={config.gameType ? WIN_PATTERNS[config.gameType] : []}
          selectedPatterns={config.selectedPatterns}
          onPatternSelect={(pattern) => handlePatternSelect(index, pattern)}
          prizes={config.prizes}
          onPrizeChange={(patternId, details) => handlePrizeChange(index, patternId, details)}
        />
      ))}
      
      <Button 
        className="w-full" 
        onClick={saveGameSettings}
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : "Save Game Settings"}
      </Button>
    </div>
  );
}
