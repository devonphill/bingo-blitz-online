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
import { Json, parseGameConfigs } from '@/types/json';

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
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("GameSetupView - gameConfigs:", gameConfigs);
    console.log("GameSetupView - numberOfGames:", numberOfGames);
  }, [gameConfigs, numberOfGames]);

  useEffect(() => {
    if (!gameConfigs || gameConfigs.length !== numberOfGames) {
      const newConfigs = Array.from({ length: numberOfGames }, (_, index) => {
        const existingConfig = gameConfigs[index];
        if (existingConfig) {
          return existingConfig;
        }
        
        const patterns: Record<string, WinPatternConfig> = {};
        const gameType = 'mainstage' as GameType;
        
        WIN_PATTERNS[gameType].forEach(pattern => {
          patterns[pattern.id] = {
            active: ['oneLine'].includes(pattern.id),
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
      
      setGameConfigs(newConfigs);
    }
  }, [numberOfGames, gameConfigs, setGameConfigs]);
  
  const handleGameTypeChange = (gameIndex: number, type: GameType) => {
    const updatedConfigs = [...gameConfigs];
    const oldGameType = updatedConfigs[gameIndex].gameType;
    
    const patterns: Record<string, WinPatternConfig> = {};
    
    WIN_PATTERNS[type].forEach(pattern => {
      const existingPattern = updatedConfigs[gameIndex].patterns[pattern.id];
      if (existingPattern) {
        patterns[pattern.id] = existingPattern;
      } else {
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
  };
  
  const saveGameConfigs = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const gameConfigsJson = JSON.stringify(gameConfigs);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          games_config: JSON.parse(gameConfigsJson)
        })
        .eq('id', localStorage.getItem('currentSessionId'))
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
            <TabsList className="grid grid-cols-5 mb-4">
              {gameTabs}
            </TabsList>
            {gameTabsContent}
          </Tabs>
          
          <div className="flex gap-4">
            <Button 
              onClick={saveGameConfigs} 
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? "Saving..." : "Save All Game Configurations"}
            </Button>
            
            <Button 
              onClick={onGoLive}
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
