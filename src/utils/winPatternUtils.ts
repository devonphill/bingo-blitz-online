
/**
 * Normalizes a win pattern by ensuring it has the game type prefix
 * @param pattern The pattern to normalize
 * @param gameType The game type to use as prefix
 * @returns The normalized pattern with prefix
 */
export function normalizeWinPattern(pattern: string | null | undefined, gameType: string = 'mainstage'): string {
  if (!pattern) return `${gameType.toUpperCase()}_oneLine`;
  
  // First standardize the pattern name itself
  let standardizedPattern = pattern.toLowerCase();
  
  // Handle common variations - ensure consistent camelCase
  if (standardizedPattern === 'one line' || standardizedPattern === '1line' || standardizedPattern === '1 line' || standardizedPattern === 'oneline') {
    standardizedPattern = 'oneLine';
  } else if (standardizedPattern === 'two lines' || standardizedPattern === '2lines' || standardizedPattern === '2 lines' || standardizedPattern === 'twolines') {
    standardizedPattern = 'twoLines';
  } else if (standardizedPattern === 'full house' || standardizedPattern === 'fullhouse') {
    standardizedPattern = 'fullHouse';
  } else if (standardizedPattern === 'four corners' || standardizedPattern === '4corners' || standardizedPattern === 'fourcorners') {
    standardizedPattern = 'fourCorners';
  } else if (standardizedPattern === 'center square' || standardizedPattern === 'centersquare') {
    standardizedPattern = 'centerSquare';
  }
  
  // If pattern already has the prefix (case-insensitive), extract just the pattern part
  const prefixRegex = new RegExp(`^${gameType}_`, 'i');
  if (prefixRegex.test(standardizedPattern)) {
    standardizedPattern = standardizedPattern.replace(prefixRegex, '');
  }
  
  // If pattern already has any game type prefix, strip it
  const anyPrefixRegex = /^[a-zA-Z]+_/;
  if (anyPrefixRegex.test(standardizedPattern)) {
    standardizedPattern = standardizedPattern.replace(anyPrefixRegex, '');
  }
  
  // Now add the correct prefix with consistent casing
  return `${gameType.toUpperCase()}_${standardizedPattern}`;
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
  
  // Convert to lowercase for consistent matching
  const patternLower = normalizedPattern.toLowerCase();
  
  // Map to display name
  switch (patternLower) {
    case 'oneline': return 'One Line';
    case 'twolines': return 'Two Lines';
    case 'fullhouse': return 'Full House';
    case 'fourcorners': return 'Four Corners';
    case 'centersquare': return 'Center Square';
    // Add more patterns as needed
    default: 
      // Convert to title case if no match
      return normalizedPattern.charAt(0).toUpperCase() + 
             normalizedPattern.slice(1).replace(/([A-Z])/g, ' $1');
  }
}

/**
 * Checks if two win patterns are equivalent, regardless of formatting
 * @param pattern1 First pattern to compare
 * @param pattern2 Second pattern to compare
 * @param gameType Game type to use for normalization
 * @returns True if patterns are equivalent
 */
export function areWinPatternsEquivalent(
  pattern1: string | null | undefined, 
  pattern2: string | null | undefined,
  gameType: string = 'mainstage'
): boolean {
  if (!pattern1 && !pattern2) return true;
  if (!pattern1 || !pattern2) return false;
  
  const normalized1 = normalizeWinPattern(pattern1, gameType);
  const normalized2 = normalizeWinPattern(pattern2, gameType);
  
  return normalized1.toLowerCase() === normalized2.toLowerCase();
}
