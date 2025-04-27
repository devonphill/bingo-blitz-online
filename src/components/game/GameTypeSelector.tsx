
import React from 'react';
import { Button } from '@/components/ui/button';
import { GameType } from '@/types';

interface GameTypeSelectorProps {
  onGameTypeSelect: (type: GameType) => void;
  currentGameType: GameType;
}

export default function GameTypeSelector({ 
  onGameTypeSelect, 
  currentGameType 
}: GameTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-base">Game Type</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={currentGameType === 'mainstage' ? 'default' : 'outline'}
          onClick={() => onGameTypeSelect('mainstage')}
        >
          Mainstage Bingo
        </Button>
        <Button
          variant={currentGameType === 'party' ? 'default' : 'outline'}
          onClick={() => onGameTypeSelect('party')}
        >
          Party Bingo
        </Button>
        <Button
          variant={currentGameType === 'quiz' ? 'default' : 'outline'}
          onClick={() => onGameTypeSelect('quiz')}
        >
          Quiz Bingo
        </Button>
        <Button
          variant={currentGameType === 'music' ? 'default' : 'outline'}
          onClick={() => onGameTypeSelect('music')}
        >
          Music Bingo
        </Button>
      </div>
    </div>
  );
}
