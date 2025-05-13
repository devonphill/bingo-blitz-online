
// Export a basic service to fix the build errors
export class NumberCallingService {
  private static instance: NumberCallingService;
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): NumberCallingService {
    if (!NumberCallingService.instance) {
      NumberCallingService.instance = new NumberCallingService();
    }
    return NumberCallingService.instance;
  }
  
  // Basic methods that will be needed by other components
  public callNumber(number: number, sessionId?: string): Promise<boolean> {
    console.log(`NumberCallingService: Calling number ${number} for session ${sessionId}`);
    return Promise.resolve(true);
  }
  
  public resetNumbers(sessionId?: string): Promise<boolean> {
    console.log(`NumberCallingService: Resetting numbers for session ${sessionId}`);
    return Promise.resolve(true);
  }
}

// Export a function to get the service instance for compatibility
export const getNumberCallingService = (): NumberCallingService => {
  return NumberCallingService.getInstance();
};
