
import React from 'react';
import { Button } from '@/components/ui/button';

interface GameTypeSelectorProps {
  onGameTypeSelect: (type: string) => void;
}

export default function GameTypeSelector({ onGameTypeSelect }: GameTypeSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow p-8 rounded-lg max-w-xs w-full text-center">
        <h2 className="text-2xl font-bold mb-3">Select Game Type</h2>
        <Button
          className="w-full mb-2"
          onClick={() => onGameTypeSelect('90-ball')}
        >
          90-Ball Bingo
        </Button>
      </div>
    </div>
  );
}
