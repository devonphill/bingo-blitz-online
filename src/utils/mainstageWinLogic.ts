
interface WinCheckResult {
  isWinner: boolean;
  tg: number;
}

export function checkMainstageWinPattern(
  card: (number | null)[][],
  calledNumbers: number[],
  pattern: 'oneLine' | 'twoLines' | 'fullHouse' | 'MAINSTAGE_oneLine' | 'MAINSTAGE_twoLines' | 'MAINSTAGE_fullHouse'
): WinCheckResult {
  const rows = card.map(row => 
    row.filter((num): num is number => num !== null)
  );

  const completedLines = rows.filter(row =>
    row.every(num => calledNumbers.includes(num))
  ).length;

  const calculateTG = (requiredLines: number): number => {
    if (completedLines >= requiredLines) return 0;
    
    const remainingLines = rows
      .map(row => {
        const unmarkedCount = row.filter(num => !calledNumbers.includes(num)).length;
        return unmarkedCount;
      })
      .sort((a, b) => a - b)
      .slice(0, requiredLines - completedLines);

    return remainingLines.length > 0 ? Math.min(...remainingLines) : 0;
  };

  // Normalize pattern by removing MAINSTAGE_ prefix if present
  const normalizedPattern = pattern.replace('MAINSTAGE_', '') as 'oneLine' | 'twoLines' | 'fullHouse';

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
      return { isWinner: false, tg: 0 };
  }
}
