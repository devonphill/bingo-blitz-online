
export interface WinPattern {
  id: string;
  name: string;
  gameType: GameType;
  available: boolean;
}

// Define GameType to include all possible game types
export type GameType = 'mainstage' | 'party' | 'quiz' | 'music' | 'logo' | '90-ball' | '75-ball' | 'speed' | 'custom';

export const WIN_PATTERNS: { [key in GameType]: WinPattern[] } = {
  mainstage: [
    { id: 'oneLine', name: 'One Line', gameType: 'mainstage', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'mainstage', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'mainstage', available: true }
  ],
  party: [
    { id: 'corners', name: 'Corners', gameType: 'party', available: true },
    { id: 'oneLine', name: 'One Line', gameType: 'party', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'party', available: true },
    { id: 'threeLines', name: 'Three Lines', gameType: 'party', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'party', available: true }
  ],
  quiz: [
    { id: 'oneLine', name: 'One Line', gameType: 'quiz', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'quiz', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'quiz', available: true }
  ],
  music: [
    { id: 'oneLine', name: 'One Line', gameType: 'music', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'music', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'music', available: true }
  ],
  logo: [
    { id: 'oneLine', name: 'One Line', gameType: 'logo', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'logo', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'logo', available: true }
  ],
  '90-ball': [
    { id: 'oneLine', name: 'One Line', gameType: '90-ball', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: '90-ball', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: '90-ball', available: true }
  ],
  '75-ball': [
    { id: 'oneLine', name: 'One Line', gameType: '75-ball', available: true },
    { id: 'coverAll', name: 'Cover All', gameType: '75-ball', available: true }
  ],
  speed: [
    { id: 'oneLine', name: 'One Line', gameType: 'speed', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'speed', available: true }
  ],
  custom: [
    { id: 'oneLine', name: 'One Line', gameType: 'custom', available: true },
    { id: 'twoLines', name: 'Two Lines', gameType: 'custom', available: true },
    { id: 'fullHouse', name: 'Full House', gameType: 'custom', available: true }
  ]
};

// Helper function to get default patterns for a game type
export function getDefaultPatternsForGameType(gameType: GameType): string[] {
  const patterns = WIN_PATTERNS[gameType];
  if (!patterns) return ['oneLine', 'twoLines', 'fullHouse'];
  return patterns.map(p => p.id);
}
