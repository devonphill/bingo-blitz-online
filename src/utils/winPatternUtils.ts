/**
 * Ensures that win patterns for MAINSTAGE games always have the MAINSTAGE_ prefix
 * @param patternId The pattern ID to normalize
 * @param gameType The game type (defaults to 'mainstage')
 * @returns A properly prefixed pattern ID
 */
export function normalizeWinPattern(patternId: string | null | undefined, gameType: string = 'mainstage'): string {
  if (!patternId) {
    return 'MAINSTAGE_oneLine'; // Default to one line if no pattern provided
  }
  
  // For MAINSTAGE game type
  if (gameType.toLowerCase() === 'mainstage' || gameType.toLowerCase() === '90ball') {
    // If it doesn't start with MAINSTAGE_, add it
    if (!patternId.startsWith('MAINSTAGE_')) {
      return `MAINSTAGE_${patternId}`;
    }
    return patternId;
  }
  
  // For other game types, keep as is for now
  return patternId;
}

/**
 * Gets the display name for a win pattern based on its ID
 * @param patternId The pattern ID
 * @returns A user-friendly name
 */
export function getWinPatternDisplayName(patternId: string | null | undefined): string {
  if (!patternId) return 'One Line';
  
  // Remove prefix for display
  const basePattern = patternId.replace(/^MAINSTAGE_|^PARTY_|^MUSIC_|^QUIZ_/, '');
  
  // Map to friendly names
  const patternNames: Record<string, string> = {
    'oneLine': 'One Line',
    'twoLines': 'Two Lines',
    'fullHouse': 'Full House',
    'corners': 'Corners',
    'threeLines': 'Three Lines',
    'coverAll': 'Cover All'
  };
  
  return patternNames[basePattern] || basePattern;
}
