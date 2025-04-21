
import React from "react";

const WIN_PATTERNS: { [key: string]: { label: string; lines: number } } = {
  oneLine: { label: "One Line", lines: 1 },
  twoLines: { label: "Two Lines", lines: 2 },
  fullHouse: { label: "Full House", lines: 3 }
};

export default function BingoWinProgress({
  numbers,
  layoutMask,
  calledNumbers,
  activeWinPatterns
}: {
  numbers: number[],
  layoutMask: number,
  calledNumbers: number[],
  activeWinPatterns: string[]
}) {
  // Replicates calcTicketProgress logic
  const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
  const rows: (number | null)[][] = [[], [], []];
  let nIdx = 0;

  for (let i = 0; i < 27; i++) {
    const row = Math.floor(i / 9);
    if (maskBits[i] === '1') {
      rows[row].push(numbers[nIdx]);
      nIdx++;
    } else {
      rows[row].push(null);
    }
  }

  const lineCounts = rows.map(line => line.filter(num => num !== null && calledNumbers.includes(num as number)).length);
  const lineNeeded = rows.map(line => line.filter(num => num !== null).length);
  const completedLines = lineCounts.filter((count, idx) => count === lineNeeded[idx]).length;

  const result: { [pattern: string]: number } = {};
  Object.entries(WIN_PATTERNS).forEach(([key, { lines }]) => {
    const linesToGo = Math.max(0, lines - completedLines);
    let minNeeded = Infinity;
    if (linesToGo === 0) {
      minNeeded = 0;
    } else {
      minNeeded = Math.min(
        ...rows
          .map((line, idx) => lineNeeded[idx] - lineCounts[idx])
          .filter(n => n > 0)
      );
      if (minNeeded === Infinity) minNeeded = 0;
    }
    result[key] = minNeeded;
  });

  const minToGo = Math.min(...activeWinPatterns.map(p => result[p] ?? 15));
  return (
    <span className={minToGo <= 3 ? "font-bold text-green-600" : "font-medium text-gray-700"}>
      {minToGo === 0 ? "Bingo!" : `${minToGo} to go`}
    </span>
  );
}
