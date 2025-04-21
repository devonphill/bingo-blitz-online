
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// For a 90-ball bingo card
// 9 columns (numbers 1-9, 10-19, 20-29, etc.)
// 3 rows with 5 numbers and 4 blank spaces per row

export default function BingoCard() {
  const [card, setCard] = useState<Array<Array<number | null>>>([]);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    generateCard();
  }, []);

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
    const cellKey = `${row}-${col}`;
    const newMarkedCells = new Set(markedCells);
    
    if (card[row][col] !== null) {
      if (markedCells.has(cellKey)) {
        newMarkedCells.delete(cellKey);
      } else {
        newMarkedCells.add(cellKey);
      }
      
      setMarkedCells(newMarkedCells);
    }
  };

  const claimBingo = () => {
    // This would be connected to real-time functionality
    toast({
      title: "Bingo Claimed!",
      description: "Your claim has been submitted to the caller.",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold text-center">Your Bingo Card</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-9 gap-1 mb-4">
          {card.map((row, rowIndex) => (
            row.map((cell, colIndex) => (
              <div 
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-card-cell aspect-square ${markedCells.has(`${rowIndex}-${colIndex}`) ? 'marked' : ''} ${cell === null ? 'bg-gray-100' : 'cursor-pointer hover:bg-gray-50'}`}
                onClick={() => toggleMark(rowIndex, colIndex)}
              >
                {cell !== null ? cell : ''}
              </div>
            ))
          ))}
        </div>
        <Button 
          className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
          onClick={claimBingo}
        >
          Claim Bingo!
        </Button>
      </CardContent>
    </Card>
  );
}
