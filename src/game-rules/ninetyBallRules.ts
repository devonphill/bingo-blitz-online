import type { GameRules } from './types';

export class NinetyBallRules implements GameRules {
  getGameTypeName(): string {
    return '90-ball';
  }
  
  getDefaultWinPatterns(): Array<any> {
    return [
      {
        id: "oneLine",
        name: "One Line",
        active: true,
        order: 1
      },
      {
        id: "twoLines",
        name: "Two Lines",
        active: true,
        order: 2
      },
      {
        id: "fullHouse",
        name: "Full House",
        active: true,
        order: 3
      }
    ];
  }
  
  validateWin(patternId: string, ticket: any, calledNumbers: number[]): boolean {
    const layoutMask = ticket.layoutMask;
    const numbers = ticket.numbers;
    if (!layoutMask || !numbers || !Array.isArray(numbers)) {
      console.error("Invalid ticket data for validation:", ticket);
      return false;
    }
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
    const completeRows = rows.filter(row => 
      row.length > 0 && row.every(num => calledNumbers.includes(num))
    ).length;
    switch (patternId) {
      case "oneLine":
        return completeRows >= 1;
      case "twoLines":
        return completeRows >= 2;
      case "fullHouse":
        return numbers.every(num => calledNumbers.includes(num));
      default:
        return false;
    }
  }
  
  getWinDistance(patternId: string, ticket: any, calledNumbers: number[]): number {
    const layoutMask = ticket.layoutMask;
    const numbers = ticket.numbers;
    if (!layoutMask || !numbers || !Array.isArray(numbers)) {
      return Infinity;
    }
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
    const lineCounts = rows.map(line => 
      line.filter(num => num !== null && calledNumbers.includes(num as number)).length
    );
    const lineNeeded = rows.map(line => 
      line.filter(num => num !== null).length
    );
    const completedLines = lineCounts.filter((count, idx) => 
      count === lineNeeded[idx]
    ).length;
    switch (patternId) {
      case "oneLine": {
        if (completedLines >= 1) return 0;
        const incompleteCounts = rows.map((line, idx) => {
          const numsMissing = lineNeeded[idx] - lineCounts[idx];
          return numsMissing > 0 ? numsMissing : Infinity;
        });
        return Math.min(...incompleteCounts.filter(n => n !== Infinity));
      }
      case "twoLines": {
        if (completedLines >= 2) return 0;
        if (completedLines === 1) {
          const incompleteCounts = rows.map((line, idx) => {
            if (lineCounts[idx] === lineNeeded[idx]) return Infinity;
            const numsMissing = lineNeeded[idx] - lineCounts[idx];
            return numsMissing > 0 ? numsMissing : Infinity;
          });
          return Math.min(...incompleteCounts.filter(n => n !== Infinity));
        }
        const sortedNumsToComplete = rows.map((line, idx) => 
          lineNeeded[idx] - lineCounts[idx]
        ).sort((a, b) => a - b);
        return sortedNumsToComplete[0] + sortedNumsToComplete[1];
      }
      case "fullHouse": {
        const matchedCount = numbers.filter(num => calledNumbers.includes(num)).length;
        return numbers.length - matchedCount;
      }
      default:
        return Infinity;
    }
  }
}
