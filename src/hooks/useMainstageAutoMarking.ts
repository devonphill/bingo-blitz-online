
import { useState, useEffect } from 'react';

interface UseMainstageAutoMarkingProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  autoMarking: boolean;
}

export function useMainstageAutoMarking({ 
  numbers, 
  layoutMask, 
  calledNumbers, 
  autoMarking 
}: UseMainstageAutoMarkingProps) {
  const [card, setCard] = useState<Array<Array<number | null>>>([]);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!layoutMask) return;
    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const filled: (number | null)[][] = [[], [], []];
    let numIdx = 0;

    for (let i = 0; i < 27; i++) {
      const rowIdx = Math.floor(i / 9);
      if (maskBits[i] === "1") {
        filled[rowIdx].push(numbers[numIdx++] ?? null);
      } else {
        filled[rowIdx].push(null);
      }
    }
    setCard(filled);
  }, [numbers, layoutMask]);

  // Reset marked cells when autoMarking changes
  useEffect(() => {
    if (autoMarking) setMarkedCells(new Set());
  }, [autoMarking, numbers, layoutMask]);

  return {
    card,
    markedCells,
    setMarkedCells
  };
}
