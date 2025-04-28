
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessionContext } from "@/contexts/SessionProvider";
import { GameType, PrizeDetails, GameConfig, WinPatternConfig } from "@/types";
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameConfigForm } from '@/components/caller/GameConfigForm';
import { supabase } from "@/integrations/supabase/client";
import { gameConfigsToJson } from '@/utils/jsonUtils';

export function GameSetup() {
  const { currentSession, updateSession } = useSessionContext();
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
      ? currentSession.games_config as GameConfig[] 
      : [];
    
    console.log("Existing configs from database:", existingConfigs);
    
    if (existingConfigs.length < numberOfGames) {
      console.log("Creating new configs with NO active patterns");
      
      // Initialize configs for all games with a new pattern structure and NO active patterns
      const newConfigs: GameConfig[] = Array.from({ length: numberOfGames }, (_, index) => {
        // Use existing config if available, otherwise create new one
        const existingConfig = existingConfigs[index];
        if (existingConfig) return existingConfig;
        
        const gameType = currentSession.gameType || 'mainstage' as GameType;
        
        // Set up pattern defaults according to the game type
        const patternIds = WIN_PATTERNS[gameType].map(pattern => pattern.id);
        const patterns: GameConfig['patterns'] = {};
        
        // Initialize each pattern with default values - NONE active
        patternIds.forEach(patternId => {
          patterns[patternId] = {
            active: false, // No patterns active by default
            isNonCash: false,
            prizeAmount: '10.00',
            description: `${patternId} Prize`
          };
        });
        
        return {
          gameNumber: index + 1,
          gameType: gameType,
          patterns: patterns
        };
      });
      
      setGameConfigs(newConfigs);
      setInitialSetupDone(false);
    } else {
      // If the old format exists, convert it to new format
      if (existingConfigs.length > 0 && 'selectedPatterns' in existingConfigs[0]) {
        console.log("Converting old config format to new format");
        
        const convertedConfigs: GameConfig[] = existingConfigs.map((oldConfig: any) => {
          const patterns: GameConfig['patterns'] = {};
          
          // Get all possible patterns for this game type
          const gameType = oldConfig.gameType || 'mainstage';
          const allPatterns = WIN_PATTERNS[gameType].map(pattern => pattern.id);
          
          // Set up each pattern with values from the old format
          allPatterns.forEach(patternId => {
            const isSelected = Array.isArray(oldConfig.selectedPatterns) && 
                              oldConfig.selectedPatterns.includes(patternId);
            
            const prizeInfo = oldConfig.prizes && oldConfig.prizes[patternId];
            
            patterns[patternId] = {
              active: isSelected,
              isNonCash: prizeInfo?.isNonCash || false,
              prizeAmount: prizeInfo?.amount || '10.00',
              description: prizeInfo?.description || `${patternId} Prize`
            };
          });
          
          return {
            gameNumber: oldConfig.gameNumber,
            gameType: oldConfig.gameType,
            patterns: patterns
          };
        });
        
        setGameConfigs(convertedConfigs);
      } else {
        // Use existing configs from the database if they match the new structure
        console.log("Using existing configs from database");
        setGameConfigs(existingConfigs);
      }
      
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
          
          // Save directly using the updateSession function
          const success = await updateSession(currentSession.id, {
            games_config: gameConfigs
          });
          
          if (!success) {
            throw new Error("Failed to update session with game configs");
          }
          
          // Update the session_progress with first game's first active pattern
          if (gameConfigs.length > 0) {
            const firstGame = gameConfigs[0];
            // Find first active pattern or default to oneLine
            const activePatternId = Object.entries(firstGame.patterns || {})
              .find(([_, config]) => config.active)?.[0] || 'oneLine';
            
            const { error: progressError } = await supabase
              .from('sessions_progress')
              .update({
                current_win_pattern: activePatternId,
                current_game_type: firstGame.gameType
              })
              .eq('session_id', currentSession.id);
              
            if (progressError) {
              console.error("Error updating session progress:", progressError);
              toast({
                title: "Error",
                description: "Failed to update session progress.",
                variant: "destructive"
              });
              return;
            }
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
  }, [gameConfigs, currentSession, initialSetupDone, toast, updateSession]);

  const handleGameTypeChange = (gameIndex: number, newType: GameType) => {
    setGameConfigs(prev => prev.map((config, index) => {
      if (index !== gameIndex) return config;
      
      // Get patterns for the new game type
      const patternIds = WIN_PATTERNS[newType].map(pattern => pattern.id);
      const patterns: GameConfig['patterns'] = {};
      
      // Initialize patterns with default values - NONE active by default
      patternIds.forEach(patternId => {
        // If this pattern existed in previous config, use its values
        if (config.patterns && config.patterns[patternId]) {
          patterns[patternId] = config.patterns[patternId];
        } else {
          patterns[patternId] = {
            active: false, // NO default active patterns
            isNonCash: false,
            prizeAmount: '10.00',
            description: `${patternId} Prize`
          };
        }
      });
      
      return { ...config, gameType: newType, patterns };
    }));
  };

  const handlePatternSelect = (gameIndex: number, pattern: WinPattern) => {
    setGameConfigs(prev => prev.map((config, index) => {
      if (index !== gameIndex) return config;
      
      const patternId = pattern.id;
      const patterns = { ...config.patterns };
      
      // Toggle the active state of the pattern
      if (patterns[patternId]) {
        patterns[patternId] = {
          ...patterns[patternId],
          active: !patterns[patternId].active
        };
      } else {
        // Create the pattern if it doesn't exist - default to active when created
        patterns[patternId] = {
          active: true,
          isNonCash: false,
          prizeAmount: '10.00',
          description: `${pattern.name} Prize`
        };
      }
      
      return { ...config, patterns };
    }));
  };

  const handlePrizeChange = (gameIndex: number, patternId: string, prizeDetails: PrizeDetails) => {
    console.log(`Changing prize for game ${gameIndex + 1}, pattern ${patternId}:`, prizeDetails);
    
    setGameConfigs(prev => {
      const newConfigs = prev.map((config, index) => {
        if (index !== gameIndex) return config;
        
        // Ensure the patterns object exists
        const patterns = { ...config.patterns };
        
        // Update the prize details for this pattern
        patterns[patternId] = {
          ...patterns[patternId],
          isNonCash: !!prizeDetails.isNonCash,
          prizeAmount: prizeDetails.amount || '10.00',
          description: prizeDetails.description || ''
        };
        
        return {
          ...config,
          patterns
        };
      });
      
      console.log("Updated game configs after prize change:", newConfigs);
      return newConfigs;
    });
  };

  const saveGameSettings = async () => {
    if (!currentSession) return;
    
    const hasNoActivePatterns = gameConfigs.some(config => {
      return !Object.values(config.patterns || {}).some(pattern => pattern.active);
    });
    
    if (hasNoActivePatterns) {
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
      
      // Convert game configs to JSON format that ensures patterns are only active if explicitly true
      const jsonConfigs = gameConfigsToJson(gameConfigs);
      console.log("Converted game configs for database:", jsonConfigs);
      
      // Save directly using the updateSession function
      const success = await updateSession(currentSession.id, {
        games_config: gameConfigs
      });
      
      if (!success) {
        throw new Error("Failed to update session with game configs");
      }
      
      // First update the session_progress with first game's first active pattern
      if (gameConfigs.length > 0) {
        const firstGame = gameConfigs[0];
        const activePatternId = Object.entries(firstGame.patterns || {})
          .find(([_, config]) => config.active)?.[0] || 'oneLine';
        
        const { error: progressError } = await supabase
          .from('sessions_progress')
          .update({
            current_win_pattern: activePatternId,
            current_game_type: firstGame.gameType
          })
          .eq('session_id', currentSession.id);
          
        if (progressError) {
          console.error("Error updating session progress:", progressError);
          throw progressError;
        }
      }
      
      toast({
        title: "Success",
        description: "Game settings saved successfully.",
      });
      
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

  // Adapt game configs to pass down the pattern information correctly
  const adaptedGameConfigsForForms = gameConfigs.map(config => {
    const activePatterns = Object.entries(config.patterns || {})
      .filter(([_, patternConfig]) => patternConfig.active)
      .map(([patternId]) => patternId);
      
    const prizes: Record<string, PrizeDetails> = {};
    Object.entries(config.patterns || {}).forEach(([patternId, patternConfig]) => {
      prizes[patternId] = {
        amount: patternConfig.prizeAmount,
        description: patternConfig.description,
        isNonCash: patternConfig.isNonCash
      };
    });
    
    return {
      ...config,
      selectedPatterns: activePatterns,
      prizes
    };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Game Setup</h2>
      {adaptedGameConfigsForForms.map((config, index) => (
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
