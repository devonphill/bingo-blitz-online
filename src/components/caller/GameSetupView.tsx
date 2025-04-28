import React, { useState, useEffect } from 'react';
import { GameType, PrizeDetails, GameConfig, WinPatternConfig, isLegacyGameConfig, convertLegacyGameConfig } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameTypeSelector } from './GameTypeSelector';
import { WinPatternSelector } from './WinPatternSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { jsonToGameConfigs, gameConfigsToJson } from '@/utils/jsonUtils';

interface GameSetupViewProps {
  currentGameType: GameType;
  onGameTypeChange: (type: GameType) => void;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect: (pattern: WinPattern) => void;
  onGoLive: () => Promise<void>;
  isGoingLive: boolean;
  prizes?: { [patternId: string]: PrizeDetails };
  onPrizeChange?: (patternId: string, prizeDetails: PrizeDetails) => void;
  gameConfigs: GameConfig[];
  numberOfGames: number;
  setGameConfigs: (configs: GameConfig[]) => void;
}

export function GameSetupView({
  currentGameType,
  onGameTypeChange,
  winPatterns,
  selectedPatterns,
  onPatternSelect,
  onGoLive,
  isGoingLive,
  prizes = {},
  onPrizeChange,
  gameConfigs,
  numberOfGames,
  setGameConfigs
}: GameSetupViewProps) {
  const [activeTab, setActiveTab] = useState("game-1");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedConfig, setLastSavedConfig] = useState("");
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("GameSetupView - gameConfigs:", gameConfigs);
    console.log("GameSetupView - numberOfGames:", numberOfGames);
    
    // Initialize game configs if needed
    if (!gameConfigs || gameConfigs.length !== numberOfGames) {
      initializeGameConfigs();
    } else {
      // Store the initial configuration as a JSON string for comparison
      setLastSavedConfig(JSON.stringify(gameConfigs));
    }
  }, [gameConfigs, numberOfGames]);
  
  const initializeGameConfigs = () => {
    const newConfigs = Array.from({ length: numberOfGames }, (_, index) => {
      const existingConfig = gameConfigs[index];
      if (existingConfig) {
        return existingConfig;
      }
      
      const patterns: Record<string, WinPatternConfig> = {};
      const gameType = 'mainstage' as GameType;
      
      WIN_PATTERNS[gameType].forEach(pattern => {
        patterns[pattern.id] = {
          active: false,
          isNonCash: false,
          prizeAmount: '10.00',
          description: `${pattern.name} Prize`
        };
      });
      
      return {
        gameNumber: index + 1,
        gameType: gameType,
        patterns: patterns
      };
    });
    
    console.log("Initialized game configs:", newConfigs);
    setGameConfigs(newConfigs);
    // Store the initial configuration
    setLastSavedConfig(JSON.stringify(newConfigs));
    // Auto-save the initialized configurations
    saveGameConfigs(newConfigs);
  };

  const handleGameTypeChange = (gameIndex: number, type: GameType) => {
    const updatedConfigs = [...gameConfigs];
    const oldGameType = updatedConfigs[gameIndex].gameType;
    
    const patterns: Record<string, WinPatternConfig> = {};
    
    WIN_PATTERNS[type].forEach(pattern => {
      const existingPattern = updatedConfigs[gameIndex].patterns[pattern.id];
      if (existingPattern) {
        patterns[pattern.id] = existingPattern;
      } else {
        // For new patterns, set defaults
        patterns[pattern.id] = {
          active: ['oneLine'].includes(pattern.id),
          isNonCash: false,
          prizeAmount: '10.00',
          description: `${pattern.name} Prize`
        };
      }
    });
    
    updatedConfigs[gameIndex] = {
      ...updatedConfigs[gameIndex],
      gameType: type,
      patterns
    };
    
    setGameConfigs(updatedConfigs);
    // Auto-save when game type changes
    saveGameConfigs(updatedConfigs);
  };
  
  const handlePatternSelect = (gameIndex: number, pattern: WinPattern) => {
    const updatedConfigs = [...gameConfigs];
    const patternId = pattern.id;
    
    if (updatedConfigs[gameIndex].patterns[patternId]) {
      updatedConfigs[gameIndex].patterns[patternId] = {
        ...updatedConfigs[gameIndex].patterns[patternId],
        active: !updatedConfigs[gameIndex].patterns[patternId].active
      };
    } else {
      updatedConfigs[gameIndex].patterns[patternId] = {
        active: true,
        isNonCash: false,
        prizeAmount: '10.00',
        description: `${pattern.name} Prize`
      };
    }
    
    setGameConfigs(updatedConfigs);
    // Auto-save when patterns are selected/deselected
    saveGameConfigs(updatedConfigs);
  };
  
  const handlePrizeChange = (gameIndex: number, patternId: string, prizeDetails: PrizeDetails) => {
    const updatedConfigs = [...gameConfigs];
    
    updatedConfigs[gameIndex].patterns[patternId] = {
      ...updatedConfigs[gameIndex].patterns[patternId],
      isNonCash: !!prizeDetails.isNonCash,
      prizeAmount: prizeDetails.amount || '10.00',
      description: prizeDetails.description || ''
    };
    
    setGameConfigs(updatedConfigs);
    
    // Debounced save for prize changes
    const timer = setTimeout(() => {
      saveGameConfigs(updatedConfigs);
    }, 1000);
    
    return () => clearTimeout(timer);
  };
  
  const saveGameConfigs = async (configsToSave = gameConfigs) => {
    if (isSaving) return;
    
    // Check if there are any changes since last save
    const currentConfigJson = JSON.stringify(configsToSave);
    if (currentConfigJson === lastSavedConfig) {
      console.log("No changes detected since last save, skipping");
      return;
    }
    
    setIsSaving(true);
    try {
      // Convert GameConfig[] to a JSON-compatible format for the database
      const jsonConfigs = gameConfigsToJson(configsToSave);
      const sessionId = localStorage.getItem('currentSessionId');
      
      if (!sessionId) {
        throw new Error("No session ID found");
      }
      
      console.log("Saving game configs to database:", jsonConfigs);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          games_config: jsonConfigs
        })
        .eq('id', sessionId)
        .select('games_config');
        
      if (error) {
        console.error("Error saving game configs:", error);
        toast({
          title: "Error",
          description: "Failed to save game configurations.",
          variant: "destructive"
        });
      } else {
        console.log("Game configs saved successfully:", data);
        // Update the last saved config
        setLastSavedConfig(currentConfigJson);
        toast({
          title: "Success",
          description: "Game configurations saved successfully.",
        });
      }
    } catch (err) {
      console.error("Exception during save operation:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Display message if no game configs are loaded yet
  if (!gameConfigs || gameConfigs.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Game Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p>Loading game configurations...</p>
            <Button onClick={initializeGameConfigs}>Initialize Game Configs</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const gameTabs = Array.from({ length: numberOfGames }, (_, index) => {
    const gameNumber = index + 1;
    return (
      <TabsTrigger 
        key={`game-${gameNumber}`} 
        value={`game-${gameNumber}`}
      >
        Game {gameNumber}
      </TabsTrigger>
    );
  });
  
  const gameTabsContent = gameConfigs.map((config, index) => {
    const gameNumber = index + 1;
    const gameType = config.gameType;
    const patterns = WIN_PATTERNS[gameType] || [];
    
    const activePatterns = Object.entries(config.patterns)
      .filter(([_, patternConfig]) => patternConfig.active)
      .map(([patternId]) => patternId);
      
    const prizeDetails: Record<string, PrizeDetails> = {};
    Object.entries(config.patterns).forEach(([patternId, patternConfig]) => {
      prizeDetails[patternId] = {
        amount: patternConfig.prizeAmount,
        description: patternConfig.description,
        isNonCash: patternConfig.isNonCash
      };
    });
    
    return (
      <TabsContent key={`game-${gameNumber}-content`} value={`game-${gameNumber}`}>
        <Card>
          <CardHeader>
            <CardTitle>Game {gameNumber} Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <GameTypeSelector 
              currentGameType={config.gameType} 
              onGameTypeChange={(type) => handleGameTypeChange(index, type)}
            />
            
            <WinPatternSelector
              patterns={patterns}
              selectedPatterns={activePatterns}
              onPatternSelect={(pattern) => handlePatternSelect(index, pattern)}
              prizes={prizeDetails}
              onPrizeChange={(patternId, details) => handlePrizeChange(index, patternId, details)}
            />
          </CardContent>
        </Card>
      </TabsContent>
    );
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Game Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="game-1" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(numberOfGames, 5)}, minmax(0, 1fr))` }}>
              {gameTabs}
            </TabsList>
            {gameTabsContent}
          </Tabs>
          
          <div className="flex gap-4">
            <Button 
              onClick={() => saveGameConfigs()}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? "Saving..." : "Save All Game Configurations"}
            </Button>
            
            <Button 
              onClick={async () => {
                await saveGameConfigs();
                onGoLive();
              }}
              disabled={isGoingLive || (gameConfigs.length > 0 && !Object.values(gameConfigs[0].patterns).some(p => p.active))}
              variant="default"
              className="flex-1"
            >
              {isGoingLive ? "Starting Game..." : "Go Live"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
