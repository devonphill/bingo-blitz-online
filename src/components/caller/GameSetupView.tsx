import React, { useState, useEffect } from 'react';
import { GameType, PrizeDetails, GameConfig } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameTypeSelector } from './GameTypeSelector';
import { WinPatternSelector } from './WinPatternSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
        
        return {
          gameNumber: index + 1,
          gameType: 'mainstage' as GameType,
          selectedPatterns: ['oneLine'],
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
    }
  }, [numberOfGames, gameConfigs, setGameConfigs]);
  
  const handleGameTypeChange = (gameIndex: number, type: GameType) => {
    const updatedConfigs = [...gameConfigs];
    updatedConfigs[gameIndex] = {
      ...updatedConfigs[gameIndex],
      gameType: type
    };
    setGameConfigs(updatedConfigs);
  };
  
  const handlePatternSelect = (gameIndex: number, pattern: WinPattern) => {
    const updatedConfigs = [...gameConfigs];
    const config = updatedConfigs[gameIndex];
    
    const selectedPatterns = [...config.selectedPatterns];
    const patternId = pattern.id;
    const patternIndex = selectedPatterns.indexOf(patternId);
    
    if (patternIndex >= 0) {
      selectedPatterns.splice(patternIndex, 1);
      const updatedPrizes = {...config.prizes};
      delete updatedPrizes[patternId];
      config.prizes = updatedPrizes;
    } else {
      selectedPatterns.push(patternId);
      
      if (!config.prizes[patternId]) {
        config.prizes[patternId] = {
          amount: '10.00',
          isNonCash: false,
          description: `${pattern.name} Prize`
        };
      }
    }
    
    config.selectedPatterns = selectedPatterns;
    setGameConfigs(updatedConfigs);
  };
  
  const handlePrizeChange = (gameIndex: number, patternId: string, prizeDetails: PrizeDetails) => {
    const updatedConfigs = [...gameConfigs];
    const config = updatedConfigs[gameIndex];
    
    config.prizes = {
      ...config.prizes,
      [patternId]: prizeDetails
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
          games_config: JSON.parse(gameConfigsJson),
          current_game_state: {
            gameNumber: gameConfigs[0].gameNumber,
            gameType: gameConfigs[0].gameType,
            activePatternIds: gameConfigs[0].selectedPatterns,
            prizes: gameConfigs[0].prizes,
            status: 'pending',
            calledItems: [],
            lastCalledItem: null
          }
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
              selectedPatterns={config.selectedPatterns}
              onPatternSelect={(pattern) => handlePatternSelect(index, pattern)}
              prizes={config.prizes}
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
              disabled={isGoingLive || (gameConfigs.length > 0 && gameConfigs[0].selectedPatterns.length === 0)}
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
