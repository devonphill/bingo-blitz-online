
/**
 * Generates a random access code of specified length
 * @param length The length of the code to generate
 * @returns A string containing the random access code
 */
export function generateAccessCode(length: number = 6): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing characters like 0, O, 1, I
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }
  
  return code;
}

/**
 * Validates if an access code matches the expected format
 * @param code The access code to validate
 * @param length The expected length of the code
 * @returns Boolean indicating if the code is valid
 */
export function isValidAccessCode(code: string, length: number = 6): boolean {
  if (!code || code.length !== length) {
    return false;
  }
  
  // Check if code contains only valid characters
  const validCharacterRegex = /^[A-Z0-9]+$/;
  return validCharacterRegex.test(code);
}
