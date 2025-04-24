
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSessions } from "@/contexts/useSessions";

export function GameTypeChanger() {
  const { currentSession, updateCurrentGameState } = useSessions();
  
  const changeGameType = async (newType: '90-ball' | '75-ball') => {
    if (!currentSession) return;
    
    await updateCurrentGameState({
      gameType: newType,
      gameNumber: (currentSession.current_game_state?.gameNumber || 0) + 1,
      calledItems: [],
      lastCalledItem: null,
      activePatternIds: ['oneLine'],
      prizes: {},
      status: 'pending'
    });
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3">Change Game Type</h3>
      <div className="flex gap-4">
        <Button 
          variant={currentSession?.current_game_state?.gameType === '90-ball' ? 'default' : 'outline'}
          onClick={() => changeGameType('90-ball')}
        >
          90 Ball
        </Button>
        <Button 
          variant={currentSession?.current_game_state?.gameType === '75-ball' ? 'default' : 'outline'}
          onClick={() => changeGameType('75-ball')}
        >
          75 Ball
        </Button>
      </div>
    </div>
  );
}
