import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface BingoCardProps {
  numbers?: number[];
  layoutMask?: number;
  calledNumbers?: number[];
  autoMarking?: boolean;
}

export default function BingoCard({
  numbers = [],
  layoutMask,
  calledNumbers = [],
  autoMarking = true
}: BingoCardProps) {
  const [card, setCard] = useState<Array<Array<number | null>>>([]);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (numbers && numbers.length > 0) {
      if (layoutMask !== undefined) {
        setCard(generateCardFromNumbersAndMask(numbers, layoutMask));
      } else {
        generateCardFromNumbers(numbers);
      }
    } else {
      generateCard();
    }
    setMarkedCells(new Set());
  }, [numbers, layoutMask]);

  function generateCardFromNumbersAndMask(numbers: number[], mask: number): Array<Array<number | null>> {
    const maskBinary = mask.toString(2).padStart(27, "0").split("").reverse();
    const filled: (number | null)[][] = [[], [], []];
    let numIdx = 0;
    for (let i = 0; i < 27; i++) {
      const rowIdx = Math.floor(i / 9);
      if (maskBinary[i] === "1") {
        filled[rowIdx].push(numbers[numIdx++] ?? null);
      } else {
        filled[rowIdx].push(null);
      }
    }
    return filled;
  }

  const generateCardFromNumbers = (ticketNumbers: number[]) => {
    const newCard = Array(3).fill(null).map(() => Array(9).fill(null));
    for (const num of ticketNumbers) {
      const col = num <= 9 ? 0 : Math.floor((num - 1) / 10);
      let placed = false;
      for (let row = 0; row < 3 && !placed; row++) {
        if (newCard[row][col] === null) {
          newCard[row][col] = num;
          placed = true;
        }
      }
    }
    setCard(newCard);
    setMarkedCells(new Set());
  };

  const generateCard = () => {
    const newCard = Array(3).fill(null).map(() => Array(9).fill(null));
    for (let col = 0; col < 9; col++) {
      const min = col * 10 + 1;
      const max = col === 8 ? 90 : (col + 1) * 10;
      const numberOfNumbers = Math.floor(Math.random() * 3) + 1;
      const rowsWithNumbers = selectRandomRows(numberOfNumbers);
      const numbers = generateUniqueRandomNumbers(numberOfNumbers, min, max);
      rowsWithNumbers.forEach((row, index) => {
        newCard[row][col] = numbers[index];
      });
    }
    adjustCardToValidateRowCounts(newCard);
    setCard(newCard);
    setMarkedCells(new Set());
  };

  const selectRandomRows = (count: number) => {
    const rows = [0, 1, 2];
    const selectedRows = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * rows.length);
      selectedRows.push(rows[randomIndex]);
      rows.splice(randomIndex, 1);
    }
    return selectedRows;
  };

  const generateUniqueRandomNumbers = (count: number, min: number, max: number) => {
    const numbers: number[] = [];
    while (numbers.length < count) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    return numbers.sort((a, b) => a - b);
  };

  const adjustCardToValidateRowCounts = (card: Array<Array<number | null>>) => {
    for (let row = 0; row < 3; row++) {
      const numbersInRow = card[row].filter(cell => cell !== null).length;
      if (numbersInRow > 5) {
        let toRemove = numbersInRow - 5;
        for (let col = 0; col < 9 && toRemove > 0; col++) {
          if (card[row][col] !== null) {
            card[row][col] = null;
            toRemove--;
          }
        }
      }
      if (numbersInRow < 5) {
        let toAdd = 5 - numbersInRow;
        for (let col = 0; col < 9 && toAdd > 0; col++) {
          if (card[row][col] === null) {
            const min = col * 10 + 1;
            const max = col === 8 ? 90 : (col + 1) * 10;
            const usedInOtherRows = [
              card[0][col],
              card[1][col],
              card[2][col]
            ].filter(n => n !== null);
            let number;
            do {
              number = Math.floor(Math.random() * (max - min + 1)) + min;
            } while (usedInOtherRows.includes(number));
            card[row][col] = number;
            toAdd--;
          }
        }
      }
    }
  };

  useEffect(() => {
    if (autoMarking) {
      setMarkedCells(new Set());
    }
  }, [autoMarking, numbers, layoutMask]);

  const isCellMarked = (row: number, col: number, value: number | null) => {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells.has(`${row},${col}`);
  };

  const toggleMark = (row: number, col: number, value: number | null) => {
    if (value === null || autoMarking) return;
    setMarkedCells((prev) => {
      const key = `${row},${col}`;
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="grid grid-cols-9 gap-1">
      {card.map((row, rowIndex) => (
        row.map((cell, colIndex) => {
          const marked = isCellMarked(rowIndex, colIndex, cell);
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`aspect-square flex items-center justify-center text-sm font-medium border rounded
                ${cell !== null ? (autoMarking ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50') : 'bg-gray-100'}
                ${marked ? 'bg-green-500 text-white font-bold' : ''}
              `}
              onClick={() => toggleMark(rowIndex, colIndex, cell)}
            >
              {cell !== null ? cell : ''}
            </div>
          );
        })
      ))}
    </div>
  );
}
