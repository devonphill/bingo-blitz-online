
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Image, Mic, PartyPopper, Star } from "lucide-react";
import { WinPatternSelector } from "@/components/caller/WinPatternSelector";
import { WinPattern } from '@/types/winPattern';

interface WinPatternOption {
  id: string;
  name: string;
  active: boolean;
}

export function GameSetup() {
  const { currentSession, updateCurrentGameState } = useSessions();
  
  const [selectedGameType, setSelectedGameType] = useState<GameType>('mainstage');
  const [winPatterns, setWinPatterns] = useState<WinPatternOption[]>([
    { id: 'oneLine', name: 'One Line', active: false },
    { id: 'twoLines', name: 'Two Lines', active: false },
    { id: 'fullHouse', name: 'Full House', active: false },
  ]);
  const [prizes, setPrizes] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (currentSession?.current_game_state) {
      setSelectedGameType(currentSession.current_game_state.gameType);
      
      const activePatternIds = currentSession.current_game_state.activePatternIds || [];
      setWinPatterns(prev => 
        prev.map(pattern => ({
          ...pattern,
          active: activePatternIds.includes(pattern.id)
        }))
      );
      
      setPrizes(currentSession.current_game_state.prizes || {});
    }
  }, [currentSession]);

  const handleGameTypeChange = (newType: GameType) => {
    setSelectedGameType(newType);
  };

  const gameTypes = [
    { type: 'mainstage', label: 'Mainstage Bingo', icon: Star },
    { type: 'party', label: 'Party Bingo', icon: PartyPopper },
    { type: 'quiz', label: 'Quiz Bingo', icon: Mic },
    { type: 'music', label: 'Music Bingo', icon: Music },
    { type: 'logo', label: 'Logo Bingo', icon: Image },
  ] as const;

  const toggleWinPattern = (pattern: WinPattern) => {
    setWinPatterns(prev => 
      prev.map(wp => ({
        ...wp,
        active: wp.id === pattern.id ? !wp.active : wp.active
      }))
    );
  };

  const handlePrizeChange = (patternId: string, value: string) => {
    console.log(`Prize change for ${patternId}: ${value}`);
    setPrizes(prev => ({
      ...prev,
      [patternId]: value
    }));
  };

  const saveGameSettings = async () => {
    if (!currentSession) return;
    
    const activePatternIds = winPatterns
      .filter(pattern => pattern.active)
      .map(pattern => pattern.id);
    
    await updateCurrentGameState({
      gameType: selectedGameType,
      activePatternIds,
      prizes,
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Game Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Game Type</h3>
          <div className="flex flex-wrap gap-2">
            {gameTypes.map(({ type, label, icon: Icon }) => (
              <Button 
                key={type}
                variant={selectedGameType === type ? 'default' : 'outline'}
                onClick={() => handleGameTypeChange(type as GameType)}
                className="flex-1"
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <WinPatternSelector
            patterns={winPatterns.map(wp => ({
              id: wp.id,
              name: wp.name,
              available: true,
              gameType: selectedGameType
            }))}
            selectedPatterns={winPatterns.filter(wp => wp.active).map(wp => wp.id)}
            onPatternSelect={toggleWinPattern}
            prizes={prizes}
            onPrizeChange={handlePrizeChange}
          />
        </div>
        
        <Button className="w-full" onClick={saveGameSettings}>
          Save Game Settings
        </Button>
      </CardContent>
    </Card>
  );
}
