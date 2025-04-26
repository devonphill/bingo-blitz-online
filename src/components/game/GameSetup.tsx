
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType, PrizeDetails } from "@/types";
import { WinPattern } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameConfigForm } from '@/components/caller/GameConfigForm';
import { supabase } from "@/integrations/supabase/client";

interface GameConfig {
  gameType: GameType;
  selectedPatterns: string[];
  prizes: { [patternId: string]: PrizeDetails };
}

export function GameSetup() {
  const { currentSession, updateCurrentGameState } = useSessions();
  const { toast } = useToast();
  
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  // Initialize game configs when session loads
  useEffect(() => {
    console.log("Current session updated:", currentSession);
    
    if (currentSession) {
      const numberOfGames = currentSession.numberOfGames || 1;
      // Check if games_config is already set in the database
      const existingConfigs = Array.isArray(currentSession.games_config) 
        ? currentSession.games_config as GameConfig[] 
        : [];
      
      console.log("Existing configs from database:", existingConfigs);
      
      // Only create new configs if we don't have any or they're incomplete
      if (existingConfigs.length < numberOfGames) {
        console.log("Creating new configs with preset prizes");
        
        // Initialize configs for all games with a preset prize for One Line
        const newConfigs = Array.from({ length: numberOfGames }, (_, index) => {
          // Use existing config if available, otherwise create new one
          return existingConfigs[index] || {
            gameType: 'mainstage',
            selectedPatterns: ['oneLine'], // Preset One Line pattern
            prizes: {
              'oneLine': {
                amount: '10.00', 
                isNonCash: false,
                description: 'One Line Prize'
              }
            }
          };
        });
        
        setGameConfigs(newConfigs);
        
        // Set the initial setup flag to false when creating new configs
        setInitialSetupDone(false);
      } else {
        // Use existing configs from the database
        console.log("Using existing configs from database");
        setGameConfigs(existingConfigs);
        
        // If we already have configs in the database, mark setup as done
        setInitialSetupDone(true);
      }
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
          console.log("Saving to games_config:", gameConfigs);
          
          const { error: gamesConfigError } = await supabase
            .from('game_sessions')
            .update({ 
              games_config: gameConfigs
            })
            .eq('id', currentSession.id);
            
          if (gamesConfigError) {
            console.error("Error saving games_config:", gamesConfigError);
            toast({
              title: "Error",
              description: "Failed to save game configuration.",
              variant: "destructive"
            });
            return;
          }
          
          // Then update current_game_state
          console.log("Saving to current_game_state");
          const success = await updateCurrentGameState({
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
    setGameConfigs(prev => prev.map((config, index) => {
      if (index !== gameIndex) return config;
      return {
        ...config,
        prizes: {
          ...config.prizes,
          [patternId]: prizeDetails
        }
      };
    }));
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
      console.log("Game configs:", gameConfigs);
      console.log("Current game prizes:", gameConfigs[0].prizes);
      
      // First update the current game state with prizes
      const updateResult = await updateCurrentGameState({
        gameType: gameConfigs[0].gameType,
        activePatternIds: gameConfigs[0].selectedPatterns,
        prizes: gameConfigs[0].prizes,
        status: 'pending',
      });

      if (!updateResult) {
        throw new Error("Failed to update current game state");
      }

      // Then update all game configs
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          // Send the raw object without JSON conversions
          games_config: gameConfigs
        })
        .eq('id', currentSession.id);

      if (error) throw error;
      
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
          gameNumber={index + 1}
          gameType={config.gameType}
          onGameTypeChange={(type) => handleGameTypeChange(index, type)}
          winPatterns={config.gameType ? import.meta.env.DEV ? [] : [] : []} // This will be populated by GameConfigForm
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
