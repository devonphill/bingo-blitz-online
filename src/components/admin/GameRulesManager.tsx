
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameType } from "@/types";
import { getDefaultPatternsForType } from '@/types';

interface GameRule {
  minPlayers: number;
  maxPlayers: number;
  patterns: string[];
  questionTime?: number;
  songDuration?: number;
  logoDisplayTime?: number;
}

// Define game rules directly in the component
const GAME_RULES_MAP: Record<string, GameRule> = {
  mainstage: {
    minPlayers: 1,
    maxPlayers: 500,
    patterns: ['oneLine', 'twoLines', 'fullHouse']
  },
  party: {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse']
  },
  quiz: {
    minPlayers: 2,
    maxPlayers: 50,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    questionTime: 30
  },
  music: {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    songDuration: 15
  },
  logo: {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    logoDisplayTime: 10
  }
};

export function GameRulesManager() {
  const gameTypes: GameType[] = ['mainstage', 'party', 'quiz', 'music', 'logo'];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Game Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {gameTypes.map((type) => (
            <div key={type} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 capitalize">{type} Rules</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Min Players</dt>
                  <dd>{GAME_RULES_MAP[type]?.minPlayers ?? 1}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Max Players</dt>
                  <dd>{GAME_RULES_MAP[type]?.maxPlayers ?? 100}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Win Patterns</dt>
                  <dd className="flex flex-wrap gap-2">
                    {GAME_RULES_MAP[type]?.patterns.map((pattern: string) => (
                      <span key={pattern} className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {pattern}
                      </span>
                    ))}
                  </dd>
                </div>
                {type === 'quiz' && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Question Time</dt>
                    <dd>{GAME_RULES_MAP['quiz']?.questionTime} seconds</dd>
                  </div>
                )}
                {type === 'music' && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Song Duration</dt>
                    <dd>{GAME_RULES_MAP['music']?.songDuration} seconds</dd>
                  </div>
                )}
                {type === 'logo' && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Logo Display Time</dt>
                    <dd>{GAME_RULES_MAP['logo']?.logoDisplayTime} seconds</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
