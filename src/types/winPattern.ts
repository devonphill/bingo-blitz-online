
export interface WinPattern {
  id: string;
  name: string;
  gameType: 'mainstage' | 'party' | 'quiz' | 'music' | 'logo';
  available: boolean;
}

export type GameType = 'mainstage' | 'party' | 'quiz' | 'music' | 'logo';

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
  ]
};
