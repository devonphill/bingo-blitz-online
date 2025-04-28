
import React, { useState, useEffect } from 'react';
import { GameType, PrizeDetails, GameConfig, WinPatternConfig } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameTypeSelector } from './GameTypeSelector';
import { WinPatternSelector } from './WinPatternSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { gameConfigsToJson } from '@/utils/jsonUtils';

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
  sessionId?: string; // Add sessionId prop to receive it from parent
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
  setGameConfigs,
  sessionId // Receive sessionId from parent
}: GameSetupViewProps) {
  const [activeTab, setActiveTab] = useState("game-1");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedConfig, setLastSavedConfig] = useState("");
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("GameSetupView - initialized with gameConfigs:", gameConfigs);
    console.log("GameSetupView - numberOfGames:", numberOfGames);
    console.log("GameSetupView - sessionId:", sessionId);
    
    // Initialize game configs if needed
    if (!gameConfigs || gameConfigs.length !== numberOfGames) {
      console.log("Game configs not initialized, initializing now");
      initializeGameConfigs();
    } else {
      // Store the initial configuration as a JSON string for comparison
      const configJson = JSON.stringify(gameConfigs);
      console.log("Initial game configs JSON:", configJson);
      setLastSavedConfig(configJson);
    }
  }, []);
  
  const initializeGameConfigs = () => {
    console.log("Initializing game configs with NO ACTIVE patterns by default");
    
    const newConfigs = Array.from({ length: numberOfGames }, (_, index) => {
      const existingConfig = gameConfigs[index];
      if (existingConfig) {
        console.log(`Using existing config for game ${index + 1}:`, existingConfig);
        return existingConfig;
      }
      
      const patterns: Record<string, WinPatternConfig> = {};
      const gameType = currentGameType || 'mainstage';
      
      WIN_PATTERNS[gameType].forEach(pattern => {
        patterns[pattern.id] = {
          // CRITICAL: No patterns are active by default
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
    const configJson = JSON.stringify(newConfigs);
    setLastSavedConfig(configJson);
    
    // Auto-save the initialized configurations
    saveGameConfigs(newConfigs);
  };

  const handleGameTypeChange = (gameIndex: number, type: GameType) => {
    console.log(`Changing game ${gameIndex + 1} type to: ${type}`);
    
    const updatedConfigs = [...gameConfigs];
    
    const patterns: Record<string, WinPatternConfig> = {};
    
    WIN_PATTERNS[type].forEach(pattern => {
      const existingPattern = updatedConfigs[gameIndex]?.patterns?.[pattern.id];
      if (existingPattern) {
        patterns[pattern.id] = existingPattern;
      } else {
        // For new patterns, set defaults - NO patterns active by default
        patterns[pattern.id] = {
          active: false, 
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
    
    console.log(`Updated game ${gameIndex + 1} config:`, updatedConfigs[gameIndex]);
    setGameConfigs(updatedConfigs);
    
    // Auto-save when game type changes
    saveGameConfigs(updatedConfigs);
  };
  
  const handlePatternSelect = (gameIndex: number, pattern: WinPattern) => {
    console.log(`Toggling pattern ${pattern.id} for game ${gameIndex + 1}`);
    const updatedConfigs = [...gameConfigs];
    const patternId = pattern.id;
    
    if (!updatedConfigs[gameIndex]) {
      console.error(`Game config for index ${gameIndex} does not exist`);
      return;
    }
    
    if (!updatedConfigs[gameIndex].patterns) {
      updatedConfigs[gameIndex].patterns = {};
    }
    
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
    
    console.log(`Updated pattern ${patternId}:`, updatedConfigs[gameIndex].patterns[patternId]);
    console.log(`Full updated config:`, updatedConfigs);
    setGameConfigs(updatedConfigs);
    
    // Auto-save when patterns are selected/deselected
    saveGameConfigs(updatedConfigs);
  };
  
  const handlePrizeChange = (gameIndex: number, patternId: string, prizeDetails: PrizeDetails) => {
    console.log(`Changing prize for pattern ${patternId} in game ${gameIndex + 1}:`, prizeDetails);
    
    const updatedConfigs = [...gameConfigs];
    
    if (!updatedConfigs[gameIndex] || !updatedConfigs[gameIndex].patterns) {
      console.error(`Cannot update prize: game or patterns object doesn't exist for game ${gameIndex + 1}`);
      return;
    }
    
    updatedConfigs[gameIndex].patterns[patternId] = {
      ...updatedConfigs[gameIndex].patterns[patternId],
      isNonCash: !!prizeDetails.isNonCash,
      prizeAmount: prizeDetails.amount || '10.00',
      description: prizeDetails.description || ''
    };
    
    console.log(`Updated config after prize change:`, updatedConfigs);
    setGameConfigs(updatedConfigs);
    
    // Debounced save for prize changes
    const timer = setTimeout(() => {
      saveGameConfigs(updatedConfigs);
    }, 1000);
    
    return () => clearTimeout(timer);
  };
  
  const saveGameConfigs = async (configsToSave = gameConfigs) => {
    if (isSaving) {
      console.log("Already saving, skipping this save operation");
      return;
    }
    
    // Check if there are any changes since last save
    const currentConfigJson = JSON.stringify(configsToSave);
    if (currentConfigJson === lastSavedConfig) {
      console.log("No changes detected since last save, skipping");
      return;
    }
    
    setIsSaving(true);
    try {
      // Convert GameConfig[] to a JSON-compatible format for the database
      // This ensures patterns are only active if explicitly true
      console.log("Converting configs to JSON for database save:", configsToSave);
      
      const jsonConfigs = gameConfigsToJson(configsToSave);
      
      // Use the passed sessionId prop instead of localStorage
      if (!sessionId) {
        throw new Error("No session ID provided to GameSetupView");
      }
      
      console.log(`Saving game configs to database for session ${sessionId}:`, jsonConfigs);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          games_config: jsonConfigs
        })
        .eq('id', sessionId)
        .select('games_config');
        
      if (error) {
        console.error("Error saving game configs:", error);
        throw new Error(`Database error: ${error.message}`);
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
      const errorMessage = `Error during save operation: ${(err as Error).message}`;
      console.error(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
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
    
    const activePatterns = Object.entries(config.patterns || {})
      .filter(([_, patternConfig]) => patternConfig.active === true)
      .map(([patternId]) => patternId);
      
    console.log(`Game ${gameNumber} active patterns:`, activePatterns);
      
    const prizeDetails: Record<string, PrizeDetails> = {};
    Object.entries(config.patterns || {}).forEach(([patternId, patternConfig]) => {
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
              disabled={isGoingLive || (gameConfigs.length > 0 && !Object.values(gameConfigs[0].patterns || {}).some(p => p.active === true))}
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
