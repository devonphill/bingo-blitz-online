
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";
import { GameType } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Music, Image, Mic, PartyPopper, Star } from "lucide-react";

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

  // Initialize state from current session
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

  const toggleWinPattern = (patternId: string) => {
    setWinPatterns(prev => 
      prev.map(pattern => ({
        ...pattern,
        active: pattern.id === patternId ? !pattern.active : pattern.active
      }))
    );
  };

  const handlePrizeChange = (patternId: string, value: string) => {
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
          <h3 className="text-sm font-medium">Win Patterns</h3>
          <div className="grid gap-3">
            {winPatterns.map((pattern) => (
              <div key={pattern.id} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`pattern-${pattern.id}`}
                    checked={pattern.active}
                    onCheckedChange={() => toggleWinPattern(pattern.id)}
                  />
                  <Label htmlFor={`pattern-${pattern.id}`}>{pattern.name}</Label>
                </div>
                <div className="w-24">
                  <Input
                    placeholder="Prize"
                    disabled={!pattern.active}
                    value={prizes[pattern.id] || ''}
                    onChange={(e) => handlePrizeChange(pattern.id, e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <Button className="w-full" onClick={saveGameSettings}>
          Save Game Settings
        </Button>
      </CardContent>
    </Card>
  );
}
