import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// For a 90-ball bingo card
// 9 columns (numbers 1-9, 10-19, 20-29, etc.)
// 3 rows with 5 numbers and 4 blank spaces per row

// Accept extra prop for calledNumbers for ticket rendering
interface BingoCardProps {
  numbers?: number[];
  layoutMask?: number;
  calledNumbers?: number[];
}

// Update: add mask rendering
export default function BingoCard({ numbers = [], layoutMask, calledNumbers = [] }: BingoCardProps) {
  const [card, setCard] = useState<Array<Array<number | null>>>([]);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (numbers && numbers.length > 0) {
      if (layoutMask !== undefined) {
        // Use improved function below!
        setCard(generateCardFromNumbersAndMask(numbers, layoutMask));
      } else {
        generateCardFromNumbers(numbers);
      }
    } else {
      generateCard();
    }
    setMarkedCells(new Set());
    // eslint-disable-next-line
  }, [numbers, layoutMask]);

  // New: deterministic mask application, 90-ball only.
  function generateCardFromNumbersAndMask(numbers: number[], mask: number): Array<Array<number | null>> {
    // mask = 27 bits; '1' means number, read mask LSB left-to-right, row major
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

  // Function to generate a card from a layout mask and numbers
  const generateCardFromLayoutMask = (ticketNumbers: number[], mask: number) => {
    // Create a new 3x9 card filled with nulls
    const newCard = Array(3).fill(null).map(() => Array(9).fill(null));
    
    // Convert mask to a binary string padded to 27 bits (3 rows × 9 columns)
    // '1' means there should be a number, '0' means it should be blank
    const maskBinary = mask.toString(2).padStart(27, '0');
    
    // Organize the 15 numbers by their column
    const columnNumbers: { [key: number]: number[] } = {};
    
    // Initialize column arrays
    for (let i = 0; i < 9; i++) {
      columnNumbers[i] = [];
    }
    
    // Sort numbers into their respective columns
    ticketNumbers.forEach(num => {
      const colIndex = num <= 9 ? 0 : Math.floor((num - 1) / 10);
      columnNumbers[colIndex].push(num);
    });
    
    // Sort numbers within each column
    for (let col = 0; col < 9; col++) {
      columnNumbers[col].sort((a, b) => a - b);
    }
    
    // Place numbers according to the mask
    let ticketIndex = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const maskIndex = row * 9 + col;
        const hasBit = maskBinary[maskBinary.length - 1 - maskIndex] === '1';
        
        if (hasBit && columnNumbers[col].length > 0) {
          newCard[row][col] = columnNumbers[col].shift()!;
        }
      }
    }
    
    setCard(newCard);
    setMarkedCells(new Set());
  };

  // Function to generate a card from a list of numbers
  const generateCardFromNumbers = (ticketNumbers: number[]) => {
    // Create a new 3x9 card filled with nulls
    const newCard = Array(3).fill(null).map(() => Array(9).fill(null));
    
    // Process each number and place it in the appropriate column
    for (const num of ticketNumbers) {
      // Determine which column this number belongs in
      const col = num <= 9 ? 0 : Math.floor((num - 1) / 10);
      
      // Find an empty spot in this column (try each row)
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

  // Function to generate a 90-ball bingo card
  const generateCard = () => {
    // Create a new 3x9 card filled with nulls
    const newCard = Array(3).fill(null).map(() => Array(9).fill(null));
    
    // For each column, decide which rows have numbers
    for (let col = 0; col < 9; col++) {
      // Calculate the range for this column (1-9, 10-19, etc.)
      const min = col * 10 + 1;
      const max = col === 8 ? 90 : (col + 1) * 10;
      
      // For 90-ball bingo, each column has 1, 2, or 3 numbers
      const numberOfNumbers = Math.floor(Math.random() * 3) + 1;
      
      // Select which rows will have numbers in this column
      const rowsWithNumbers = selectRandomRows(numberOfNumbers);
      
      // Generate unique numbers for this column
      const numbers = generateUniqueRandomNumbers(numberOfNumbers, min, max);
      
      // Assign numbers to selected rows
      rowsWithNumbers.forEach((row, index) => {
        newCard[row][col] = numbers[index];
      });
    }
    
    // Ensure each row has exactly 5 numbers
    adjustCardToValidateRowCounts(newCard);
    
    setCard(newCard);
    setMarkedCells(new Set());
  };

  // Function to select random rows
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

  // Function to generate unique random numbers within a range
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

  // Function to adjust the card to ensure each row has exactly 5 numbers
  const adjustCardToValidateRowCounts = (card: Array<Array<number | null>>) => {
    for (let row = 0; row < 3; row++) {
      const numbersInRow = card[row].filter(cell => cell !== null).length;
      
      // If too many numbers, remove some
      if (numbersInRow > 5) {
        let toRemove = numbersInRow - 5;
        for (let col = 0; col < 9 && toRemove > 0; col++) {
          if (card[row][col] !== null) {
            card[row][col] = null;
            toRemove--;
          }
        }
      }
      
      // If too few numbers, add some
      if (numbersInRow < 5) {
        let toAdd = 5 - numbersInRow;
        for (let col = 0; col < 9 && toAdd > 0; col++) {
          if (card[row][col] === null) {
            // Find a number for this column that isn't used in other rows
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

  const toggleMark = (row: number, col: number) => {
    // Only allow manual marking in non-spectator/caller (not required for player)
    // Just block marking here for player game context
    // But keep mark function for future use
  };

  return (
    <div className="grid grid-cols-9 gap-1">
      {card.map((row, rowIndex) => (
        row.map((cell, colIndex) => {
          const isMarked = cell !== null && calledNumbers.includes(cell);
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`aspect-square flex items-center justify-center text-sm font-medium border rounded
                ${cell !== null ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-100'}
                ${isMarked ? 'bg-green-500 text-white font-bold' : ''}
              `}
              // toggleMark is NOP for real game play
              onClick={() => {}}
            >
              {cell !== null ? cell : ''}
            </div>
          );
        })
      ))}
    </div>
  );
}
