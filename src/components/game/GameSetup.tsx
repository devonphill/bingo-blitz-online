
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType, PrizeDetails } from "@/types";
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
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

  useEffect(() => {
    if (currentSession) {
      const numberOfGames = currentSession.numberOfGames || 1;
      const currentConfigs = currentSession.games_config as GameConfig[] || [];
      
      // Initialize configs for all games
      setGameConfigs(Array.from({ length: numberOfGames }, (_, index) => ({
        gameType: currentConfigs[index]?.gameType || 'mainstage',
        selectedPatterns: currentConfigs[index]?.selectedPatterns || [],
        prizes: currentConfigs[index]?.prizes || {}
      })));
    }
  }, [currentSession]);

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
      await updateCurrentGameState({
        gameType: gameConfigs[0].gameType, // Current game type
        activePatternIds: gameConfigs[0].selectedPatterns,
        prizes: gameConfigs[0].prizes,
        status: 'pending',
      });

      // Save all game configs to the games_config column
      const { error } = await supabase
        .from('game_sessions')
        .update({ games_config: gameConfigs })
        .eq('id', currentSession.id);

      if (error) throw error;
      
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

  return (
    <div className="space-y-6">
      {gameConfigs.map((config, index) => (
        <GameConfigForm
          key={index}
          gameNumber={index + 1}
          gameType={config.gameType}
          onGameTypeChange={(type) => handleGameTypeChange(index, type)}
          winPatterns={WIN_PATTERNS[config.gameType] || []}
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
