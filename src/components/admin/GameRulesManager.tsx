
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameType, GAME_RULES } from "@/types";

export function GameRulesManager() {
  const gameTypes: GameType[] = ['mainstage', 'party' as GameType, 'quiz' as GameType, 'music' as GameType, 'logo' as GameType];

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
                  <dd>{GAME_RULES[type].minPlayers}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Max Players</dt>
                  <dd>{GAME_RULES[type].maxPlayers}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Win Patterns</dt>
                  <dd className="flex flex-wrap gap-2">
                    {GAME_RULES[type].patterns.map((pattern: string) => (
                      <span key={pattern} className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {pattern}
                      </span>
                    ))}
                  </dd>
                </div>
                {type === 'quiz' as GameType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Question Time</dt>
                    <dd>{GAME_RULES['quiz'].questionTime} seconds</dd>
                  </div>
                )}
                {type === 'music' as GameType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Song Duration</dt>
                    <dd>{GAME_RULES['music'].songDuration} seconds</dd>
                  </div>
                )}
                {type === 'logo' as GameType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Logo Display Time</dt>
                    <dd>{GAME_RULES['logo'].logoDisplayTime} seconds</dd>
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
