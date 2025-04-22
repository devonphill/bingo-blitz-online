import type { GameRules } from './types';
import type { WinPatternConfig } from '@/hooks/useWinPatternManagement';

export class NinetyBallRules implements GameRules {
  getGameTypeName(): string {
    return '90-ball';
  }
  
  getDefaultWinPatterns(): WinPatternConfig[] {
    return [
      {
        id: "oneLine",
        name: "One Line",
        active: true,
        prize: "",
        order: 1
      },
      {
        id: "twoLines",
        name: "Two Lines",
        active: true,
        prize: "",
        order: 2
      },
      {
        id: "fullHouse",
        name: "Full House",
        active: true,
        prize: "",
        order: 3
      }
    ];
  }
  
  validateWin(patternId: string, ticket: any, calledNumbers: number[]): boolean {
    // Extract ticket data
    const layoutMask = ticket.layoutMask;
    const numbers = ticket.numbers;
    
    if (!layoutMask || !numbers || !Array.isArray(numbers)) {
      console.error("Invalid ticket data for validation:", ticket);
      return false;
    }
    
    // Convert layout mask to rows
    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const rows: number[][] = [[], [], []];
    let numIndex = 0;
    
    for (let i = 0; i < 27; i++) {
      const row = Math.floor(i / 9);
      if (maskBits[i] === '1') {
        rows[row].push(numbers[numIndex]);
        numIndex++;
      }
    }
    
    // Calculate how many complete rows we have
    const completeRows = rows.filter(row => 
      row.length > 0 && row.every(num => calledNumbers.includes(num))
    ).length;
    
    // Validate based on pattern
    switch (patternId) {
      case "oneLine":
        return completeRows >= 1;
        
      case "twoLines":
        return completeRows >= 2;
        
      case "fullHouse":
        return numbers.every(num => calledNumbers.includes(num));
        
      default:
        console.warn(`Unknown win pattern "${patternId}" for 90-ball validation`);
        return false;
    }
  }
  
  getWinDistance(patternId: string, ticket: any, calledNumbers: number[]): number {
    // Extract ticket data
    const layoutMask = ticket.layoutMask;
    const numbers = ticket.numbers;
    
    if (!layoutMask || !numbers || !Array.isArray(numbers)) {
      return Infinity;
    }
    
    // Convert layout mask to rows
    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const rows: (number | null)[][] = [[], [], []];
    let numIndex = 0;
    
    for (let i = 0; i < 27; i++) {
      const row = Math.floor(i / 9);
      if (maskBits[i] === '1') {
        rows[row].push(numbers[numIndex]);
        numIndex++;
      } else {
        rows[row].push(null);
      }
    }
    
    // Calculate numbers called per row and numbers needed per row
    const lineCounts = rows.map(line => 
      line.filter(num => num !== null && calledNumbers.includes(num as number)).length
    );
    
    const lineNeeded = rows.map(line => 
      line.filter(num => num !== null).length
    );
    
    // Calculate how many complete rows we have
    const completedLines = lineCounts.filter((count, idx) => 
      count === lineNeeded[idx]
    ).length;
    
    // Calculate distance based on pattern
    switch (patternId) {
      case "oneLine": {
        // If we already have at least one line, distance is 0
        if (completedLines >= 1) return 0;
        
        // Otherwise, find the row that's closest to completion
        const incompleteCounts = rows.map((line, idx) => {
          const numsMissing = lineNeeded[idx] - lineCounts[idx];
          return numsMissing > 0 ? numsMissing : Infinity;
        });
        
        return Math.min(...incompleteCounts.filter(n => n !== Infinity));
      }
      
      case "twoLines": {
        // If we already have at least two lines, distance is 0
        if (completedLines >= 2) return 0;
        
        // If we have one line, distance is minimum to complete another line
        if (completedLines === 1) {
          const incompleteCounts = rows.map((line, idx) => {
            // Skip already complete lines
            if (lineCounts[idx] === lineNeeded[idx]) return Infinity;
            const numsMissing = lineNeeded[idx] - lineCounts[idx];
            return numsMissing > 0 ? numsMissing : Infinity;
          });
          
          return Math.min(...incompleteCounts.filter(n => n !== Infinity));
        }
        
        // If we have no complete lines, count how many we need for fastest two lines
        const sortedNumsToComplete = rows.map((line, idx) => 
          lineNeeded[idx] - lineCounts[idx]
        ).sort((a, b) => a - b);
        
        // Add the two smallest distances (for two lines)
        return sortedNumsToComplete[0] + sortedNumsToComplete[1];
      }
      
      case "fullHouse": {
        // Count total numbers left to match
        const matchedCount = numbers.filter(num => calledNumbers.includes(num)).length;
        return numbers.length - matchedCount;
      }
      
      default:
        return Infinity;
    }
  }
}
