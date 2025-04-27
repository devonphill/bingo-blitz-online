
import { GameConfig } from './index';

// Sample game configuration that can be used for manual updates
export const sampleGameConfig: GameConfig[] = [
  {
    gameNumber: 1,
    gameType: 'mainstage',
    patterns: {
      'oneLine': {
        active: true,
        isNonCash: false,
        prizeAmount: '10.00',
        description: 'One Line Prize'
      }
    },
    // Legacy format support
    selectedPatterns: ['oneLine'],
    prizes: {
      'oneLine': {
        amount: '10.00',
        isNonCash: false,
        description: 'One Line Prize'
      }
    }
  }
];

// Function to convert game config to JSON string for database
export const gameConfigToJson = (config: GameConfig[]): string => {
  return JSON.stringify(config);
};

// Sample JSON string that can be copied/pasted directly in the database
export const sampleGameConfigJson = gameConfigToJson(sampleGameConfig);
