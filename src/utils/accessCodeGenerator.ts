
/**
 * Generates a random alphanumeric access code of the specified length
 * @param length The length of the access code to generate
 * @returns A random alphanumeric string
 */
export function generateAccessCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing characters like I, O, 0, 1
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Generates a random player code
 * @returns A random player code string
 */
export function generatePlayerCode(): string {
  return `P${generateAccessCode(5)}`;
}
