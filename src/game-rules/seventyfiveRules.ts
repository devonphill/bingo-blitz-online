
import type { GameRules } from './types';
import type { WinPatternConfig } from '@/hooks/useWinPatternManagement';

export class SevenfiveRules implements GameRules {
  getGameTypeName(): string {
    return '75-ball';
  }
  
  getDefaultWinPatterns(): WinPatternConfig[] {
    return [
      {
        id: "pattern",
        name: "Pattern",
        active: true,
        prize: "",
        order: 1
      },
      {
        id: "blackout",
        name: "Blackout",
        active: true,
        prize: "",
        order: 2
      }
    ];
  }
  
  validateWin(patternId: string, ticket: any, calledNumbers: number[]): boolean {
    // This is a placeholder implementation for 75-ball
    // In a real implementation, we would check pattern-specific validation
    
    if (patternId === "blackout") {
      // Blackout requires all numbers to be called
      return ticket.numbers.every((num: number) => calledNumbers.includes(num));
    }
    
    // For pattern wins, we'd need pattern-specific logic
    // This is just a simplified implementation
    return false;
  }
  
  getWinDistance(patternId: string, ticket: any, calledNumbers: number[]): number {
    // This is a placeholder implementation
    if (patternId === "blackout") {
      // Count uncalled numbers
      const uncalledCount = ticket.numbers.filter(
        (num: number) => !calledNumbers.includes(num)
      ).length;
      return uncalledCount;
    }
    
    // For pattern-specific distance calculation
    return Infinity;
  }
}
