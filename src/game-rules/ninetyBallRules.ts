// src/game-rules/ninetyBallRules.ts

import type { GameRules, TicketStatus, DefaultWinPattern } from './types';

// Helper function to parse 90-ball ticket data (assuming layoutMask and numbers array)
// This helps ensure the data format before processing
function parseNinetyBallTicket(ticketData: any): { numbers: number[]; rows: (number | null)[][]; isValid: boolean } {
    const layoutMask = ticketData?.layout_mask;
    const numbers = ticketData?.numbers;

    if (typeof layoutMask !== 'number' || !Array.isArray(numbers) || numbers.some(n => typeof n !== 'number')) {
        console.error("Invalid 90-ball ticket data for validation:", ticketData);
        return { numbers: [], rows: [[], [], []], isValid: false };
    }

    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const rows: (number | null)[][] = [[], [], []];
    let numIndex = 0;
    let expectedNumbers = 0;

    for (let i = 0; i < 27; i++) {
        const row = Math.floor(i / 9);
        const col = i % 9; // Keep track of column for potential future use

        // Ensure rows array is properly initialized
        if (!rows[row]) rows[row] = [];

        if (maskBits[i] === '1') {
            if (numIndex < numbers.length) {
                rows[row][col] = numbers[numIndex]; // Place number at correct column index
                numIndex++;
                expectedNumbers++;
            } else {
                console.error(`Mismatch between layout mask and numbers array length for ticket`, ticketData);
                return { numbers: [], rows: [[], [], []], isValid: false };
            }
        } else {
            rows[row][col] = null; // Place null for empty cells
        }
    }

    // Final check: Ensure all numbers from the array were placed according to the mask
    if (numIndex !== numbers.length || expectedNumbers !== numbers.length) {
        console.error(`Mask processing error or number count mismatch for ticket`, ticketData);
        return { numbers: [], rows: [[], [], []], isValid: false };
    }


    // Fill remaining columns with nulls if needed (ensure 9 columns per row)
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
            if (rows[r][c] === undefined) {
                rows[r][c] = null;
            }
        }
    }


    return { numbers, rows, isValid: true };
}


export class NinetyBallRules implements GameRules {
    getGameTypeName(): string {
        return '90-ball';
    }

    getDefaultWinPatterns(): DefaultWinPattern[] {
        return [
            {
                id: "oneLine",
                name: "One Line",
            },
            {
                id: "twoLines",
                name: "Two Lines",
            },
            {
                id: "fullHouse",
                name: "Full House",
            }
        ];
    }

    getTicketStatus(ticketData: any, calledItems: Array<any>, activePatternId: string): TicketStatus {
        // Assume calledItems for 90-ball are numbers
        const calledNumbers = calledItems.filter(item => typeof item === 'number') as number[];

        const { numbers: ticketNumbers, rows, isValid } = parseNinetyBallTicket(ticketData);

        if (!isValid || ticketNumbers.length === 0) {
            // Return non-winning status if ticket data is invalid
            return { distance: Infinity, isWinner: false };
        }

        // --- Calculate Line Status ---
        const lineDetails = rows.map(line => {
            const numsInLine = line.filter(num => num !== null) as number[];
            const matchedCount = numsInLine.filter(num => calledNumbers.includes(num)).length;
            const neededCount = numsInLine.length;
            const isComplete = neededCount > 0 && matchedCount === neededCount;
            const distance = neededCount - matchedCount;
            return { numsInLine, matchedCount, neededCount, isComplete, distance };
        });

        const completedLines = lineDetails.filter(line => line.isComplete).length;
        const totalMatchedOnTicket = ticketNumbers.filter(num => calledNumbers.includes(num)).length;
        const totalNumbersOnTicket = ticketNumbers.length;

        // --- Determine Status Based on Active Pattern ---
        switch (activePatternId) {
            case "oneLine": {
                if (completedLines >= 1) return { distance: 0, isWinner: true };
                // Find the minimum distance among incomplete lines
                const minDistance = Math.min(...lineDetails.map(line => line.distance).filter(d => d > 0));
                return { distance: minDistance, isWinner: false };
            }
            case "twoLines": {
                if (completedLines >= 2) return { distance: 0, isWinner: true };
                if (completedLines === 1) {
                    // Need one more line, find the minimum distance among remaining incomplete lines
                    const minDistance = Math.min(...lineDetails.filter(line => !line.isComplete).map(line => line.distance).filter(d => d > 0));
                    return { distance: minDistance, isWinner: false };
                }
                // Need two lines from scratch, find sum of the two smallest distances
                const sortedDistances = lineDetails.map(line => line.distance).sort((a, b) => a - b);
                const distance = (sortedDistances[0] ?? Infinity) + (sortedDistances[1] ?? Infinity);
                return { distance: distance, isWinner: false };
            }
            case "fullHouse": {
                const distance = totalNumbersOnTicket - totalMatchedOnTicket;
                return { distance: distance, isWinner: distance === 0 };
            }
            default:
                console.warn(`Unknown pattern ID "${activePatternId}" for 90-ball.`);
                return { distance: Infinity, isWinner: false }; // Unknown pattern
        }
    }

    // Deprecated methods (replaced by getTicketStatus) - can be removed or kept for reference
    // validateWin(patternId: string, ticket: any, calledNumbers: number[]): boolean {
    //   const status = this.getTicketStatus(ticket, calledNumbers, patternId);
    //   return status.isWinner;
    // }
    // getWinDistance(patternId: string, ticket: any, calledNumbers: number[]): number {
    //   const status = this.getTicketStatus(ticket, calledNumbers, patternId);
    //   return status.distance;
    // }

}
