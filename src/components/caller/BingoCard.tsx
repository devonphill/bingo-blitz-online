
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BingoCardProps {
  numbers: number[];
  numberRange: number;
}

export default function BingoCard({ numbers, numberRange }: BingoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Called Numbers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-10 gap-2">
          {Array.from({ length: numberRange }, (_, i) => i + 1).map((number) => (
            <div
              key={number}
              className={`aspect-square flex items-center justify-center text-sm font-medium rounded-full
                ${numbers.includes(number)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600'
                }`}
            >
              {number}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
