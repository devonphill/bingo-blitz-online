
import React from 'react';
import { GameType } from '@/types/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Music, Image, Mic, PartyPopper, Star } from 'lucide-react';

interface GameTypeSelectorProps {
  currentGameType: GameType;
  onGameTypeChange: (type: GameType) => void;
}

export function GameTypeSelector({ currentGameType, onGameTypeChange }: GameTypeSelectorProps) {
  const gameTypes = [
    { type: 'mainstage' as GameType, label: 'Mainstage Bingo', icon: Star },
    { type: 'party' as GameType, label: 'Party Bingo', icon: PartyPopper },
    { type: 'quiz' as GameType, label: 'Quiz Bingo', icon: Mic },
    { type: 'music' as GameType, label: 'Music Bingo', icon: Music },
    { type: 'logo' as GameType, label: 'Logo Bingo', icon: Image }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Game Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {gameTypes.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              onClick={() => onGameTypeChange(type)}
              variant={currentGameType === type ? 'default' : 'outline'}
              className="w-full flex items-center justify-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
