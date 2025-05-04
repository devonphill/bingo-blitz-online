
interface WinCheckResult {
  isWinner: boolean;
  tg: number;
}

export function checkMainstageWinPattern(
  card: (number | null)[][],
  calledNumbers: number[],
  pattern: 'oneLine' | 'twoLines' | 'fullHouse' | 'MAINSTAGE_oneLine' | 'MAINSTAGE_twoLines' | 'MAINSTAGE_fullHouse'
): WinCheckResult {
  // Normalize pattern by removing MAINSTAGE_ prefix if present
  const normalizedPattern = pattern.replace(/^MAINSTAGE_/, '') as 'oneLine' | 'twoLines' | 'fullHouse';
  
  // Debug log to verify pattern being checked
  console.log(`Checking win pattern: ${pattern} (normalized to: ${normalizedPattern})`);
  console.log(`Called numbers count: ${calledNumbers.length}`);

  const rows = card.map(row => 
    row.filter((num): num is number => num !== null)
  );

  // Get count of completed rows (lines)
  const completedLines = rows.filter(row =>
    row.length > 0 && row.every(num => calledNumbers.includes(num))
  ).length;
  
  // Debug log completed lines
  console.log(`Completed lines: ${completedLines}`);

  const calculateTG = (requiredLines: number): number => {
    if (completedLines >= requiredLines) return 0;
    
    // Sort rows by how many numbers are left to be marked
    const remainingLines = rows
      .map(row => {
        if (row.length === 0) return Infinity;  // Skip empty rows
        const unmarkedCount = row.filter(num => !calledNumbers.includes(num)).length;
        return unmarkedCount;
      })
      .filter(count => count !== Infinity)  // Filter out empty rows
      .sort((a, b) => a - b)  // Sort by fewest unmarked numbers
      .slice(0, requiredLines - completedLines);  // Take only what we need

    return remainingLines.length > 0 ? remainingLines[0] : 0;
  };

  switch (normalizedPattern) {
    case 'oneLine':
      return { 
        isWinner: completedLines >= 1,
        tg: calculateTG(1)
      };
    case 'twoLines':
      return {
        isWinner: completedLines >= 2,
        tg: calculateTG(2)
      };
    case 'fullHouse':
      return {
        isWinner: completedLines === 3,
        tg: calculateTG(3)
      };
    default:
      // Added debug log for unrecognized patterns
      console.error(`Unrecognized win pattern: ${pattern}`);
      return { isWinner: false, tg: 0 };
  }
}
