
/**
 * Normalizes a win pattern by ensuring it has the game type prefix
 * @param pattern The pattern to normalize
 * @param gameType The game type to use as prefix
 * @returns The normalized pattern with prefix
 */
export function normalizeWinPattern(pattern: string | null | undefined, gameType: string = 'mainstage'): string {
  if (!pattern) return `${gameType.toUpperCase()}_oneLine`;
  
  // If pattern already has the prefix, return as is
  if (pattern.toUpperCase().startsWith(`${gameType.toUpperCase()}_`)) {
    return pattern;
  }
  
  // Add the prefix
  return `${gameType.toUpperCase()}_${pattern}`;
}

/**
 * Gets a display name for a win pattern
 * @param pattern The pattern to get display name for
 * @returns A user-friendly display name
 */
export function getWinPatternDisplayName(pattern: string | null | undefined): string {
  if (!pattern) return 'One Line';
  
  // Remove any prefix like MAINSTAGE_
  const normalizedPattern = pattern.replace(/^[A-Z]+_/i, '');
  
  // Map to display name
  switch (normalizedPattern.toLowerCase()) {
    case 'oneline': return 'One Line';
    case 'twolines': return 'Two Lines';
    case 'fullhouse': return 'Full House';
    case 'fourcorners': return 'Four Corners';
    case 'centersquare': return 'Center Square';
    default: return normalizedPattern.charAt(0).toUpperCase() + normalizedPattern.slice(1);
  }
}
