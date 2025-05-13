/**
 * Service for handling number calling functionality in bingo games
 * This is a placeholder implementation that will be expanded with actual functionality
 */

export class NumberCallingService {
  private calledNumbers: number[] = [];
  
  /**
   * Get the list of numbers that have been called so far
   */
  public getCalledNumbers(): number[] {
    return [...this.calledNumbers];
  }
  
  /**
   * Call a new random number that hasn't been called yet
   * @param max The maximum number that can be called (e.g., 90 for 90-ball bingo)
   * @returns The newly called number or null if all numbers have been called
   */
  public callNextNumber(max: number): number | null {
    if (this.calledNumbers.length >= max) {
      return null; // All numbers have been called
    }
    
    let nextNumber: number;
    do {
      nextNumber = Math.floor(Math.random() * max) + 1;
    } while (this.calledNumbers.includes(nextNumber));
    
    this.calledNumbers.push(nextNumber);
    return nextNumber;
  }
  
  /**
   * Reset the called numbers list
   */
  public resetCalledNumbers(): void {
    this.calledNumbers = [];
  }
  
  /**
   * Check if a specific number has been called
   * @param number The number to check
   * @returns True if the number has been called, false otherwise
   */
  public hasNumberBeenCalled(number: number): boolean {
    return this.calledNumbers.includes(number);
  }
}
