
import { supabase } from '@/integrations/supabase/client';

/**
 * Function to increment the version number in the database
 * @param increment - The amount to increment (default: 0.5)
 * @returns Promise with the new version number or undefined on error
 */
export async function incrementVersion(increment: number = 0.5): Promise<number | undefined> {
  try {
    const { data, error } = await supabase
      .rpc('increment_version', { increment_value: increment });
      
    if (error) {
      console.error('Error incrementing version:', error);
      return undefined;
    }
    
    return data;
  } catch (err) {
    console.error('Failed to increment version:', err);
    return undefined;
  }
}
