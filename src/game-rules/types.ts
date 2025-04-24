// src/game-rules/types.ts

// Define the structure for returning the status of a ticket against a pattern
export interface TicketStatus {
    distance: number; // How many items away from winning (0 means winner for this pattern)
    isWinner: boolean; // Explicit boolean indicating if the pattern is met
}

// Define the structure for default win patterns provided by a game rule set
export interface DefaultWinPattern {
    id: string; // Unique identifier for the pattern (e.g., "oneLine", "fourCorners")
    name: string; // User-friendly name (e.g., "One Line", "Four Corners")
    // Optional: Add definition if needed, e.g., which cells/conditions constitute the pattern
    // definition?: any;
}

/**
 * Interface that all game rule implementations must implement
 */
export interface GameRules {
    /**
     * Get the name of the game type (e.g., "90-ball", "Music Bingo")
     */
    getGameTypeName(): string;

    /**
     * Get the default win patterns available for this game type.
     * These are presented to the caller to choose from for a specific game instance.
     */
    getDefaultWinPatterns(): DefaultWinPattern[];

    /**
     * Calculate the status of a given ticket against a specific win pattern,
     * considering the items called so far. Determines distance to win (Xtg) and if it's a winning ticket.
     * @param ticketData - The data representing the player's ticket/card (structure depends on game type).
     * @param calledItems - An array of items called so far (numbers, strings, objects, etc.).
     * @param activePatternId - The ID of the specific win pattern being checked.
     * @returns TicketStatus object indicating distance to win and winner status.
     */
    getTicketStatus(ticketData: any, calledItems: Array<any>, activePatternId: string): TicketStatus;

    /**
     * Optional: Method to get the next item to be called for this game type.
     * Could also live elsewhere depending on how item calling is managed.
     * getNextItem?(allItems: Array<any>, calledItems: Array<any>): any | null;
     */

    /**
      * Optional: Method to prepare or validate ticket data upon assignment or game start.
      * prepareTicketData?(rawTicketData: any): any;
     */
}
